#!/bin/sh
# Starts ${PKG_DISPLAY_NAME} (Electron: ${PKG_EXECUTABLE}.bin next to this script). This script is the app's executable,
# as the C# app's ${PKG_EXECUTABLE} was: the hub, the AppImage and /usr/bin start it.
#
# Chromium sandboxes its processes with user namespaces, or else with the setuid helper chrome-sandbox (the .deb, .rpm
# and Arch packages install it setuid root). Where neither can work it refuses to start, so the app is started without
# that sandbox (--no-sandbox) there: as root (containers, the installation tests), when unprivileged user namespaces are
# switched off, and when Ubuntu 23.10 and later restrict them with AppArmor (kernel.apparmor_restrict_unprivileged_userns)
# unless an AppArmor profile of Codestead allows them for this app: the package's own (/etc/apparmor.d/${PKG_NAME},
# packaging/ts/postinstall.sh) or the one the hub installs for the tools in the user's hub folder
# (/etc/apparmor.d/codestead-user-<uid>, ts/apps/hub/src/core/SandboxProfile.ts). A program started by a Codestead app
# that runs under such a profile (a tool started by the hub installed as a package) keeps its profile. The window keeps
# Electron's own isolation either way.
here=$(dirname "$(readlink -f "$0")")
bin="$here/${PKG_EXECUTABLE}.bin"
# Where the system's settings are read (ts/packages/ui/test/LauncherTests.test.ts points them at a fake system).
proc=/proc
apparmor_d=/etc/apparmor.d

# This process's AppArmor label ("codestead-hub (unconfined)"; "unconfined" without a profile).
apparmor_label() {
  cat "$proc/self/attr/apparmor/current" 2>/dev/null || cat "$proc/self/attr/current" 2>/dev/null
}

# Does a Codestead AppArmor profile allow user namespaces for $bin? Already running under one: the app keeps it (an
# exec without a profile of its own stays in the profile). Otherwise, only where a Codestead profile is installed, the
# app itself says which profile it gets: started as Node (ELECTRON_RUN_AS_NODE, a few hundredths of a second), it
# prints its label. Profiles are attached by the program's path when it starts, so this is the only reliable way: the
# list of loaded profiles is only readable by root, and a profile file may name another path (the package's profile
# names /opt/<id>/, not a copy of the app elsewhere).
apparmor_allows_userns() {
  case "$(apparmor_label)" in codestead-*) return 0 ;; esac
  [ -e "$apparmor_d/${PKG_NAME}" ] || [ -e "$apparmor_d/codestead-user-$(id -u)" ] || return 1
  probe='for(const f of ["/proc/self/attr/apparmor/current","/proc/self/attr/current"])try{process.stdout.write(require("fs").readFileSync(f,"utf8"));break}catch{}'
  case "$(ELECTRON_RUN_AS_NODE=1 "$bin" -e "$probe" 2>/dev/null)" in codestead-*) return 0 ;; esac
  return 1
}

sandbox_ok() {
  [ "$(id -u)" != 0 ] || return 1
  helper="$here/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null)" = 0 ]; then return 0; fi
  [ "$(cat "$proc/sys/kernel/unprivileged_userns_clone" 2>/dev/null)" != 0 ] || return 1
  [ "$(cat "$proc/sys/user/max_user_namespaces" 2>/dev/null)" != 0 ] || return 1
  if [ "$(cat "$proc/sys/kernel/apparmor_restrict_unprivileged_userns" 2>/dev/null)" = 1 ]; then
    apparmor_allows_userns
    return
  fi
  if command -v unshare >/dev/null 2>&1; then unshare --user --map-root-user true 2>/dev/null || return 1; fi
  return 0
}

if sandbox_ok; then
  exec "$bin" "$@"
else
  exec "$bin" --no-sandbox "$@"
fi
