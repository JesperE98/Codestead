#!/usr/bin/env bash
# Installation test on a clean system. Runs INSIDE a fresh container (ubuntu, fedora, archlinux, cachyos)
# with the release artifacts mounted at /artifacts. Installs the native package exactly as a user would,
# starts the app with --smoke-test under a virtual display and removes the package again.
# Usage (in the container): bash install-test.sh <package-name> <executable> <kind: deb|rpm|arch|appimage>
set -euo pipefail
pkg="$1"
exe="$2"
kind="$3"
cd /artifacts

case "$kind" in
  deb)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq xvfb xauth >/dev/null
    apt-get install -y ./"${pkg}"_*_amd64.deb
    run=("$pkg")
    ;;
  rpm)
    dnf install -y -q xorg-x11-server-Xvfb xorg-x11-xauth which >/dev/null
    dnf install -y ./"$pkg"-*.x86_64.rpm
    run=("$pkg")
    ;;
  arch)
    pacman -Syu --noconfirm --needed xorg-server-xvfb xorg-xauth which >/dev/null
    pacman -U --noconfirm ./"$pkg"-*-x86_64.pkg.tar.zst
    run=("$pkg")
    ;;
  appimage)
    if command -v apt-get >/dev/null; then
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq && apt-get install -y -qq xvfb xauth libfontconfig1 libx11-6 libice6 libsm6 libxrandr2 libxi6 libxcursor1 >/dev/null
    elif command -v dnf >/dev/null; then
      dnf install -y -q xorg-x11-server-Xvfb xorg-x11-xauth fontconfig libX11 libICE libSM libXrandr libXi libXcursor >/dev/null
    else
      pacman -Syu --noconfirm --needed xorg-server-xvfb xorg-xauth fontconfig libx11 libice libsm libxrandr libxi libxcursor >/dev/null
    fi
    app=$(ls ./"$pkg"-*-linux-x86_64.AppImage | head -1)
    chmod +x "$app"
    # Containers have no FUSE: run the AppImage by extracting it (same files, same code).
    run=("$app" --appimage-extract-and-run)
    ;;
  *)
    echo "Unknown kind: $kind" >&2
    exit 2
    ;;
esac

echo "--- Starting ${run[*]} --smoke-test"
export CODESTEAD_DATA_DIR=/tmp/codestead-smoke
out=$(timeout 180 xvfb-run -a "${run[@]}" --smoke-test 2>&1) || { echo "$out"; echo "Smoke test failed" >&2; exit 1; }
echo "$out"
grep -q "SMOKE OK" <<<"$out" || { echo "Smoke test did not print SMOKE OK" >&2; exit 1; }

# Uninstall again – a clean removal is part of the test.
case "$kind" in
  deb) apt-get remove -y "$pkg" >/dev/null ;;
  rpm) dnf remove -y "$pkg" >/dev/null ;;
  arch) pacman -R --noconfirm "$pkg" >/dev/null ;;
esac
if [[ "$kind" != appimage && -e "/opt/$pkg/$exe" ]]; then
  echo "Files left in /opt/$pkg after removal" >&2
  exit 1
fi
echo "INSTALL TEST OK ($kind)"
