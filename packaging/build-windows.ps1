# Builds the Windows artifacts for one Codestead tool: an installer (Velopack Setup.exe) and a portable .zip.
# Usage: packaging/build-windows.ps1 -Project src/Linux/Codestead.Linux/Codestead.Linux.csproj -PackageName codestead-linux -DisplayName "Codestead Linux" -Version 0.4.0
#   -TsApp ts/apps/linux: the TypeScript/Electron app instead of the C# project (docs/TYPESCRIPT-MIGRATION.md): the same
#   artifacts, names and package id, from the app folder packaging/ts/package-app.mjs makes; the C# project still names
#   the executable.
param(
  [Parameter(Mandatory)] [string] $Project,
  [Parameter(Mandatory)] [string] $PackageName,
  [Parameter(Mandatory)] [string] $DisplayName,
  [Parameter(Mandatory)] [string] $Version,
  [string] $Out = "artifacts",
  [string] $TsApp = ""
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$exe = [IO.Path]::GetFileNameWithoutExtension($Project)
$publish = Join-Path $root "obj/publish/$PackageName-win-x64"
$vp = Join-Path $root "obj/packaging/$PackageName/velopack-win"
Remove-Item -Recurse -Force $publish, $vp -ErrorAction SilentlyContinue

$vpkExtra = @()
if ($TsApp) {
  node packaging/ts/package-app.mjs --app $TsApp --id $PackageName --name $DisplayName --exe $exe --version $Version --platform win32 --out $publish
  if ($LASTEXITCODE -ne 0) { throw "packaging the TypeScript app failed" }
  # VelopackApp.build().run() is in the app's JavaScript (dist-electron/main.cjs), where vpk cannot look for it.
  $vpkExtra = @("--skipVeloAppCheck")
} else {
  dotnet publish $Project -c Release -r win-x64 --self-contained true -p:Version=$Version -o $publish
  if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
}

Compress-Archive -Path (Join-Path $publish "*") -DestinationPath (Join-Path $Out "$PackageName-$Version-win-x64.zip") -Force

vpk pack --packId $PackageName --packVersion $Version --packDir $publish --mainExe "$exe.exe" `
  --packTitle $DisplayName --icon "build/icons/$PackageName.ico" --outputDir $vp --runtime win-x64 @vpkExtra
if ($LASTEXITCODE -ne 0) { throw "vpk pack failed" }
$setup = Get-ChildItem $vp -Filter "*Setup.exe" | Select-Object -First 1
if (-not $setup) { throw "vpk did not create a Setup.exe" }
Copy-Item $setup.FullName (Join-Path $Out "$PackageName-$Version-win-x64-Setup.exe")
New-Item -ItemType Directory -Force -Path (Join-Path $Out "velopack-win") | Out-Null
Copy-Item (Join-Path $vp "*") (Join-Path $Out "velopack-win")
Get-ChildItem $Out
