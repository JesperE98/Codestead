#!/bin/sh
# Starts ${PKG_DISPLAY_NAME} (Electron: ${PKG_EXECUTABLE}.bin next to this script). This script is the app's executable,
# as the C# app's ${PKG_EXECUTABLE} was: the hub, the AppImage and /usr/bin start it.
#
# Chromium sandboxes its processes with user namespaces, or else with the setuid helper chrome-sandbox (the .deb, .rpm
# and Arch packages install it setuid root). Where neither can work it refuses to start, so the app is started without
# that sandbox there: as root (containers, the installation tests), when unprivileged user namespaces are switched off
# or restricted (Ubuntu 23.10 and later restrict them with AppArmor) and chrome-sandbox is not setuid root (the hub's
# per-user installation, the AppImage). The window keeps Electron's own isolation either way.
here=$(dirname "$(readlink -f "$0")")
bin="$here/${PKG_EXECUTABLE}.bin"

sandbox_ok() {
  [ "$(id -u)" != 0 ] || return 1
  helper="$here/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null)" = 0 ]; then return 0; fi
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" != 1 ] || return 1
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" != 0 ] || return 1
  [ "$(cat /proc/sys/user/max_user_namespaces 2>/dev/null)" != 0 ] || return 1
  if command -v unshare >/dev/null 2>&1; then unshare --user --map-root-user true 2>/dev/null || return 1; fi
  return 0
}

if sandbox_ok; then
  exec "$bin" "$@"
else
  exec "$bin" --no-sandbox "$@"
fi
