# Builds the Windows artifacts for one Codestead tool: an installer (Velopack Setup.exe) and a portable .zip.
# Usage: packaging/build-windows.ps1 -Project src/Codestead.Linux/Codestead.Linux.csproj -PackageName codestead-linux -DisplayName "Codestead Linux" -Version 0.4.0
param(
  [Parameter(Mandatory)] [string] $Project,
  [Parameter(Mandatory)] [string] $PackageName,
  [Parameter(Mandatory)] [string] $DisplayName,
  [Parameter(Mandatory)] [string] $Version,
  [string] $Out = "artifacts"
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$exe = [IO.Path]::GetFileNameWithoutExtension($Project)
$publish = Join-Path $root "obj/publish/$PackageName-win-x64"
$vp = Join-Path $root "obj/packaging/$PackageName/velopack-win"
Remove-Item -Recurse -Force $publish, $vp -ErrorAction SilentlyContinue

dotnet publish $Project -c Release -r win-x64 --self-contained true -p:Version=$Version -o $publish
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

Compress-Archive -Path (Join-Path $publish "*") -DestinationPath (Join-Path $Out "$PackageName-$Version-win-x64.zip") -Force

vpk pack --packId $PackageName --packVersion $Version --packDir $publish --mainExe "$exe.exe" `
  --packTitle $DisplayName --icon build/icon.ico --outputDir $vp --runtime win-x64
if ($LASTEXITCODE -ne 0) { throw "vpk pack failed" }
$setup = Get-ChildItem $vp -Filter "*Setup.exe" | Select-Object -First 1
if (-not $setup) { throw "vpk did not create a Setup.exe" }
Copy-Item $setup.FullName (Join-Path $Out "$PackageName-$Version-win-x64-Setup.exe")
New-Item -ItemType Directory -Force -Path (Join-Path $Out "velopack-win") | Out-Null
Copy-Item (Join-Path $vp "*") (Join-Path $Out "velopack-win")
Get-ChildItem $Out
