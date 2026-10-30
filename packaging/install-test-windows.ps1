# Installation test on a clean Windows runner: installs with the setup program (silently, as a user
# would with one click), starts the installed app with --smoke-test, uninstalls it, then repeats the
# smoke test with the portable .zip.
param(
  [Parameter(Mandatory)] [string] $PackageName,
  [Parameter(Mandatory)] [string] $Executable,
  [string] $Artifacts = "artifacts"
)
$ErrorActionPreference = "Stop"
$env:CODESTEAD_DATA_DIR = Join-Path $env:RUNNER_TEMP "codestead-smoke"

function Invoke-Smoke([string] $exe) {
  $out = Join-Path $env:RUNNER_TEMP "smoke-out.txt"
  $err = Join-Path $env:RUNNER_TEMP "smoke-err.txt"
  $p = Start-Process -FilePath $exe -ArgumentList "--smoke-test" -PassThru -Wait -NoNewWindow `
    -RedirectStandardOutput $out -RedirectStandardError $err
  $stdout = Get-Content $out -Raw
  Write-Host $stdout
  Write-Host (Get-Content $err -Raw)
  if ($p.ExitCode -ne 0 -or $stdout -notmatch "SMOKE OK") { throw "Smoke test failed for $exe (exit $($p.ExitCode))" }
}

# 1. The installer
$setup = Get-ChildItem $Artifacts -Filter "$PackageName-*-win-x64-Setup.exe" | Select-Object -First 1
if (-not $setup) { throw "No setup program found" }
Write-Host "--- Installing $($setup.Name)"
$p = Start-Process -FilePath $setup.FullName -ArgumentList "--silent" -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Setup failed with exit code $($p.ExitCode)" }
$installDir = Join-Path $env:LOCALAPPDATA $PackageName
$exe = Join-Path $installDir "current\$Executable.exe"
if (-not (Test-Path $exe)) { throw "The app was not installed at $exe" }
$shortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "*.lnk"
Write-Host "Start menu shortcuts: $((Get-ChildItem $shortcut -ErrorAction SilentlyContinue).Name -join ', ')"
Invoke-Smoke $exe

Write-Host "--- Uninstalling"
$update = Join-Path $installDir "Update.exe"
$p = Start-Process -FilePath $update -ArgumentList "--uninstall", "--silent" -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Uninstall failed with exit code $($p.ExitCode)" }
Start-Sleep -Seconds 3
if (Test-Path $exe) { throw "The app is still installed after uninstalling" }

# 2. The portable zip
$zip = Get-ChildItem $Artifacts -Filter "$PackageName-*-win-x64.zip" | Select-Object -First 1
$dir = Join-Path $env:RUNNER_TEMP "portable"
Expand-Archive $zip.FullName -DestinationPath $dir -Force
Invoke-Smoke (Join-Path $dir "$Executable.exe")
Write-Host "INSTALL TEST OK (Windows)"
