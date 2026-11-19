# Builds the Windows artifacts for one Codestead tool: an installer (Velopack Setup.exe) and a portable .zip.
# Usage: packaging/build-windows.ps1 -App ts/apps/linux -PackageName codestead-linux -DisplayName "Codestead Linux" -Executable Codestead.Linux -Version 0.6.6
#   (the values of the product in packaging/products.json; release.yml passes them from packaging/plan.py).
#   packaging/ts/package-app.mjs builds the TypeScript/Electron app and makes the app folder the installer is made of.
# Needs: node and the npm workspace in ts/ installed (npm ci), vpk (dotnet tool install -g vpk).
param(
  [Parameter(Mandatory)] [string] $App,
  [Parameter(Mandatory)] [string] $PackageName,
  [Parameter(Mandatory)] [string] $DisplayName,
  [Parameter(Mandatory)] [string] $Executable,
  [Parameter(Mandatory)] [string] $Version,
  [string] $Out = "artifacts"
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$publish = Join-Path $root "obj/publish/$PackageName-win-x64"
$vp = Join-Path $root "obj/packaging/$PackageName/velopack-win"
Remove-Item -Recurse -Force $publish, $vp -ErrorAction SilentlyContinue

node packaging/ts/package-app.mjs --app $App --id $PackageName --name $DisplayName --exe $Executable --version $Version --platform win32 --out $publish
if ($LASTEXITCODE -ne 0) { throw "packaging the app failed" }

Compress-Archive -Path (Join-Path $publish "*") -DestinationPath (Join-Path $Out "$PackageName-$Version-win-x64.zip") -Force

# VelopackApp.build().run() is in the app's JavaScript (dist-electron/main.cjs), where vpk cannot look for it
# (ts/packages/ui/test/SelfUpdateTests.test.ts checks that every app calls it first).
vpk pack --packId $PackageName --packVersion $Version --packDir $publish --mainExe "$Executable.exe" `
  --packTitle $DisplayName --icon "build/icons/$PackageName.ico" --outputDir $vp --runtime win-x64 --skipVeloAppCheck
if ($LASTEXITCODE -ne 0) { throw "vpk pack failed" }
$setup = Get-ChildItem $vp -Filter "*Setup.exe" | Select-Object -First 1
if (-not $setup) { throw "vpk did not create a Setup.exe" }
Copy-Item $setup.FullName (Join-Path $Out "$PackageName-$Version-win-x64-Setup.exe")
New-Item -ItemType Directory -Force -Path (Join-Path $Out "velopack-win") | Out-Null
Copy-Item (Join-Path $vp "*") (Join-Path $Out "velopack-win")
Get-ChildItem $Out
