# Upgrade test on a clean Windows runner (release.yml's upgrade gate; the Linux one: packaging/upgrade-test.sh): a user's
# installation of a RELEASED version of a product (its Setup.exe from the releases repository) updates itself with
# Velopack to the new build of the same product and keeps the user's data. The released version is the product's last C#
# release (packaging/products.json, "lastCSharpRelease"), whose C# update code applies the update to the
# TypeScript/Electron build, or a TypeScript release, whose own update code does.
#
#  1. Installs the released Setup.exe silently (as a user with one click), starts the app (--version, --smoke-test).
#  2. User data as the app stores it (%APPDATA%\Codestead\<id>): the learning apps get a state.json (language, theme,
#     a passed exam) and are started normally once, so that the app writes its files itself (state.json, profile.json
#     with the XP it derives, whatsnew.json); the hub gets its settings.
#  3. Serves the new build's feed (velopack-win: releases.win.json, assets.win.json, the full .nupkg – what release.yml
#     publishes) on localhost and lets the INSTALLED app update itself, so the installation's own Update.exe applies the
#     update: a C# release through packaging/upgrade-driver (the C# app's update button: SelfUpdate's calls on
#     Velopack's UpdateManager, the apps' version, with the installed executable as the running app), a TypeScript
#     release through its own update code (Velopack's Node SDK in the installed app, run by its Electron as Node:
#     packaging/ts/update-from-feed.cjs).
#  4. Checks: current\ is the new build (sq.version, resources\app, --version), the uninstall entry has the new
#     version, the Start menu shortcut still starts a working app, --smoke-test, the user data is unchanged and the
#     new app reads it (the same XP in profile.json, the new version in whatsnew.json).
#  5. TS -> TS: the build repacked as the next version, applied by the new app's own update code (update-from-feed.cjs).
#  6. Uninstalls silently.
# The updater runs with --silent (no progress window, and no error dialog that would wait on the runner); otherwise the
# calls are the apps'. Needs gh (GH_TOKEN) or plain HTTPS, python, dotnet for an update from a C# release, and vpk for
# step 5 (-NoChain skips it). -From <version>: the released version to start from (default: the newest release, the
# one <id>-latest's update feed names).
param(
  [Parameter(Mandatory)] [string] $PackageName,
  [Parameter(Mandatory)] [string] $Executable,
  [Parameter(Mandatory)] [string] $DisplayName,
  [Parameter(Mandatory)] [string] $ProductDir,
  [string] $Artifacts = "artifacts",
  [string] $ReleasesRepo = "JesperE98/codestead-releases",
  [string] $From = "",
  [switch] $NoChain
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Artifacts = (Resolve-Path $Artifacts).Path
$temp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$work = Join-Path $temp "upgrade-$PackageName"
Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $work | Out-Null
$py = (Get-Command python -ErrorAction SilentlyContinue) ?? (Get-Command python3)

function Fail([string] $why) { throw "UPGRADE TEST FAILED: $why" }

function Fetch([string] $tag, [string] $file, [string] $dir) {
  if ($env:GH_TOKEN -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    gh release download $tag --repo $ReleasesRepo --pattern $file --dir $dir --clobber
    if ($LASTEXITCODE -ne 0) { Fail "could not download $file from $tag" }
  } else {
    Invoke-WebRequest "https://github.com/$ReleasesRepo/releases/download/$tag/$file" -OutFile (Join-Path $dir $file)
  }
}

function FeedVersion([string] $file) {
  $versions = (Get-Content $file -Raw | ConvertFrom-Json).Assets | Where-Object Type -eq "Full" | ForEach-Object { [version]($_.Version -replace '-.*$', '') }
  ($versions | Sort-Object -Descending | Select-Object -First 1).ToString(3)
}

# Runs an executable and returns its standard output (a GUI-subsystem app too); fails on a non-zero exit code.
function Run([string] $exe, [string[]] $arguments, [int] $timeoutSeconds = 300) {
  $out = Join-Path $work "out.txt"; $err = Join-Path $work "err.txt"
  $p = Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err
  $null = $p.Handle # keeps the process handle, without which ExitCode stays empty
  if (-not $p.WaitForExit($timeoutSeconds * 1000)) { $p.Kill($true); Fail "$exe $arguments did not end within $timeoutSeconds s" }
  $stdout = (Get-Content $out -Raw) ?? ""
  $stderr = (Get-Content $err -Raw) ?? ""
  if ($p.ExitCode -ne 0) { Write-Host $stdout; Write-Host $stderr; Fail "$exe $arguments exited with $($p.ExitCode)" }
  return $stdout.Trim()
}

function LastLine([string] $text) { ($text -split "\r?\n")[-1].Trim() }

function Manifest([string] $dir) { [xml](Get-Content (Join-Path $dir "sq.version") -Raw) }

# Every process started from the installation (the app; Electron's helpers).
function Stop-Installed {
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($installDir, [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -ne "Update" } |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

# Starts the app normally (its window, the user's real data) until $condition holds, then ends it.
function Start-Until([string] $what, [scriptblock] $condition) {
  $p = Start-Process -FilePath $exe -PassThru
  $deadline = (Get-Date).AddSeconds(180)
  while (-not (& $condition)) {
    if ((Get-Date) -gt $deadline) { Stop-Installed; Fail "$what did not write its files in time" }
    if ($p.HasExited -and -not (Get-Process | Where-Object { $_.Path -eq $exe })) { Fail "$what ended before it had written its files" }
    Start-Sleep -Seconds 2
  }
  Start-Sleep -Seconds 2
  Stop-Installed
}

function Snapshot { Get-ChildItem $data -Recurse -File | Sort-Object FullName | ForEach-Object { "$((Get-FileHash $_.FullName).Hash)  $($_.FullName.Substring($data.Length))" } }

function Seen { try { (Get-Content (Join-Path $data "whatsnew.json") -Raw | ConvertFrom-Json).seen } catch { $null } }

# The installation's entry in "Installed apps" (HKCU ...\Uninstall\<key>, its UninstallString runs our Update.exe).
function UninstallEntry {
  Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | Get-ItemProperty |
    Where-Object { $_.UninstallString -and $_.UninstallString.IndexOf($updateExe, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
    Select-Object -First 1
}

function Shortcuts {
  $shell = New-Object -ComObject WScript.Shell
  foreach ($folder in @([Environment]::GetFolderPath("Programs"), [Environment]::GetFolderPath("Desktop"))) {
    Get-ChildItem $folder -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
      $target = $shell.CreateShortcut($_.FullName).TargetPath
      if ($target -and $target.StartsWith($installDir, [StringComparison]::OrdinalIgnoreCase)) { [pscustomobject]@{ Link = $_.FullName; Target = $target } }
    }
  }
}

# The app restarted by the updater (with --smoke-test).
function Restarted {
  Get-CimInstance Win32_Process -Filter "Name = '$Executable.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $exe -and $_.CommandLine -match "--smoke-test" }
}

# Waits until the updater is done, current\ is Velopack version $want and the app it restarted has finished.
function Wait-Update([string] $want) {
  $deadline = (Get-Date).AddSeconds(300)
  $seen = $false
  while ($true) {
    if (-not $seen -and (Restarted)) { $seen = $true }
    $busy = Get-Process -Name Update -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $updateExe }
    $version = try { (Manifest $current).package.metadata.version } catch { "" }
    if (-not $busy -and $version -eq $want) { break }
    if ((Get-Date) -gt $deadline) {
      Get-Content (Join-Path $env:LOCALAPPDATA "velopack\velopack_$PackageName.log") -Tail 60 -ErrorAction SilentlyContinue
      Fail "current\ is still at version '$version' (expected $want)"
    }
    Start-Sleep -Milliseconds 500
  }
  $deadline = (Get-Date).AddSeconds(60)
  while (-not $seen -and (Get-Date) -lt $deadline) { if (Restarted) { $seen = $true } else { Start-Sleep -Milliseconds 500 } }
  Get-Content (Join-Path $env:LOCALAPPDATA "velopack\velopack_$PackageName.log") -Tail 30 -ErrorAction SilentlyContinue
  if (-not $seen) { Fail "the updater did not restart the app" }
  $deadline = (Get-Date).AddSeconds(240)
  while (Restarted) { if ((Get-Date) -gt $deadline) { Fail "the restarted app did not finish its smoke test" }; Start-Sleep -Seconds 2 }
  Write-Host "The updater applied $want and restarted the app (--smoke-test)."
}

function Serve([string] $dir, [int] $port) {
  $server = Start-Process -FilePath $py.Source -ArgumentList "-m", "http.server", $port, "--bind", "127.0.0.1", "--directory", $dir -PassThru -WindowStyle Hidden
  for ($i = 0; $i -lt 50; $i++) {
    try { Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $server } catch { Start-Sleep -Milliseconds 300 }
  }
  Fail "the feed server on port $port did not start"
}

# ---- 1. The released app (C# up to the product's last C# release, TypeScript after it), installed as a user does
$cs = Join-Path $work "cs"; New-Item -ItemType Directory -Force -Path $cs | Out-Null
$v0 = $From
if (-not $v0) {
  Fetch "$PackageName-latest" "releases.win.json" $cs
  $v0 = FeedVersion (Join-Path $cs "releases.win.json")
}
$product = (Get-Content (Join-Path $root "packaging\products.json") -Raw | ConvertFrom-Json).products | Where-Object id -eq $PackageName
if (-not $product) { Fail "$PackageName is not in packaging/products.json" }
$fromCSharp = [version]$v0 -le [version]$product.lastCSharpRelease
$old = if ($fromCSharp) { "C# app" } else { "released TypeScript app" }
$setupName = "$PackageName-$v0-win-x64-Setup.exe"
Fetch "$PackageName-v$v0" $setupName $cs
$v1 = FeedVersion (Join-Path $Artifacts "velopack-win\releases.win.json")
Write-Host "Released ($old): $PackageName $v0 ($setupName); new build: $v1"
if ([version]$v1 -le [version]$v0) { Fail "the new build ($v1) must have a higher version than the released one ($v0) (packaging/plan.py)" }

$installDir = Join-Path $env:LOCALAPPDATA $PackageName
$current = Join-Path $installDir "current"
$exe = Join-Path $current "$Executable.exe"
$updateExe = Join-Path $installDir "Update.exe"
Write-Host "=== 1. Installing the released $setupName"
$p = Start-Process -FilePath (Join-Path $cs $setupName) -ArgumentList "--silent" -PassThru -Wait
if ($p.ExitCode -ne 0) { Fail "Setup failed with exit code $($p.ExitCode)" }
Start-Sleep -Seconds 3
Stop-Installed # in case Setup started it
if (-not (Test-Path $exe)) { Fail "the $old was not installed at $exe" }
$m = Manifest $current
Write-Host "Installed: $($m.package.metadata.id) $($m.package.metadata.version) (channel $($m.package.metadata.channel), $($m.package.metadata.mainExe))"
if ($m.package.metadata.version -ne $v0) { Fail "the installed version is not $v0" }
$channel = $m.package.metadata.channel; $mainExe = $m.package.metadata.mainExe
if ((UninstallEntry).DisplayVersion -ne $v0) { Fail "the uninstall entry does not say $v0" }
$links = @(Shortcuts)
$links | Format-Table -AutoSize | Out-String | Write-Host
if ($links.Count -eq 0) { Fail "no shortcut to the installed app" }
if ((Test-Path (Join-Path $current "$Executable.dll")) -ne $fromCSharp) { Fail "the installed $v0 is not a $old, as packaging/products.json's lastCSharpRelease says" }
$version = LastLine (Run $exe @("--version"))
Write-Host "--version: $version"
if ($version -ne $v0) { Fail "the $old's --version is not $v0" }
$env:CODESTEAD_DATA_DIR = Join-Path $work "smoke-cs"
$out = Run $exe @("--smoke-test"); Write-Host $out
Remove-Item Env:CODESTEAD_DATA_DIR
if ($out -notmatch "SMOKE OK") { Fail "the $old's smoke test did not print SMOKE OK" }

# ---- 2. User data, as the released app stores it
Write-Host "=== 2. User data"
$data = Join-Path $env:APPDATA "Codestead\$PackageName"
# A fresh user's folder (in case the setup program's own start of the app wrote something).
Stop-Installed
Remove-Item -Recurse -Force $data -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $data | Out-Null
$exam = Get-ChildItem (Join-Path $root "$ProductDir\content\chapters\en") -Filter "*-exam.md" -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 1
if ($exam) {
  $examId = $exam.BaseName
  Set-Content -Path (Join-Path $data "state.json") -Value "{`"lang`":`"sv`",`"theme`":`"dark`",`"exams`":{`"$examId`":100}}" -NoNewline -Encoding utf8NoBOM
  Start-Until "The $old" { (Test-Path (Join-Path $data "profile.json")) -and (Seen) -eq $v0 }
  $csProfile = Get-Content (Join-Path $data "profile.json") -Raw | ConvertFrom-Json
  Write-Host "The $old wrote: $((Get-ChildItem $data).Name -join ', '); XP $($csProfile.xp); state.json: $(Get-Content (Join-Path $data 'state.json') -Raw)"
  if ($csProfile.xp -lt 150) { Fail "the $old did not count the seeded exam (XP $($csProfile.xp))" }
} else {
  Set-Content -Path (Join-Path $data "state.json") -NoNewline -Encoding utf8NoBOM `
    -Value '{"lang":"sv","theme":"dark","hideOnToolOpen":false,"closeToTray":true,"autoCheckUpdates":false,"autoInstallUpdates":true}'
}
$before = Snapshot
$before | Write-Host

# ---- 3. The installed app updates itself (local feed)
Write-Host "=== 3. The installed $old updates itself to $v1"
$feed1 = Join-Path $work "feed1"; New-Item -ItemType Directory -Force -Path $feed1 | Out-Null
Copy-Item (Join-Path $Artifacts "velopack-win\releases.win.json"), (Join-Path $Artifacts "velopack-win\assets.win.json") $feed1
Copy-Item (Join-Path $Artifacts "velopack-win\*.nupkg") $feed1
$server1 = Serve $feed1 8471
# The updater restarts the app with --smoke-test, in a data folder of its own (it inherits the environment).
$env:CODESTEAD_DATA_DIR = Join-Path $work "smoke-restart"
if ($fromCSharp) {
  $driver = Join-Path $work "driver"
  dotnet publish (Join-Path $root "packaging\upgrade-driver") -c Release -r win-x64 --self-contained -o $driver -v quiet -nologo
  if ($LASTEXITCODE -ne 0) { Fail "building the upgrade driver failed" }
  if ((Get-FileHash (Join-Path $current "Velopack.dll")).Hash -eq (Get-FileHash (Join-Path $driver "Velopack.dll")).Hash) {
    Write-Host "The driver runs the same Velopack.dll as the installed app."
  } else { Write-Host "Note: the installed app's Velopack.dll differs from the driver's (another Velopack version)." }
  $out = Run (Join-Path $driver "Codestead.UpgradeDriver.exe") @("--app", $exe, "--feed", "http://127.0.0.1:8471/", "--expect", $v1, "--silent", "--", "--smoke-test")
} else {
  # The installed TypeScript app's own update code (its Electron as Node, its velopack module).
  $env:ELECTRON_RUN_AS_NODE = "1"
  $out = Run $exe @((Join-Path $root "packaging\ts\update-from-feed.cjs"), "--feed", "http://127.0.0.1:8471/", "--expect", $v1, "--silent", "--", "--smoke-test")
  Remove-Item Env:ELECTRON_RUN_AS_NODE
}
Remove-Item Env:CODESTEAD_DATA_DIR
Write-Host $out
Wait-Update $v1
Stop-Installed

# ---- 4. The installation is the new build
Write-Host "=== 4. The installed app is now the new build"
$m = Manifest $current
Write-Host "Installed: $($m.package.metadata.id) $($m.package.metadata.version) (channel $($m.package.metadata.channel), $($m.package.metadata.mainExe))"
if ($m.package.metadata.id -ne $PackageName -or $m.package.metadata.channel -ne $channel -or $m.package.metadata.mainExe -ne $mainExe) {
  Fail "the update has another id, channel or main executable"
}
$appPackage = Get-Content (Join-Path $current "resources\app\package.json") -Raw | ConvertFrom-Json
if ($appPackage.version -ne $v1) { Fail "resources\app is not $v1" }
if (Test-Path (Join-Path $current "$Executable.dll")) { Fail "a C# app's files are still in current\" }
$entry = UninstallEntry
Write-Host "Uninstall entry: $($entry.DisplayName) $($entry.DisplayVersion); $($entry.UninstallString)"
if ($entry.DisplayVersion -ne $v1) { Fail "the uninstall entry still says $($entry.DisplayVersion)" }
$links = @(Shortcuts)
$links | Format-Table -AutoSize | Out-String | Write-Host
if ($links.Count -eq 0) { Fail "the shortcuts to the app are gone" }
foreach ($link in $links) {
  if (-not (Test-Path $link.Target)) { Fail "$($link.Link) points to $($link.Target), which does not exist" }
  if ($link.Target -eq $exe -and (LastLine (Run $link.Target @("--version"))) -ne $v1) { Fail "$($link.Link) does not start $v1" }
}
$version = LastLine (Run $exe @("--version"))
Write-Host "--version: $version"
if ($version -ne $v1) { Fail "--version is not $v1 after the update" }
$env:CODESTEAD_DATA_DIR = Join-Path $work "smoke-ts"
$out = Run $exe @("--smoke-test"); Write-Host $out
Remove-Item Env:CODESTEAD_DATA_DIR
if ($out -notmatch "SMOKE OK .* $([regex]::Escape($v1)) ") { Fail "no SMOKE OK from $v1" }
$after = Snapshot
if (Compare-Object @($before) @($after)) { $after | Write-Host; Fail "the user data changed during the update" }
Write-Host "The user data is unchanged."
if ($exam) {
  $profileTime = (Get-Item (Join-Path $data "profile.json")).LastWriteTimeUtc
  Start-Until "The new app" { (Get-Item (Join-Path $data "profile.json")).LastWriteTimeUtc -ne $profileTime -and (Seen) -eq $v1 }
  $tsProfile = Get-Content (Join-Path $data "profile.json") -Raw | ConvertFrom-Json
  $state = Get-Content (Join-Path $data "state.json") -Raw | ConvertFrom-Json
  Write-Host "The new app wrote: $((Get-ChildItem $data).Name -join ', '); XP $($tsProfile.xp); state.json: $(Get-Content (Join-Path $data 'state.json') -Raw)"
  if ($tsProfile.xp -ne $csProfile.xp) { Fail "the new app derived XP $($tsProfile.xp) from the $old's data, the $old $($csProfile.xp)" }
  $unlocked = { param($p) (@($p.achievements | Where-Object unlockedAt | ForEach-Object id) | Sort-Object) -join "," }
  if ((& $unlocked $tsProfile) -ne (& $unlocked $csProfile)) { Fail "the new app has other achievements than the $old" }
  if ($state.lang -ne "sv" -or $state.theme -ne "dark" -or $state.exams.$examId -ne 100) { Fail "state.json lost the $old's settings or progress" }
  Write-Host "The new app read the $old's data: XP $($tsProfile.xp), the same achievements; whatsnew.json: $v1"
} else {
  $out = Run $exe @("--smoke-test"); Write-Host $out
  if ($out -notmatch "SMOKE OK") { Fail "the hub's smoke test with the released hub's settings failed" }
  if (Compare-Object @($before) @(Snapshot)) { Fail "the hub's settings changed" }
}
Stop-Process $server1 -ErrorAction SilentlyContinue

# ---- 5. TS -> TS with the TypeScript app's own update code
$v2 = $null
if (-not $NoChain) {
  $v2 = "{0}.{1}.{2}" -f ([version]$v1).Major, ([version]$v1).Minor, (([version]$v1).Build + 1)
  Write-Host "=== 5. $v1 -> $v2 with the new app's own update code"
  $before = Snapshot
  $pack = Join-Path $work "pack2"
  Expand-Archive (Join-Path $Artifacts "$PackageName-$v1-win-x64.zip") -DestinationPath $pack -Force
  $vp2 = Join-Path $work "vpk2"
  vpk pack --packId $PackageName --packVersion $v2 --packDir $pack --mainExe "$Executable.exe" --packTitle $DisplayName `
    --icon (Join-Path $root "build\icons\$PackageName.ico") --outputDir $vp2 --runtime win-x64 --skipVeloAppCheck
  if ($LASTEXITCODE -ne 0) { Fail "vpk pack $v2 failed" }
  $feed2 = Join-Path $work "feed2"; New-Item -ItemType Directory -Force -Path $feed2 | Out-Null
  Copy-Item (Join-Path $vp2 "releases.win.json"), (Join-Path $vp2 "assets.win.json") $feed2
  Copy-Item (Join-Path $vp2 "*.nupkg") $feed2
  $server2 = Serve $feed2 8472
  $env:ELECTRON_RUN_AS_NODE = "1"
  $env:CODESTEAD_DATA_DIR = Join-Path $work "smoke-restart2"
  $out = Run $exe @((Join-Path $root "packaging\ts\update-from-feed.cjs"), "--feed", "http://127.0.0.1:8472/", "--expect", $v2, "--silent", "--", "--smoke-test")
  Remove-Item Env:ELECTRON_RUN_AS_NODE, Env:CODESTEAD_DATA_DIR
  Write-Host $out
  Wait-Update $v2
  Stop-Installed
  if ((UninstallEntry).DisplayVersion -ne $v2) { Fail "the uninstall entry does not say $v2" }
  $env:CODESTEAD_DATA_DIR = Join-Path $work "smoke-ts2"
  $out = Run $exe @("--smoke-test"); Write-Host $out
  Remove-Item Env:CODESTEAD_DATA_DIR
  if ($out -notmatch "SMOKE OK") { Fail "no SMOKE OK after the second update" }
  if (Compare-Object @($before) @(Snapshot)) { Fail "the user data changed during the second update" }
  Write-Host "Velopack version $v2 (the same build repacked), the user data is unchanged."
  Stop-Process $server2 -ErrorAction SilentlyContinue
}

# ---- 6. Uninstall
Write-Host "=== 6. Uninstalling"
$p = Start-Process -FilePath $updateExe -ArgumentList "--uninstall", "--silent" -PassThru -Wait
if ($p.ExitCode -ne 0) { Fail "uninstall failed with exit code $($p.ExitCode)" }
Start-Sleep -Seconds 3
if (Test-Path $exe) { Fail "the app is still installed after uninstalling" }
if (UninstallEntry) { Fail "the uninstall entry is still there" }
if (@(Shortcuts).Count -gt 0) { Fail "shortcuts are left after uninstalling" }
Write-Host "User data after uninstalling: $(if (Test-Path $data) { (Get-ChildItem $data).Name -join ', ' } else { 'removed' })"
Write-Host "UPGRADE TEST OK ($PackageName`: $(if ($fromCSharp) { 'C#' } else { 'TypeScript' }) $v0 -> $v1$(if ($v2) { " -> $v2" }), Setup.exe)"
