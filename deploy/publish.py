"""Publish a verified static directory, retaining one rollback copy. Run via SSH."""
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid

STORE = Path('/var/lib/zju-cantonese-duolingo')
PUBLIC = Path('/var/www/zju-cantonese-duolingo')
SLOTS = (STORE / 'site-a', STORE / 'site-b')
STATE = STORE / 'state.json'


def current_target():
    if not PUBLIC.is_symlink():
        if PUBLIC.exists():
            raise RuntimeError('Public path is an existing directory; refusing to replace it.')
        return None
    target = PUBLIC.resolve(strict=True)
    if target not in SLOTS or target.is_symlink():
        raise RuntimeError('Public path does not point to a managed directory.')
    return target


def switch(target):
    link = PUBLIC.parent / ('.yue-next-' + uuid.uuid4().hex)
    try:
        link.symlink_to(target, target_is_directory=True)
        os.replace(link, PUBLIC)
    finally:
        link.unlink(missing_ok=True)


def verify_tree(folder, manifest):
    if not isinstance(manifest, list) or not manifest:
        raise ValueError('Empty or invalid manifest.')
    expected = {}
    for entry in manifest:
        name = entry['path']
        parts = PurePosixPath(name)
        if parts.is_absolute() or '..' in parts.parts or any(p.startswith('.') for p in parts.parts):
            raise ValueError('Invalid manifest path.')
        if name in expected:
            raise ValueError('Duplicate manifest path.')
        expected[name] = entry
    actual = {p.relative_to(folder).as_posix() for p in folder.rglob('*') if p.is_file()}
    if actual != set(expected):
        raise ValueError('Uploaded files do not match the manifest.')
    for name, entry in expected.items():
        file = folder / name
        if file.is_symlink() or file.stat().st_size != entry['size']:
            raise ValueError('Invalid file or size: ' + name)
        if hashlib.sha256(file.read_bytes()).hexdigest() != entry['sha256'].lower():
            raise ValueError('Checksum mismatch: ' + name)
    if not {'index.html', 'game.js', 'game.css', 'engine.js', 'content/course.js', 'content/media.json'} <= actual:
        raise ValueError('Required website files are missing.')
    return expected


def check_http(expected):
    for name in ('index.html', 'game.js', 'content/course.js', 'content/media.json'):
        url = 'https://conscient.hk.cn/yue/' + ('' if name == 'index.html' else name)
        result = subprocess.run(['curl', '--resolve', 'conscient.hk.cn:443:127.0.0.1',
                                 '-fsS', '--max-time', '15', url], capture_output=True, check=True)
        if hashlib.sha256(result.stdout).hexdigest() != expected[name]['sha256'].lower():
            raise RuntimeError('Published HTTP content differs: ' + name)


def save_state(current, previous):
    temporary = STORE / 'state.json.tmp'
    temporary.write_text(json.dumps({'current': str(current), 'previous': str(previous) if previous else None}), encoding='utf-8')
    os.replace(temporary, STATE)


def rollback(old):
    if old is None:
        raise RuntimeError('No current deployment to roll back.')
    state = json.loads(STATE.read_text(encoding='utf-8'))
    target = Path(state['previous']) if state.get('previous') else None
    if target not in SLOTS or target == old or target.is_symlink() or not target.is_dir():
        raise RuntimeError('No usable rollback copy.')
    manifest = json.loads((STORE / (target.name + '.json')).read_text(encoding='utf-8'))
    expected = verify_tree(target, manifest)
    switch(target)
    try:
        check_http(expected)
    except Exception:
        switch(old)
        raise
    save_state(target, old)
    print('Rolled back successfully: https://conscient.hk.cn/yue/')


def publish(upload, old):
    manifest = json.loads((upload / 'manifest.json').read_text(encoding='utf-8-sig'))
    with tempfile.TemporaryDirectory(prefix='staging-', dir=STORE) as staging:
        stage = Path(staging) / 'web'
        stage.mkdir()
        with tarfile.open(upload / 'web.tar.gz', 'r:gz') as archive:
            for member in archive.getmembers():
                parts = PurePosixPath(member.name)
                if parts.is_absolute() or '..' in parts.parts or any(p.startswith('.') for p in parts.parts):
                    raise ValueError('Unsafe archive path.')
                if not member.isdir() and not member.isfile():
                    raise ValueError('Archive contains a link or special file.')
                destination = stage.joinpath(*parts.parts)
                if member.isdir():
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, destination.open('xb') as output:
                        shutil.copyfileobj(source, output)
        expected = verify_tree(stage, manifest)
        for file in stage.rglob('*'):
            file.chmod(0o755 if file.is_dir() else 0o644)
        stage.chmod(0o755)
        target = SLOTS[1] if old == SLOTS[0] else SLOTS[0]
        if target.is_symlink():
            raise RuntimeError('Unexpected symlink in deployment storage.')
        # Only the inactive, fixed managed directory may be replaced.
        if target.exists():
            shutil.rmtree(target)
        os.replace(stage, target)
        (STORE / (target.name + '.json')).write_text(json.dumps(manifest), encoding='utf-8')
        PUBLIC.parent.mkdir(parents=True, exist_ok=True)
        switch(target)
        if old:
            try:
                check_http(expected)
            except Exception:
                switch(old)
                save_state(old, None)
                print('HTTP verification failed; previous website restored.', file=sys.stderr)
                raise
        save_state(target, old)
        print('Published ' + str(len(expected)) + ' verified files to ' + str(PUBLIC))
        print('HTTPS verification passed.' if old else 'Initial files ready; configure Nginx to enable /yue/.')


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ('publish', 'rollback'):
        raise SystemExit('Usage: publish.py publish|rollback UPLOAD_DIRECTORY')
    if os.geteuid() != 0:
        raise SystemExit('Run through sudo.')
    upload = Path(sys.argv[2]).resolve(strict=True)
    if upload.parent != Path('/tmp') or not upload.name.startswith('zju-yue-upload.'):
        raise ValueError('Unexpected upload directory.')
    STORE.mkdir(mode=0o755, parents=True, exist_ok=True)
    if STORE.is_symlink():
        raise ValueError('Unexpected storage symlink.')
    with (STORE / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old = current_target()
        if sys.argv[1] == 'rollback':
            rollback(old)
        else:
            publish(upload, old)
    shutil.rmtree(upload)


if __name__ == '__main__':
    main()
