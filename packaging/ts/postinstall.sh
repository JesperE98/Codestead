#!/bin/sh
# After installing or upgrading ${PKG_DISPLAY_NAME}: Chromium's sandbox (see packaging/ts/launcher.sh) needs unprivileged
# user namespaces or its setuid helper. Both are set up here.

# 1. The setuid helper chrome-sandbox, for systems where user namespaces are switched off or restricted without
#    AppArmor (it works on every system).
chown root:root /opt/${PKG_NAME}/chrome-sandbox
chmod 4755 /opt/${PKG_NAME}/chrome-sandbox

# 2. The AppArmor profile that allows user namespaces for the app (Ubuntu 23.10 and later restrict them), as Ubuntu's
#    own profiles for Electron apps and electron-builder's packages do. It needs AppArmor 4 (abi/4.0, the userns rule):
#    older AppArmor (Ubuntu 22.04, Debian 12) would refuse it, also at every boot, so it is only put in /etc/apparmor.d
#    when the system's parser accepts it. It is loaded at once where AppArmor is running (not in a chroot, not when an
#    administrator disabled it with /etc/apparmor.d/disable/${PKG_NAME}). packaging/ts/postremove.sh removes it.
profile=/etc/apparmor.d/${PKG_NAME}
parser=
for p in /usr/sbin/apparmor_parser /sbin/apparmor_parser; do
  if [ -x "$p" ]; then parser=$p; break; fi
done
if [ -n "$parser" ] && [ -d /etc/apparmor.d ]; then
  if "$parser" --skip-kernel-load --skip-cache --quiet /opt/${PKG_NAME}/apparmor-profile >/dev/null 2>&1; then
    install -m 0644 /opt/${PKG_NAME}/apparmor-profile "$profile"
    active=no
    for e in /usr/bin/aa-enabled /usr/sbin/aa-enabled /sbin/aa-enabled; do
      if [ -x "$e" ]; then
        if "$e" --quiet 2>/dev/null; then active=yes; fi
        break
      fi
    done
    if [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; then active=no; fi
    if [ -e /etc/apparmor.d/disable/${PKG_NAME} ]; then active=no; fi
    if [ "$active" = yes ]; then
      "$parser" --replace --write-cache --skip-read-cache "$profile" \
        || echo "${PKG_DISPLAY_NAME}: the AppArmor profile $profile could not be loaded; the app starts without Chromium's sandbox where AppArmor restricts user namespaces." >&2
    fi
  else
    # This AppArmor is too old for the profile: an older copy must not stay behind either.
    rm -f "$profile"
  fi
fi
exit 0
