#!/usr/bin/env bash
# Upgrade test (docs/TYPESCRIPT-MIGRATION.md, phase 6): a user's AppImage of the latest RELEASED C# version of a product
# updates itself with Velopack to the TypeScript/Electron build of the same product, and keeps the user's data.
#
# Usage (on the host; needs docker, dotnet, python3, and gh with GH_TOKEN or curl; vpk and mksquashfs for TS -> TS):
#   packaging/upgrade-test.sh <package-id> <executable> "<display name>" <product-dir> <ts-artifacts-dir> [image]
#   e.g. packaging/upgrade-test.sh codestead-linux Codestead.Linux "Codestead Linux" src/Linux artifacts ubuntu:24.04
#   <product-dir>: the product's folder in the repository (its course: src/<x>/content/chapters).
#   <ts-artifacts-dir>: what packaging/build-linux.sh --ts made: the portable .tar.gz and velopack-linux/ (the feed).
#   UPGRADE_TS_CHAIN=0 skips step 5 (TS -> TS).
#
# 1. Downloads the released C# AppImage from the releases repository (the version that <id>-latest's update feed
#    names), exactly what users have; nothing of C# is rebuilt.
# 2. In a clean container: puts it in ~/Applications, starts it (--version, --smoke-test) and gives it user data: the
#    learning apps get a state.json (language, theme, a passed exam) and are started normally once, so that the C# app
#    itself writes its files (state.json, profile.json with the XP it derives from them, whatsnew.json); the hub gets
#    its settings (state.json).
# 3. Serves the TypeScript build's update feed (releases.linux.json, assets.linux.json and the full .nupkg – what
#    release.yml publishes to <id>-latest) on localhost and lets the INSTALLED C# app update itself to it:
#    packaging/upgrade-driver is the app's update button without its window (Codestead.UI.SelfUpdate's calls on
#    Velopack's UpdateManager, the apps' package and version) with the installed AppImage as the app being updated,
#    so the AppImage's own UpdateNix applies the update and restarts the app, as when the user clicks "Update".
# 4. Checks: the AppImage (the same file) is now the TypeScript build (sq.version, launcher and Electron, --version),
#    it starts (--smoke-test), the user data is unchanged, and the TypeScript app reads it (started normally, it
#    writes the same XP into profile.json as the C# app derived, and marks the new version as seen in whatsnew.json).
# 5. TS -> TS: the TypeScript build repacked as the next version and applied by the TypeScript app's own update code
#    (Velopack's Node SDK in the installed app, run by its Electron as Node: packaging/ts/update-from-feed.cjs).
# The feeds are local; nothing is applied from the real update feed.
set -euo pipefail

