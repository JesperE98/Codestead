#!/usr/bin/env bash
# Installation test on a clean system. Runs INSIDE a fresh container (ubuntu, fedora, archlinux, cachyos)
# with the release artifacts mounted at /artifacts. Installs the native package exactly as a user would,
# starts the app with --smoke-test under a virtual display and removes the package again.
# Usage (in the container): bash install-test.sh <package-name> <executable> <kind: deb|rpm|arch|appimage>
#   (the native packages bring their own dependencies; for the AppImage, Electron's libraries are installed first, as
#   a desktop system has them).
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
    # AppArmor's tools, as on a desktop system: the package installs its AppArmor profile where they accept it.
    apt_install xvfb xauth apparmor
    apt_install ./"${pkg}"_*_amd64.deb
    run=("$pkg")
    ;;
  rpm)
    dnf install -y -q xorg-x11-server-Xvfb xorg-x11-xauth which >/dev/null
    dnf install -y ./"$pkg"-*.x86_64.rpm
    run=("$pkg")
    ;;
  arch)
    # CachyOS's pacman runs install scripts and hooks without network access, which a container can't set up, so it
    # refuses to run them at all (and chrome-sandbox would not be made setuid). A real system can; let the container
    # run them with the network, as Arch's pacman does.
    if grep -q '^ID=cachyos' /etc/os-release || grep -q 'DisableSandboxNetwork' /etc/pacman.conf; then
      grep -q '^DisableSandboxNetwork' /etc/pacman.conf || sed -i 's/^\[options\]$/[options]\nDisableSandboxNetwork/' /etc/pacman.conf
    fi
    pacman -Syu --noconfirm --needed xorg-server-xvfb xorg-xauth which >/dev/null
    pacman -U --noconfirm ./"$pkg"-*-x86_64.pkg.tar.zst
    run=("$pkg")
    ;;
  appimage)
    # The libraries Electron links against (packaging/ts/nfpm.yaml); a desktop system has them.
    if command -v apt-get >/dev/null; then
      # ALSA by its real package (libasound2t64 on Ubuntu 24.04 and later): apt could take another provider of libasound2.
      apt-get update -qq || true
      asound=libasound2; apt-cache show libasound2t64 >/dev/null 2>&1 && asound=libasound2t64
      apt_install xvfb xauth libgtk-3-0 libnss3 libgbm1 "$asound" libcups2 libxkbcommon0 libatk-bridge2.0-0 \
        libxcomposite1 libxdamage1 libxrandr2 libdrm2 xdg-utils
    elif command -v dnf >/dev/null; then
      dnf install -y -q xorg-x11-server-Xvfb xorg-x11-xauth gtk3 nss mesa-libgbm alsa-lib cups-libs libxkbcommon \
        at-spi2-atk libXcomposite libXdamage libXrandr libdrm xdg-utils >/dev/null
    else
      pacman -Syu --noconfirm --needed xorg-server-xvfb xorg-xauth gtk3 nss mesa alsa-lib libcups at-spi2-core \
        libxcomposite libxdamage libxrandr libxkbcommon xdg-utils >/dev/null
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

# Electron's sandbox helper must be setuid root in the native packages (packaging/ts/postinstall.sh).
if [[ "$kind" != appimage ]]; then
  [[ -u "/opt/$pkg/chrome-sandbox" && "$(stat -c %u "/opt/$pkg/chrome-sandbox")" == 0 ]] \
    || { ls -l "/opt/$pkg/chrome-sandbox"; echo "chrome-sandbox is not setuid root" >&2; exit 1; }
  # And its AppArmor profile (packaging/ts/postinstall.sh) is in /etc/apparmor.d where the system's AppArmor accepts it
  # (AppArmor 4: Ubuntu 24.04), and nowhere else (Ubuntu 22.04's AppArmor 3, systems without AppArmor). A container
  # has no AppArmor to load it into: that is the manual check in docs/RELEASE-CHECKLIST.md.
  [[ -f "/opt/$pkg/apparmor-profile" ]] || { echo "The package has no AppArmor profile" >&2; exit 1; }
  if [[ -x /usr/sbin/apparmor_parser || -x /sbin/apparmor_parser ]] && [[ -e /etc/apparmor.d/abi/4.0 ]]; then
    grep -qxF "profile $pkg /opt/$pkg/$exe.bin flags=(unconfined) {" "/etc/apparmor.d/$pkg" \
      || { cat "/etc/apparmor.d/$pkg"; echo "The AppArmor profile was not installed" >&2; exit 1; }
    echo "AppArmor profile: /etc/apparmor.d/$pkg"
  elif [[ -e "/etc/apparmor.d/$pkg" ]]; then
    echo "The AppArmor profile was installed, but this system's AppArmor cannot use it" >&2
    exit 1
  fi
fi

echo "--- Starting ${run[*]} --smoke-test"
export CODESTEAD_DATA_DIR=/tmp/codestead-smoke
out=$(timeout 180 xvfb-run -a "${run[@]}" --smoke-test 2>&1) || { echo "$out"; echo "Smoke test failed" >&2; exit 1; }
echo "$out"
grep -q "SMOKE OK" <<<"$out" || { echo "Smoke test did not print SMOKE OK" >&2; exit 1; }
! grep -q "Velopack is not available" <<<"$out" || { echo "The app started without Velopack (no self-update)" >&2; exit 1; }

# Velopack (the apps' self-update) must load, not only the app: without it the app starts all the same, so the smoke test
# would not notice. On Ubuntu 22.04 its native module loads only because packaging/ts/velopack-glibc.mjs made its glibc
# 2.39 need optional. In the AppImage, Velopack must also find its installation (the update button is offered).
echo "--- Velopack"
if [[ "$kind" == appimage ]]; then
  version=${app#./"$pkg"-}
  version=${version%-linux-x86_64.AppImage}
  x=$(mktemp -d)
  (cd "$x" && "/artifacts/${app#./}" --appimage-extract >/dev/null)
  check=(env APPIMAGE="/artifacts/${app#./}" ELECTRON_RUN_AS_NODE=1 "$x/squashfs-root/usr/bin/$exe.bin" /packaging/ts/velopack-check.cjs
    --installed "$pkg" "$version")
else
  check=(env ELECTRON_RUN_AS_NODE=1 "/opt/$pkg/$exe.bin" /packaging/ts/velopack-check.cjs)
fi
vp=$("${check[@]}" 2>&1) || { echo "$vp"; echo "Velopack does not load" >&2; exit 1; }
echo "$vp"
grep -q "^VELOPACK OK" <<<"$vp" || { echo "No VELOPACK OK" >&2; exit 1; }
[[ "$kind" != appimage ]] || rm -rf "$x"

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
if [[ "$kind" != appimage && -e "/etc/apparmor.d/$pkg" ]]; then
  echo "The AppArmor profile /etc/apparmor.d/$pkg is left after removal" >&2
  exit 1
fi
echo "INSTALL TEST OK ($kind)"
