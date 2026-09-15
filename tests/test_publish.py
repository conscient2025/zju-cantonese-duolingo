"""Filesystem-level deployment checks, using isolated directories and no network."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[1] / 'deploy' / 'publish.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublishingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        publisher.STORE = self.root / 'managed'
        publisher.STORE.mkdir()
        publisher.PUBLIC = self.root / 'www' / 'site'
        publisher.SLOTS = (publisher.STORE / 'site-a', publisher.STORE / 'site-b')
        publisher.STATE = publisher.STORE / 'state.json'
        publisher.check_http = lambda expected: None
        self.upload = self.root / 'upload'
        self.upload.mkdir()

    def bundle(self, content):
        files = ['index.html', 'game.js', 'game.css', 'engine.js', 'content/course.js', 'content/media.json']
        payload = content.encode()
        manifest = [{'path': name, 'size': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()} for name in files]
        (self.upload / 'manifest.json').write_text(json.dumps(manifest))
        with tarfile.open(self.upload / 'web.tar.gz', 'w:gz') as archive:
            for name in files:
                member = tarfile.TarInfo(name)
                member.size = len(payload)
                archive.addfile(member, io.BytesIO(payload))

    def test_publish_then_rollback_restores_previous_files(self):
        self.bundle('original')
        publisher.publish(self.upload, None)
        first = publisher.current_target()
        self.bundle('updated')
        publisher.publish(self.upload, first)
        self.assertEqual((publisher.PUBLIC / 'index.html').read_text(), 'updated')
        publisher.rollback(publisher.current_target())
        self.assertEqual((publisher.PUBLIC / 'index.html').read_text(), 'original')

    def test_bad_checksum_and_failed_http_leave_current_site_unchanged(self):
        self.bundle('original')
        publisher.publish(self.upload, None)
        current = publisher.current_target()
        self.bundle('updated')
        manifest = json.loads((self.upload / 'manifest.json').read_text())
        manifest[0]['sha256'] = '0' * 64
        (self.upload / 'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            publisher.publish(self.upload, current)
        self.assertEqual(publisher.current_target(), current)
        self.bundle('updated')
        def failed_http(_):
            raise RuntimeError('simulated health check failure')
        publisher.check_http = failed_http
        with self.assertRaises(RuntimeError):
            publisher.publish(self.upload, current)
        self.assertEqual((publisher.PUBLIC / 'index.html').read_text(), 'original')
        self.assertIsNone(json.loads(publisher.STATE.read_text())['previous'])

    def test_archive_traversal_is_rejected_before_publishing(self):
        self.bundle('data')
        with tarfile.open(self.upload / 'web.tar.gz', 'w:gz') as archive:
            member = tarfile.TarInfo('../outside')
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
        with self.assertRaises(ValueError):
            publisher.publish(self.upload, None)
        self.assertFalse(publisher.PUBLIC.exists())
        self.assertFalse((publisher.STORE / 'outside').exists())


if __name__ == '__main__':
    unittest.main()
