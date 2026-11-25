#!/usr/bin/env bash
# Chromium's sandbox under AppArmor, on a real system: where Ubuntu (23.10 and later) restricts unprivileged user
# namespaces with AppArmor (kernel.apparmor_restrict_unprivileged_userns=1), the app installed from its .deb must run
# WITH Chromium's sandbox, through the package's AppArmor profile (packaging/ts/postinstall.sh, launcher.sh;
# docs/DEVELOPMENT.md, "Chromiums sandlåda på Linux"). AppArmor lives in the host's kernel, so this cannot run in a
# container: release.yml's test-sandbox job runs it on a GitHub ubuntu-24.04 runner; by hand it runs on an Ubuntu 24.04
# desktop. As a normal user with sudo (the sandbox is only used without root):
#   1. the restriction is on (switched on for the test if it is off) and really stops `unshare --user`;
#   2. the package is installed with apt; /etc/apparmor.d/<id> exists and the kernel has loaded the profile;
#   3. the app is started with --smoke-test on a virtual display (Xvfb), first with chrome-sandbox NOT setuid (only the
#      profile can give the sandbox; the launcher then asks Electron for its AppArmor label), then as installed (setuid
#      helper). While it runs (`--inspect`, as root: the browser process is stopped for the moment of the snapshot) its
#      processes are checked: the browser process was started without --no-sandbox, its AppArmor label is the profile's,
#      and a renderer and the sandboxed zygote run in user namespaces of their own with seccomp-bpf (Chromium's
#      namespace sandbox). The smoke test must also pass (SMOKE OK);
#   4. reinstalling the package (dpkg runs the old postrm with "upgrade") keeps the profile;
#   5. removing the package removes and unloads the profile.
# Not covered: a tool installed by the hub (it inherits the profile) and the per-user profile the hub installs through
# pkexec for the AppImage (docs/RELEASE-CHECKLIST.md).
#
# Usage: packaging/sandbox-test.sh <package.deb>
#   e.g. packaging/sandbox-test.sh artifacts/codestead-hub_0.2.9_amd64.deb
#   The package must not be installed already (it is removed at the end).
set -euo pipefail

