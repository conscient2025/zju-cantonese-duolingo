param(
    [string]$Server = 'admin@118.178.91.193',
    [string]$KeyPath = "$env:USERPROFILE\Downloads\root.pem",
    [ValidateRange(1, 65535)][int]$Port = 22,
    [switch]$Rollback
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedKey = (Resolve-Path -LiteralPath $KeyPath).Path
if ($Server -notmatch '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+$') { throw 'Invalid SSH server address.' }
$sshOptions = @('-i', $resolvedKey, '-p', "$Port", '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15')
$scpOptions = @('-i', $resolvedKey, '-P', "$Port", '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15')

if (-not $Rollback) {
    & node (Join-Path $PSScriptRoot 'check.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Project checks failed; nothing uploaded.' }
    $buildDir = Join-Path $projectRoot '.artifact-build/ota'
    New-Item -ItemType Directory -Force $buildDir | Out-Null
    $distPath = (Resolve-Path -LiteralPath (Join-Path $projectRoot 'dist')).Path
    $manifest = @(Get-ChildItem -LiteralPath $distPath -File -Recurse -Force | ForEach-Object {
        [pscustomobject]@{
            path = $_.FullName.Substring($distPath.Length + 1).Replace('\', '/')
            size = $_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    $manifestPath = Join-Path $buildDir 'manifest.json'
    [IO.File]::WriteAllText($manifestPath, (ConvertTo-Json -InputObject $manifest -Depth 4), [Text.UTF8Encoding]::new($false))
    $archivePath = Join-Path $buildDir 'web.tar.gz'
    & tar -czf $archivePath -C $distPath .
    if ($LASTEXITCODE -ne 0) { throw 'Creating upload archive failed.' }
}

$remoteDir = & ssh @sshOptions $Server 'mktemp -d /tmp/zju-yue-upload.XXXXXXXX'
if ($LASTEXITCODE -ne 0) { throw 'SSH connection failed.' }
$remoteDir = ($remoteDir | Out-String).Trim()
if ($remoteDir -notmatch '^/tmp/zju-yue-upload\.[a-zA-Z0-9]+$') { throw 'Unexpected staging directory response.' }
$files = @((Join-Path $projectRoot 'deploy/publish.py'))
if (-not $Rollback) { $files += @($archivePath, $manifestPath) }
& scp @scpOptions @files "${Server}:${remoteDir}/"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed; the live website was not switched.' }
$operation = if ($Rollback) { 'rollback' } else { 'publish' }
& ssh @sshOptions $Server "sudo -n python3 $remoteDir/publish.py $operation $remoteDir"
if ($LASTEXITCODE -ne 0) { throw "Remote operation failed. Uploaded files, if needed for inspection: $remoteDir" }
Write-Output 'Done: https://conscient.hk.cn/yue/'
