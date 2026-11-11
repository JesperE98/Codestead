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

# apt-get on Ubuntu: its package servers are sometimes unreachable from the runners' containers (archive.ubuntu.com
# not resolving: every Ubuntu test of the release on 2026-11-11 failed that way while Fedora and Arch passed). Retry,
# then fall back to other mirrors of the same archive, before giving up.
apt_install() {
  export DEBIAN_FRONTEND=noninteractive
  local mirrors=("" "http://azure.archive.ubuntu.com/ubuntu" "http://mirrors.edge.kernel.org/ubuntu")
  for mirror in "${mirrors[@]}"; do
    if [ -n "$mirror" ]; then
      echo "--- apt: using $mirror"
      sed -i -E "s#https?://(archive|security)\.ubuntu\.com/ubuntu/?#$mirror/#g; s#https?://azure\.archive\.ubuntu\.com/ubuntu/?#$mirror/#g" \
        /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
    fi
    for attempt in 1 2 3; do
      apt-get update -qq || true
      if apt-get install -y -qq "$@" >/dev/null; then return 0; fi
      sleep $((attempt * 5))
    done
  done
  echo "apt-get could not install: $*" >&2
  return 1
}

case "$kind" in
  deb)
    apt_install xvfb xauth
    apt_install ./"${pkg}"_*_amd64.deb
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
      apt_install xvfb xauth libfontconfig1 libx11-6 libice6 libsm6 libxrandr2 libxi6 libxcursor1
    elif command -v dnf >/dev/null; then
      # OpenSSL 3 by its library name (openssl3-libs on Fedora 45 and later): .NET cannot use OpenSSL 4.
      dnf install -y -q xorg-x11-server-Xvfb xorg-x11-xauth fontconfig libX11 libICE libSM libXrandr libXi libXcursor 'libssl.so.3()(64bit)' >/dev/null
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
