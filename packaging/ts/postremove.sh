#!/bin/sh
# After removing ${PKG_DISPLAY_NAME}: its AppArmor profile (packaging/ts/postinstall.sh) is unloaded and removed. Not
# during an upgrade: dpkg runs the old package's postrm with "upgrade" (also "failed-upgrade", "abort-upgrade"), rpm
# runs the old package's %postun with the number of versions left (1) after the new one's %post; pacman runs
# post_upgrade instead (its post_remove gets the removed version).
case "${1:-}" in
  upgrade | failed-upgrade | abort-upgrade | [1-9] | [1-9][0-9]) exit 0 ;;
esac
profile=/etc/apparmor.d/${PKG_NAME}
[ -e "$profile" ] || exit 0
for p in /usr/sbin/apparmor_parser /sbin/apparmor_parser; do
  if [ -x "$p" ] && [ -d /sys/kernel/security/apparmor ]; then
    "$p" --remove "$profile" >/dev/null 2>&1 || true
    break
  fi
done
rm -f "$profile"
exit 0