host() {
  local id="$1" exe="$2" name="$3" product_dir="$4" ts="$5" image="${6:-ubuntu:24.04}"
  local repo="${RELEASES_REPO:-JesperE98/codestead-releases}"
  local root; root="$(cd "$(dirname "$0")/.." && pwd)"
  ts="$(cd "$ts" && pwd)"
  local work="${UPGRADE_WORK:-$root/obj/upgrade-test/$id}"
  rm -rf "$work"
  mkdir -p "$work/cs"

  fetch() { # <tag> <file> <dir>: a public release asset (gh with the workflow's token in CI, plain HTTPS otherwise)
    if [[ -n "${GH_TOKEN:-}" ]] && command -v gh >/dev/null; then
      gh release download "$1" --repo "$repo" --pattern "$2" --dir "$3" --clobber
    else
      curl -sSfL --retry 3 -o "$3/$2" "https://github.com/$repo/releases/download/$1/$2"
    fi
  }

  # 1. The released C# AppImage.
  fetch "$id-latest" releases.linux.json "$work/cs"
  local v0; v0=$(feed_version "$work/cs/releases.linux.json")
  local cs_file="$id-$v0-linux-x86_64.AppImage"
  fetch "$id-v$v0" "$cs_file" "$work/cs"
  echo "Released C#: $id $v0 ($cs_file, $(stat -c %s "$work/cs/$cs_file") bytes)"

  # The TypeScript build's feed, as release.yml publishes it to <id>-latest.
  local v1; v1=$(feed_version "$ts/velopack-linux/releases.linux.json")
  if ! newer "$v1" "$v0"; then
    echo "The TypeScript build ($v1) must have a higher version than the released C# one ($v0) (packaging/ts/products.py)." >&2
    exit 1
  fi
  mkdir -p "$work/feed1"
  cp "$ts/velopack-linux/releases.linux.json" "$ts/velopack-linux/assets.linux.json" "$ts"/velopack-linux/*.nupkg "$work/feed1/"
  echo "TypeScript feed: $(cd "$work/feed1" && echo *)"

  # 5.'s feed: the same build repacked as the next version (its --version stays $v1; Velopack's version is $v2).
  local v2=""
  if [[ "${UPGRADE_TS_CHAIN:-1}" != 0 ]]; then
    v2="${v1%.*}.$((${v1##*.} + 1))"
    mkdir -p "$work/pack2"
    tar -xzf "$ts/$id-$v1-linux-x64.tar.gz" -C "$work/pack2"
    vpk pack --packId "$id" --packVersion "$v2" --packDir "$work/pack2" --mainExe "$exe" --packTitle "$name" \
      --icon "$root/build/icons/$id.png" --outputDir "$work/vpk2" --runtime linux-x64
    mkdir -p "$work/feed2"
    cp "$work/vpk2/releases.linux.json" "$work/vpk2/assets.linux.json" "$work"/vpk2/*.nupkg "$work/feed2/"
    rm -rf "$work/pack2" "$work/vpk2"
  fi

  # The C# app's update button, self-contained (the container has no .NET).
  dotnet publish "$root/packaging/upgrade-driver" -c Release -r linux-x64 --self-contained -o "$work/driver" -v quiet -nologo

  # The learning apps' seeded state has a passed exam: the first exam of the product's course (none: the hub).
  local exam=""
  if [[ -d "$root/$product_dir/content/chapters/en" ]]; then
    exam=$(find "$root/$product_dir/content/chapters/en" -maxdepth 1 -name '*-exam.md' -printf '%f\n' | sort | head -1)
    exam="${exam%.md}"
  fi

  docker run --rm -v "$work:/work" -v "$root/packaging:/packaging:ro" "$image" \
    bash /packaging/upgrade-test.sh --inside "$id" "$exe" "$v0" "$v1" "$v2" "$exam"
}

# The newest full release in a Velopack feed file (releases.<channel>.json).
feed_version() {
  python3 -c 'import json,sys; v=[a["Version"] for a in json.load(open(sys.argv[1]))["Assets"] if a["Type"]=="Full"]; print(max(v, key=lambda s: [int(p) for p in s.split("-")[0].split(".")]))' "$1"
}
newer() { [[ "$1" != "$2" && "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" == "$1" ]]; }

# --- In the container -------------------------------------------------------------------------------------------------

install_deps() {
  # The C# app's libraries (install-test.sh's .NET AppImage list) and Electron's (its electron list), a display, python.
  if command -v apt-get >/dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    local asound=libasound2 attempt
    for attempt in 1 2 3; do
      apt-get update -qq || true
      apt-cache show libasound2t64 >/dev/null 2>&1 && asound=libasound2t64
      apt-get install -y -qq xvfb xauth python3 procps file libfontconfig1 libx11-6 libice6 libsm6 libxrandr2 libxi6 \
        libxcursor1 libgtk-3-0 libnss3 libgbm1 "$asound" libcups2 libxkbcommon0 libatk-bridge2.0-0 libxcomposite1 \
        libxdamage1 libdrm2 xdg-utils >/dev/null && return 0
      sleep $((attempt * 5))
    done
    return 1
  elif command -v dnf >/dev/null; then
    dnf install -y -q xorg-x11-server-Xvfb python3 procps-ng file fontconfig libX11 libICE libSM libXrandr libXi \
      libXcursor 'libssl.so.3()(64bit)' gtk3 nss mesa-libgbm alsa-lib cups-libs libxkbcommon at-spi2-atk libXcomposite \
      libXdamage libdrm xdg-utils >/dev/null
  else
    echo "No apt-get or dnf in this image" >&2
    return 1
  fi
}

fail() { echo "UPGRADE TEST FAILED: $*" >&2; exit 1; }

# sq.version (Velopack's manifest) inside an AppImage.
manifest() { local d; d=$(mktemp -d); (cd "$d" && "$1" --appimage-extract usr/bin/sq.version >/dev/null) && cat "$d/squashfs-root/usr/bin/sq.version"; rm -rf "$d"; }
manifest_field() { python3 -c 'import re,sys; m=re.search(r"<%s>([^<]*)</%s>" % (sys.argv[1], sys.argv[1]), sys.stdin.read()); print(m.group(1) if m else "")' "$1"; }

# Prints what the app prints for its arguments; fails the test if it does not exit within the time.
run_app() { timeout 240 "$APP" "$@" 2>&1; }

snapshot() { (cd "$DATA" && find . -type f -print0 | sort -z | xargs -0 sha256sum); }

serve() { # <dir> <port>: a local update feed
  python3 -m http.server "$2" --bind 127.0.0.1 --directory "$1" >"/tmp/feed-$2.log" 2>&1 &
  for _ in $(seq 1 50); do
    python3 -c 'import sys,urllib.request; urllib.request.urlopen(sys.argv[1], timeout=1)' "http://127.0.0.1:$2/" 2>/dev/null && return 0
    sleep 0.2
  done
  fail "the feed server on port $2 did not start"
}

# Waits until the updater is done and the AppImage carries Velopack version $1.
wait_for_update() {
  local want="$1" i v=""
  for i in $(seq 1 120); do
    if ! pgrep -f UpdateNix >/dev/null; then
      v=$(manifest "$APP" | manifest_field version || true)
      [[ "$v" == "$want" ]] && return 0
    fi
    sleep 2
  done
  echo "--- velopack log"; cat /tmp/velopack*.log 2>/dev/null || true
  fail "the AppImage is still at version ${v:-?} (expected $want)"
}

# The app restarted by the updater with --smoke-test: its Electron process (the launcher runs <exe>.bin).
restarted() { pgrep -f "usr/bin/$EXE\.bin .*--smoke-test" >/dev/null; }
# Notes when the restarted app shows up (in the background: it may come and go while the update is being waited for).
watch_restart() {
  rm -f /tmp/restart-seen
  ( for _ in $(seq 1 1200); do if restarted; then touch /tmp/restart-seen; exit 0; fi; sleep 0.25; done ) &
  WATCHER=$!
}
# Waits until the restarted app has been seen and has finished.
wait_for_restart() {
  local i
  for i in $(seq 1 60); do [[ -e /tmp/restart-seen ]] && break; sleep 1; done
  [[ -e /tmp/restart-seen ]] || { kill "$WATCHER" 2>/dev/null; return 1; }
  for i in $(seq 1 120); do restarted || return 0; sleep 2; done
  fail "the restarted app did not finish its smoke test"
}

# Starts the app normally (its window, the user's real data), waits until <condition> (a function) holds, ends it.
start_until() {
  local what="$1" condition="$2" pid i
  "$APP" >/tmp/app-run.log 2>&1 &
  pid=$!
  for i in $(seq 1 90); do
    if "$condition"; then break; fi
    if ! kill -0 "$pid" 2>/dev/null; then cat /tmp/app-run.log; fail "$what ended before it had written its files"; fi
    sleep 2
  done
  "$condition" || { cat /tmp/app-run.log; fail "$what did not write its files in time"; }
  sleep 2 # let it finish writing
  kill_tree "$pid" TERM
  for i in $(seq 1 15); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  kill_tree "$pid" KILL
  wait "$pid" 2>/dev/null || true
}

# Ends a process and everything it started (the AppImage's runtime, the app, Electron's helpers).
kill_tree() {
  local p
  for p in $(pgrep -P "$1"); do kill_tree "$p" "$2"; done
  kill "-$2" "$1" 2>/dev/null || true
}

json() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(eval(sys.argv[2], {}, {"d": d}))' "$@"; }
seen() { json "$DATA/whatsnew.json" 'd["seen"]' 2>/dev/null || true; }
# The C# app has written its files: profile.json, and whatsnew.json with its version.
cs_wrote() { [[ -f "$DATA/profile.json" && "$(seen)" == "$V0" ]]; }
# The TypeScript app has rewritten profile.json and marked its version as seen.
ts_wrote() { [[ "$(stat -c %.3Y "$DATA/profile.json")" != "$PROFILE_TIME" && "$(seen)" == "$V1" ]]; }

inside() {
  local id="$1" v0="$3" v1="$4" v2="$5" exam="$6"
  EXE="$2" V0="$3" V1="$4"
  install_deps
  # One display for everything (the updater restarts the app after the driver has exited).
  Xvfb :99 -screen 0 1440x900x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
  export DISPLAY=:99
  # Containers have no FUSE: every start of the AppImage, also the updater's restart, extracts it (same files, same code).
  export APPIMAGE_EXTRACT_AND_RUN=1
  sleep 1

  echo "=== 1. The released C# app $v0, installed as a user does"
  mkdir -p ~/Applications
  APP=~/Applications/"$id-linux-x86_64.AppImage"
  cp "/work/cs/$id-$v0-linux-x86_64.AppImage" "$APP"
  chmod +x "$APP"
  local m; m=$(manifest "$APP")
  echo "$m"
  [[ "$(manifest_field version <<<"$m")" == "$v0" ]] || fail "the released AppImage is not $v0"
  local channel main
  channel=$(manifest_field channel <<<"$m"); main=$(manifest_field mainExe <<<"$m")
  local out; out=$(run_app --version) || { echo "$out"; fail "the C# app's --version failed"; }
  echo "--version: $out"
  [[ "$(tail -1 <<<"$out")" == "$v0" ]] || fail "the C# app's --version is not $v0"
  out=$(CODESTEAD_DATA_DIR=/tmp/smoke-cs run_app --smoke-test) || { echo "$out"; fail "the C# app's smoke test failed"; }
  grep "SMOKE OK" <<<"$out" || { echo "$out"; fail "the C# app did not print SMOKE OK"; }

  echo "=== 2. User data, as the C# app stores it"
  DATA=~/.config/Codestead/"$id"
  mkdir -p "$DATA"
  if [[ -n "$exam" ]]; then
    # Language, theme and a perfect exam; the C# app, started normally, derives XP and achievements from it and writes
    # state.json, profile.json (for the hub) and whatsnew.json (the version whose news were shown).
    printf '{"lang":"sv","theme":"dark","exams":{"%s":100}}' "$exam" >"$DATA/state.json"
    start_until "The C# app" cs_wrote
    cp "$DATA/profile.json" /tmp/profile-cs.json
    local xp; xp=$(json "$DATA/profile.json" 'd["xp"]')
    echo "The C# app wrote: $(ls "$DATA"); XP $xp; state.json: $(cat "$DATA/state.json")"
    (( xp >= 150 )) || fail "the C# app did not count the seeded exam (XP $xp)"
  else
    # The hub's settings (HubState).
    printf '{"lang":"sv","theme":"dark","hideOnToolOpen":false,"closeToTray":true,"autoCheckUpdates":false,"autoInstallUpdates":true}' >"$DATA/state.json"
  fi
  snapshot >/tmp/data-before.txt
  cat /tmp/data-before.txt

  echo "=== 3. The installed C# app updates itself to $v1 (local feed)"
  serve /work/feed1 8471
  # The running app's files, as the AppImage's mount (the locator finds UpdateNix and sq.version there and the
  # AppImage itself through $APPIMAGE, as at a normal start).
  local mnt=/tmp/.mount_cs
  mkdir -p "$mnt" && (cd "$mnt" && "$APP" --appimage-extract >/dev/null)
  if cmp -s "$mnt/squashfs-root/usr/bin/Velopack.dll" /work/driver/Velopack.dll; then
    echo "The driver runs the same Velopack.dll as the installed app."
  else
    echo "Note: the installed app's Velopack.dll differs from the driver's (another Velopack version)."
  fi
  # The updater restarts the app with --smoke-test (with a data folder of its own: it inherits the environment) and
  # inherits the driver's output, so the restarted app's SMOKE OK ends up there too.
  watch_restart
  CODESTEAD_DATA_DIR=/tmp/smoke-restart APPIMAGE="$APP" /work/driver/Codestead.UpgradeDriver --app "$mnt/squashfs-root/usr/bin/$main" \
    --feed http://127.0.0.1:8471/ --expect "$v1" -- --smoke-test >/tmp/update1.log 2>&1 || { cat /tmp/update1.log; fail "the C# app's update did not start"; }
  wait_for_update "$v1"
  wait_for_restart || { cat /tmp/update1.log; fail "the updater did not restart the app"; }
  cat /tmp/update1.log
  grep -q "SMOKE OK.* $v1 " /tmp/update1.log || fail "the app the updater restarted did not print SMOKE OK for $v1"
  echo "The updater applied $v1 and restarted the app, which passed its smoke test."

  echo "=== 4. The installed app is now the TypeScript build"
  m=$(manifest "$APP")
  echo "$m"
  [[ "$(manifest_field id <<<"$m")" == "$id" && "$(manifest_field channel <<<"$m")" == "$channel" && "$(manifest_field mainExe <<<"$m")" == "$main" ]] \
    || fail "the updated AppImage has another id, channel or main executable"
  local x=/tmp/x-ts; rm -rf "$x"; mkdir -p "$x" && (cd "$x" && "$APP" --appimage-extract >/dev/null)
  head -c 2 "$x/squashfs-root/usr/bin/$main" | grep -q '#!' || fail "usr/bin/$main is not the launcher script"
  file "$x/squashfs-root/usr/bin/$main.bin" | grep -q ELF || fail "usr/bin/$main.bin (Electron) is missing"
  [[ "$(json "$x/squashfs-root/usr/bin/resources/app/package.json" 'd["version"]')" == "$v1" ]] || fail "resources/app is not $v1"
  [[ ! -e "$x/squashfs-root/usr/bin/$main.dll" ]] || fail "the C# app's files are still there"
  rm -rf "$x" "$mnt"
  ls /var/tmp/velopack/"$id"/packages/
  out=$(run_app --version) || { echo "$out"; fail "--version failed after the update"; }
  echo "--version: $out"
  [[ "$(tail -1 <<<"$out")" == "$v1" ]] || fail "--version is not $v1 after the update"
  out=$(CODESTEAD_DATA_DIR=/tmp/smoke-ts run_app --smoke-test) || { echo "$out"; fail "the smoke test failed after the update"; }
  grep "SMOKE OK.* $v1 " <<<"$out" || { echo "$out"; fail "no SMOKE OK from $v1"; }
  snapshot | diff /tmp/data-before.txt - || fail "the user data changed during the update"
  echo "The user data is unchanged."
  if [[ -n "$exam" ]]; then
    PROFILE_TIME=$(stat -c %.3Y "$DATA/profile.json")
    start_until "The TypeScript app" ts_wrote
    echo "The TypeScript app wrote: $(ls "$DATA"); state.json: $(cat "$DATA/state.json")"
    [[ "$(json "$DATA/profile.json" 'd["xp"]')" == "$(json /tmp/profile-cs.json 'd["xp"]')" ]] || fail "the TypeScript app derived other XP from the C# data"
    [[ "$(json "$DATA/profile.json" 'sorted(a["id"] for a in d["achievements"] if a.get("unlockedAt"))')" == "$(json /tmp/profile-cs.json 'sorted(a["id"] for a in d["achievements"] if a.get("unlockedAt"))')" ]] \
      || fail "the TypeScript app has other achievements than the C# app"
    [[ "$(json "$DATA/state.json" '(d["lang"], d["theme"], d["exams"])')" == "('sv', 'dark', {'$exam': 100})" ]] || fail "state.json lost the C# app's settings or progress"
    echo "The TypeScript app read the C# app's data: XP $(json "$DATA/profile.json" 'd["xp"]'), the same achievements; whatsnew.json: $v1"
  else
    out=$(run_app --smoke-test) || { echo "$out"; fail "the hub's smoke test with the C# hub's settings failed"; }
    grep "SMOKE OK" <<<"$out"
    snapshot | diff /tmp/data-before.txt - || fail "the hub's settings changed"
  fi

  if [[ -n "$v2" ]]; then
    echo "=== 5. TypeScript $v1 -> $v2 with the TypeScript app's own update code"
    snapshot >/tmp/data-before.txt
    serve /work/feed2 8472
    mnt=/tmp/.mount_ts
    mkdir -p "$mnt" && (cd "$mnt" && "$APP" --appimage-extract >/dev/null)
    # (Velopack's Node SDK does not pass its output on to the updater: the restart is seen as a process.)
    watch_restart
    CODESTEAD_DATA_DIR=/tmp/smoke-restart2 APPIMAGE="$APP" ELECTRON_RUN_AS_NODE=1 "$mnt/squashfs-root/usr/bin/$main.bin" \
      /packaging/ts/update-from-feed.cjs --feed http://127.0.0.1:8472/ --expect "$v2" -- --smoke-test >/tmp/update2.log 2>&1 \
      || { cat /tmp/update2.log; fail "the TypeScript app's update did not start"; }
    wait_for_update "$v2"
    wait_for_restart || { cat /tmp/update2.log; fail "the updater did not restart the app"; }
    cat /tmp/update2.log
    echo "The updater applied $v2 and restarted the app."
    rm -rf "$mnt"
    out=$(CODESTEAD_DATA_DIR=/tmp/smoke-ts2 run_app --smoke-test) || { echo "$out"; fail "the smoke test failed after the second update"; }
    grep "SMOKE OK" <<<"$out" || { echo "$out"; fail "no SMOKE OK after the second update"; }
    snapshot | diff /tmp/data-before.txt - || fail "the user data changed during the second update"
    echo "Velopack version $v2 (the same build repacked), the user data is unchanged."
  fi
  echo "UPGRADE TEST OK ($id: C# $v0 -> TypeScript $v1${v2:+ -> $v2}, AppImage)"
}

if [[ "${1:-}" == --inside ]]; then
  shift
  inside "$@"
else
  host "$@"
fi