# ---------- --inspect <browser pid> <exe.bin> <userns|any> (as root, started by the test below) ----------
# Watches the app's processes while it runs, and checks what the sandbox must look like: the browser process without
# --no-sandbox, under the package's AppArmor profile, in the system's user namespace; Chromium's sandboxed zygote (which
# every renderer is forked from) and the renderer in a PID namespace of their own, with "userns" also in a user namespace
# of their own (Chromium's namespace sandbox, which only the profile allows; "any": the setuid helper's sandbox would do
# too), and the renderer with seccomp-bpf. The sandboxed zygote lives as long as the app; the window's renderer only for
# the moment the smoke test takes (a fraction of a second), so the processes are scanned in a tight loop without
# starting programs, and each snapshot is taken with the browser process stopped (it cannot end in the middle of it).
# A renderer that was not caught is a warning, not a failure: its sandbox is the zygote's.
proc_cmdline() { tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null || true; }
proc_label() { cat "/proc/$1/attr/apparmor/current" 2>/dev/null || cat "/proc/$1/attr/current" 2>/dev/null || echo '?'; }
proc_type() {
  local args type
  args=$(proc_cmdline "$1")
  type=$(grep -o -- '--type=[a-z-]*' <<<"$args" | head -1 | cut -d= -f2 || true)
  [[ "$type" != zygote ]] || [[ "$args" != *--no-zygote-sandbox* ]] || type="zygote-unsandboxed"
  echo "${type:-browser}"
}
# The process and its descendants (pid per line).
app_pids() {
  ps -e -o pid=,ppid= | awk -v root="$1" '{ parent[$1] = $2 }
    END { for (p in parent) { x = p; n = 0; while (x != root && (x in parent) && n++ < 64) x = parent[x]; if (x == root) print p } }'
}
# Sets zygote and renderer to a sandboxed zygote and a renderer of $bin, if there are any. Only shell builtins: fast.
scan() {
  local d a0 a1 a2
  zygote='' renderer=''
  for d in /proc/[0-9]*; do
    a0='' a1='' a2=''
    { read -r -d '' a0; read -r -d '' a1; read -r -d '' a2; } 2>/dev/null < "$d/cmdline" || true
    # A process title set by Chromium can be one string ("<exe> --type=renderer …").
    if [[ "$a0" == "$bin "* ]]; then read -r a0 a1 a2 _ <<<"$a0"; fi
    [[ "$a0" == "$bin" ]] || continue
    case "$a1" in
      --type=renderer) renderer=${d#/proc/} ;;
      --type=zygote) [[ "$a2" == --no-zygote-sandbox ]] || zygote=${d#/proc/} ;;
    esac
  done
}
# Prints the app's processes with the browser process stopped and adds them to rows ("pid type userns pidns seccomp").
snapshot() {
  local p row pid type ns pidns seccomp
  kill -STOP "$main" 2>/dev/null || return 1
  trap 'kill -CONT "$main" 2>/dev/null || true' EXIT
  if [[ -z "${main_args+x}" ]]; then
    main_ns=$(readlink "/proc/$main/ns/user")
    main_pidns=$(readlink "/proc/$main/ns/pid")
    main_args=$(proc_cmdline "$main")
    main_label=$(proc_label "$main")
  fi
  echo "--- $1"
  printf '%-8s %-19s %-28s %-23s %-22s %s\n' PID TYPE APPARMOR USERNS PIDNS SECCOMP
  for p in $(app_pids "$main" | sort -n); do
    [[ -d "/proc/$p" ]] || continue
    row="$p $(proc_type "$p") $(readlink "/proc/$p/ns/user" 2>/dev/null || echo '?') $(readlink "/proc/$p/ns/pid" 2>/dev/null || echo '?')"
    row+=" $(awk '/^Seccomp:/ { print $2 }' "/proc/$p/status" 2>/dev/null || echo '?')"
    rows+=("$row")
    read -r pid type ns pidns seccomp <<<"$row"
    printf '%-8s %-19s %-28s %-23s %-22s %s\n' "$pid" "$type" "$(proc_label "$p")" "$ns" "$pidns" "$seccomp"
  done
  kill -CONT "$main"
  trap - EXIT
}

if [[ "${1:-}" == --inspect ]]; then
  main=$2
  bin=$3
  want=$4
  [[ "$(id -u)" == 0 ]] || { echo "--inspect runs as root" >&2; exit 2; }
  rows=()
  seen_zygote=''
  SECONDS=0
  while [[ -d "/proc/$main" ]] && ((SECONDS < 120)); do
    scan
    # The browser process has become Electron (the launcher execs it: the same pid).
    main_a0=''
    { read -r -d '' main_a0; } 2>/dev/null < "/proc/$main/cmdline" || true
    if [[ -z "$seen_zygote" && -n "$zygote" && "$main_a0" == "$bin" ]]; then
      snapshot "the app's processes once the sandboxed zygote is there" && seen_zygote=$zygote
    fi
    if [[ -n "$seen_zygote" && -n "$renderer" ]]; then
      snapshot "the app's processes with the window's renderer" || true
      break
    fi
    sleep 0.005
  done
  [[ -n "$seen_zygote" ]] || { echo "SANDBOX PROBLEM: no sandboxed zygote of $bin was seen while the app ran (pid $main)." >&2; exit 1; }
  echo "browser process: $main_args"
  host_ns=$(readlink /proc/self/ns/user)
  echo "the system's user namespace: $host_ns"

  fail=0
  problem() { echo "SANDBOX PROBLEM: $*" >&2; fail=1; }
  pkg=$(basename "$(dirname "$bin")")
  [[ " $main_args " != *" --no-sandbox "* ]] || problem "the browser process was started with --no-sandbox (packaging/ts/launcher.sh)"
  [[ "$main_label" == "$pkg ("* || "$main_label" == "$pkg" ]] || problem "the browser process's AppArmor label is '$main_label', not the profile $pkg"
  [[ "$main_ns" == "$host_ns" ]] || problem "the browser process runs in another user namespace ($main_ns) than the system ($host_ns)"
  renderers=0 zygotes=0 own_userns=0
  for row in "${rows[@]}"; do
    read -r pid type ns pidns seccomp <<<"$row"
    case "$type" in
      renderer | zygote)
        if [[ "$type" == renderer ]]; then renderers=$((renderers + 1)); else zygotes=$((zygotes + 1)); fi
        [[ "$pidns" != "$main_pidns" ]] || problem "$type $pid runs in the browser process's PID namespace (no sandbox)"
        if [[ "$ns" != "$main_ns" ]]; then
          own_userns=$((own_userns + 1))
        elif [[ "$want" == userns ]]; then
          problem "$type $pid runs in the browser process's user namespace (no namespace sandbox)"
        fi
        [[ "$type" != renderer || "$seccomp" == 2 ]] || problem "renderer $pid has no seccomp-bpf filter (Seccomp: $seccomp)"
        ;;
    esac
  done
  ((zygotes > 0)) || problem "no sandboxed zygote (--type=zygote without --no-zygote-sandbox) in the snapshots"
  ((fail == 0)) || exit 1
  if ((renderers == 0)); then
    echo "::warning::The window's renderer ended before it was caught (the zygote it is forked from is sandboxed)."
  fi
  kind="Chromium's namespace sandbox (user namespaces of their own)"
  ((own_userns > 0)) || kind="the setuid sandbox (chrome-sandbox)"
  echo "Sandboxed: no --no-sandbox, AppArmor label '$main_label', the zygote and $renderers renderer(s) in PID namespaces of their own; $kind."
  exit 0
