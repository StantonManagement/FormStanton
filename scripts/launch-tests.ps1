$envLines = Get-Content '.env.local' -ErrorAction SilentlyContinue
$adminPwd = $null; $usr = $null

foreach ($line in $envLines) {
    if ($line -match '^ADMIN_PASSWORD=(.+)$' -and $line -notmatch '^ADMIN_PASSWORD_HASH') {
        $adminPwd = $Matches[1].Trim()
    }
    if ($line -match '^ADMIN_USERNAME=(.+)$') {
        $usr = $Matches[1].Trim()
    }
}

if (-not $adminPwd) {
    foreach ($line in $envLines) {
        if ($line -match '^ADMIN_PASSWORD_HASH=(.+)$') {
            $adminPwd = $Matches[1].Trim(); break
        }
    }
}

if (-not $adminPwd) {
    Write-Host 'ERROR: ADMIN_PASSWORD / ADMIN_PASSWORD_HASH not found in .env.local' -ForegroundColor Red
    exit 1
}

$cmdArgs = @('-ExecutionPolicy', 'Bypass', '-File', 'scripts/run-foundation-tests.ps1', '-Password', $adminPwd)
if ($usr) { $cmdArgs += @('-Username', $usr) }

& powershell @cmdArgs
exit $LASTEXITCODE