fi

# ---------- The test (as a normal user with sudo) ----------
deb=$(readlink -f "${1:?Usage: packaging/sandbox-test.sh <package.deb>}")
[[ -f "$deb" ]] || { echo "No such package: $1" >&2; exit 2; }
self=$(readlink -f "$0")
[[ "$(id -u)" != 0 ]] || { echo "Run this as a normal user with sudo: as root the app starts without the sandbox." >&2; exit 2; }
sudo -v
pkg=$(dpkg-deb -f "$deb" Package)
if dpkg-query -W -f '${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed'; then
  echo "$pkg is installed already; remove it first (the test installs and removes it)." >&2
  exit 2
fi

apt_get() {
  for attempt in 1 2 3; do
    if sudo DEBIAN_FRONTEND=noninteractive apt-get -y -q "$@"; then return 0; fi
    sleep $((attempt * 5))
    sudo apt-get update -q || true
  done
  echo "apt-get $* failed" >&2
  return 1
}
loaded() { sudo grep -q "^$pkg (" /sys/kernel/security/apparmor/profiles; }

work=$(mktemp -d)
xvfb=
cleanup() {
  [[ -z "$xvfb" ]] || kill "$xvfb" 2>/dev/null || true
  [[ ! -e "/opt/$pkg/chrome-sandbox" ]] || sudo chmod 4755 "/opt/$pkg/chrome-sandbox" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "--- AppArmor and the user namespace restriction"
[[ -d /sys/kernel/security/apparmor ]] || { echo "AppArmor is not running on this system." >&2; exit 1; }
restrict=/proc/sys/kernel/apparmor_restrict_unprivileged_userns
[[ -e "$restrict" ]] || { echo "This kernel has no $restrict (AppArmor does not restrict user namespaces here)." >&2; exit 1; }
echo "kernel.apparmor_restrict_unprivileged_userns = $(cat "$restrict")"
if [[ "$(cat "$restrict")" != 1 ]]; then
  echo "::notice::kernel.apparmor_restrict_unprivileged_userns was $(cat "$restrict"); switching it on for the test."
  sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=1
  [[ "$(cat "$restrict")" == 1 ]] || { echo "Could not switch the restriction on." >&2; exit 1; }
fi
echo "unprivileged_userns_clone = $(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo '-'), max_user_namespaces = $(cat /proc/sys/user/max_user_namespaces)"
# Without a profile, a user namespace is useless (no capabilities in it): what makes Chromium need the profile.
if out=$(unshare --user --map-root-user true 2>&1); then
  echo "unshare --user --map-root-user works without a profile: the restriction has no effect here, so the test would prove nothing." >&2
  exit 1
fi
echo "Without a profile: unshare --user --map-root-user fails ($out)"

echo "--- Installing $(basename "$deb")"
apt_get update
apt_get install xvfb xauth
apt_get install "$deb"
profile_file=/etc/apparmor.d/$pkg
[[ -f "$profile_file" ]] || { echo "$profile_file was not installed (packaging/ts/postinstall.sh)" >&2; exit 1; }
cat "$profile_file"
bin=$(sed -n "s/^profile $pkg \(\/[^ ]*\) flags=(unconfined) {$/\1/p" "$profile_file")
[[ -n "$bin" && -x "$bin" ]] || { echo "The profile names no executable of the package ('$bin')" >&2; exit 1; }
loaded || { echo "The profile $pkg is not loaded (/sys/kernel/security/apparmor/profiles)" >&2; exit 1; }
echo "Loaded: $(sudo cat /sys/kernel/security/apparmor/profiles | grep "^$pkg (")"
if command -v aa-status >/dev/null || [[ -x /usr/sbin/aa-status ]]; then sudo aa-status | grep -F "$pkg" || true; fi
helper=/opt/$pkg/chrome-sandbox
[[ -u "$helper" && "$(stat -c %u "$helper")" == 0 ]] || { ls -l "$helper"; echo "chrome-sandbox is not setuid root" >&2; exit 1; }

echo "--- Virtual display"
exec 3> "$work/display"
Xvfb -displayfd 3 -screen 0 1280x800x24 -nolisten tcp > "$work/xvfb.log" 2>&1 &
xvfb=$!
exec 3>&-
for _ in $(seq 1 100); do [[ -s "$work/display" ]] && break; sleep 0.1; done
[[ -s "$work/display" ]] || { cat "$work/xvfb.log"; echo "Xvfb did not start" >&2; exit 1; }
display=":$(head -1 "$work/display")"
echo "DISPLAY=$display"

# Starts /usr/bin/<id> --smoke-test (the launcher, which execs Electron: the same pid), inspects its processes as root
# while it runs, and checks that the smoke test passes.
run_app() {
  local what=$1 home="$work/home-$2" want=$3 pid status=0 inspect=0
  echo "--- $what: /usr/bin/$pkg --smoke-test"
  mkdir -p "$home"
  HOME="$home" CODESTEAD_DATA_DIR="$home/data" DISPLAY="$display" "/usr/bin/$pkg" --smoke-test > "$home/out.log" 2>&1 &
  pid=$!
  sudo bash "$self" --inspect "$pid" "$bin" "$want" || inspect=1
  if ((inspect != 0)); then kill "$pid" 2>/dev/null || true; fi
  wait "$pid" || status=$?
  echo "--- app output (exit $status)"
  cat "$home/out.log"
  ((inspect == 0)) || { echo "$what: the app did not run with Chromium's sandbox" >&2; exit 1; }
  if ((status != 0)) || ! grep -q "SMOKE OK" "$home/out.log"; then echo "$what: the smoke test failed" >&2; exit 1; fi
}

# Only the profile can give the sandbox: the launcher must find it (ELECTRON_RUN_AS_NODE probe) and Chromium must be
# allowed its user namespaces.
sudo chmod 0755 "$helper"
run_app "chrome-sandbox not setuid (only the AppArmor profile)" profile userns
sudo chmod 4755 "$helper"
run_app "as installed (setuid chrome-sandbox and the profile)" installed any

echo "--- Reinstalling (dpkg: the old package's postrm runs with \"upgrade\"): the profile stays"
apt_get install --reinstall "$deb"
if [[ ! -f "$profile_file" ]] || ! loaded; then echo "The profile is gone after reinstalling the package" >&2; exit 1; fi

echo "--- Removing $pkg"
apt_get remove "$pkg"
[[ ! -e "$profile_file" ]] || { echo "$profile_file is left after removal" >&2; exit 1; }
! loaded || { echo "The profile $pkg is still loaded after removal" >&2; exit 1; }
if command -v aa-status >/dev/null || [[ -x /usr/sbin/aa-status ]]; then ! sudo aa-status | grep -F "$pkg" || exit 1; fi
echo "SANDBOX TEST OK ($pkg)"
