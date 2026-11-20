#!/usr/bin/env bash
# The update button of the hub installed as a native package (.deb, .rpm or Arch), end to end in a clean container:
# an OLDER build of the hub is installed with the system's package manager, the signed catalog (throw-away key, as the
# smoke test's) names a NEWER build, and the hub downloads that version's package and SHA256SUMS.txt from "GitHub",
# checks it, installs it with the package manager and starts again as the new version
# (ts/packages/ui/src/electron/NativePackageUpdate.ts).
#
# Nothing in the app can point its updates at another address. The container's /etc/hosts sends github.com and
# objects.githubusercontent.com to a local HTTPS server (packaging/native-update-server.cjs, run by the installed
# Electron as Node), whose certificate is signed by a throw-away CA that only the container trusts (Chromium's NSS
# database of the user). The hub is started with --smoke-test --self-update-test: its update button without the window.
#
# Cases: as root (no pkexec); a checksum that does not match and a download redirected away from GitHub's hosts
# (nothing is installed); as a normal user with a fake
# pkexec that records its arguments and runs them with sudo; and that fake pkexec acting as if the password dialog
# was closed (126). After each: the installed package's version, and that the restarted hub is the new version.
#
# Usage (on a machine with docker; the artifacts are packaging/build-linux.sh's output folders of two hub versions):
#   packaging/native-update-test.sh <old-artifacts> <new-artifacts> <deb|rpm|arch> [docker image]
#   e.g. packaging/build-linux.sh ts/apps/hub codestead-hub Codestead Codestead.Hub 0.2.90 /tmp/old
#        packaging/build-linux.sh ts/apps/hub codestead-hub Codestead Codestead.Hub 0.2.91 /tmp/new
#        packaging/native-update-test.sh /tmp/old /tmp/new deb ubuntu:24.04
set -euo pipefail

# ---------------------------------------------------------------------------------------------------------------------
# Inside the container: /work has the test's files, /old and /new the two builds.
in_container() {
  local kind="$1" id="$2" exe="$3" repo="$4" old="$5" new="$6"
  local pkg_old pkg_new
  case "$kind" in
    deb) pkg_old="/old/${id}_${old}_amd64.deb"; pkg_new="${id}_${new}_amd64.deb" ;;
    rpm) pkg_old="/old/$id-$old-1.x86_64.rpm"; pkg_new="$id-$new-1.x86_64.rpm" ;;
    arch) pkg_old="/old/$id-$old-1-x86_64.pkg.tar.zst"; pkg_new="$id-$new-1-x86_64.pkg.tar.zst" ;;
  esac

  echo "--- Tools for the test (Xvfb, NSS's certutil, sudo)"
  case "$kind" in
    deb)
      export DEBIAN_FRONTEND=noninteractive
      for attempt in 1 2 3; do apt-get update -qq && break || sleep $((attempt * 5)); done
      apt-get install -y -qq --no-install-recommends xvfb libnss3-tools sudo >/dev/null
      ;;
    rpm) dnf install -y -q --setopt=install_weak_deps=False xorg-x11-server-Xvfb nss-tools sudo util-linux >/dev/null ;;
    arch)
      if grep -q '^ID=cachyos' /etc/os-release || grep -q 'DisableSandboxNetwork' /etc/pacman.conf; then
        grep -q '^DisableSandboxNetwork' /etc/pacman.conf || sed -i 's/^\[options\]$/[options]\nDisableSandboxNetwork/' /etc/pacman.conf
      fi
      pacman -Syu --noconfirm --needed xorg-server-xvfb nss sudo util-linux >/dev/null
      ;;
  esac

  installed_version() {
    case "$kind" in
      deb) dpkg-query -W --showformat='${Version}' "$id" | sed 's/-[0-9]*$//' ;;
      rpm) rpm -q --qf '%{VERSION}' "$id" ;;
      arch) pacman -Q "$id" | awk '{print $2}' | sed 's/-[0-9]*$//' ;;
    esac
  }
  install_old() {
    case "$kind" in
      deb) apt-get install -y -qq --no-install-recommends --allow-downgrades "$pkg_old" >/dev/null 2>&1 \
             || apt-get install -y --no-install-recommends --allow-downgrades "$pkg_old" ;;
      rpm) if rpm -q "$id" >/dev/null 2>&1; then rpm -U --oldpackage "$pkg_old"; else dnf install -y -q --setopt=install_weak_deps=False "$pkg_old" >/dev/null; fi ;;
      arch) pacman -U --noconfirm "$pkg_old" >/dev/null ;;
    esac
    [[ "$(installed_version)" == "$old" ]] || { echo "The old version is not installed ($(installed_version))" >&2; exit 1; }
  }
  fail() { echo "NATIVE UPDATE TEST FAILED: $*" >&2; exit 1; }

  echo "--- Installing $id $old ($kind)"
  install_old

  echo "--- The release $id-v$new on the stand-in for GitHub"
  mkdir -p "/srv/release/$id-v$new"
  ln -s "/new/$pkg_new" "/srv/release/$id-v$new/$pkg_new"
  (cd /new && sha256sum "$pkg_new") > /srv/sums-good
  sed -E 's/^[0-9a-f]{8}/00000000/' /srv/sums-good > /srv/sums-bad
  cp /srv/sums-good "/srv/release/$id-v$new/SHA256SUMS.txt"
  ELECTRON_RUN_AS_NODE=1 "/opt/$id/$exe.bin" /work/native-update-server.cjs /srv/release /work/server.pem /work/server.key "$repo" > /tmp/server.log 2>&1 &
  for _ in $(seq 50); do grep -q listening /tmp/server.log && break; sleep 0.2; done
  grep -q listening /tmp/server.log || { cat /tmp/server.log; fail "the server did not start"; }

  echo "--- A display and a user; both trust the test's CA"
  Xvfb :99 -screen 0 1280x1024x24 >/dev/null 2>&1 &
  export DISPLAY=:99
  useradd -m tester
  echo 'tester ALL=(root) NOPASSWD: ALL' > /etc/sudoers.d/tester
  for home in /root /home/tester; do
    mkdir -p "$home/.pki/nssdb"
    certutil -d "sql:$home/.pki/nssdb" -N --empty-password
    certutil -d "sql:$home/.pki/nssdb" -A -t "C,," -n codestead-update-test -i /work/ca.pem
  done
  chown -R tester: /home/tester/.pki
  # The fake pkexec (the app takes pkexec from /usr/bin): records its arguments, then runs them as root with sudo, or
  # acts as if the user closed the password dialog.
  cat > /usr/bin/pkexec <<'SHIM'
#!/bin/sh
printf '%s\n' "$@" > /tmp/pkexec-args.txt
if [ -e /tmp/pkexec-cancel ]; then
  echo "Error executing command as another user: Request dismissed" >&2
  exit 126
fi
exec sudo -n -- "$@"
SHIM
  chmod 755 /usr/bin/pkexec

  # Runs the old hub's update button: as root, or as tester (--no-sandbox: a container lets no one use Chromium's
  # sandbox; the restarted hub gets the same arguments).
  run_update() {
    local user="$1" data
    data=$(mktemp -d)
    chmod 777 "$data"
    local cmd=(env -u DEBIAN_FRONTEND "HOME=$( [[ $user == root ]] && echo /root || echo /home/tester )" "DISPLAY=$DISPLAY"
      "CODESTEAD_DATA_DIR=$data/settings" "CODESTEAD_HUB_DIR=$data/hub"
      "/usr/bin/$id" --smoke-test --self-update-test --catalog /work/catalog.json --public-key /work/pub.pem)
    [[ $user == root ]] || cmd=(runuser -u tester -- "${cmd[@]}" --no-sandbox)
    # The output ends when the restarted hub has ended too (it writes to the same output).
    timeout 300 "${cmd[@]}" 2>&1 | grep -v -E 'dbus|Fontconfig|libva|viz_main|gpu_init|command_buffer|ERROR:.*(gl_|angle|egl)' || true
  }
  leftovers() { ls -d /tmp/"$id"-update-* 2>/dev/null || true; }

  echo "=== 1. As root: the package manager without pkexec"
  out=$(run_update root); echo "$out"
  grep -q "installed as $kind, canUpdateItself=true, asksForPassword=false" <<<"$out" || fail "not seen as a $kind installation"
  grep -q "SELF-UPDATE available: $new" <<<"$out" || fail "the update was not found"
  grep -q "matches SHA256SUMS.txt" <<<"$out" || fail "the checksum was not checked"
  grep -q "GET https://objects.githubusercontent.com/test-release-asset/$id-v$new/$pkg_new" /tmp/server.log || fail "the package was not downloaded"
  grep -q "SMOKE OK Codestead $new" <<<"$out" || fail "the hub did not start again as $new"
  [[ "$(installed_version)" == "$new" ]] || fail "installed: $(installed_version)"
  [[ "$("/usr/bin/$id" --version 2>/dev/null | tail -1)" == "$new" ]] || fail "/usr/bin/$id --version is not $new"
  [[ -z "$(leftovers)" ]] || fail "temporary files left: $(leftovers)"

  echo "=== 2. A checksum that does not match: nothing is installed"
  install_old
  cp /srv/sums-bad "/srv/release/$id-v$new/SHA256SUMS.txt"
  out=$(run_update root); echo "$out"
  grep -q "SELF-UPDATE FAILED: $pkg_new does not have the checksum its release gives" <<<"$out" || fail "a wrong checksum was not refused"
  [[ "$(installed_version)" == "$old" ]] || fail "installed after a wrong checksum: $(installed_version)"
  [[ -z "$(leftovers)" ]] || fail "temporary files left: $(leftovers)"
  cp /srv/sums-good "/srv/release/$id-v$new/SHA256SUMS.txt"

  echo "=== 3. A download redirected away from GitHub's hosts: refused"
  touch /srv/redirect-away
  out=$(run_update root); echo "$out"
  grep -q "SELF-UPDATE FAILED: The download was redirected away from GitHub: https://elsewhere.test/" <<<"$out" || fail "a redirect away from GitHub was followed"
  [[ "$(installed_version)" == "$old" ]] || fail "installed after a redirect away from GitHub: $(installed_version)"
  rm /srv/redirect-away

  echo "=== 4. As a user, the password dialog closed (pkexec 126)"
  touch /tmp/pkexec-cancel
  out=$(run_update tester); echo "$out"
  grep -q "asksForPassword=true" <<<"$out" || fail "a user's update should ask for the password"
  grep -q "SELF-UPDATE FAILED: The password dialog was closed" <<<"$out" || fail "the closed dialog was not reported"
  [[ "$(installed_version)" == "$old" ]] || fail "installed after the dialog was closed: $(installed_version)"
  rm /tmp/pkexec-cancel

  echo "=== 5. As a user, through pkexec"
  out=$(run_update tester); echo "$out"
  echo "pkexec was called with:"; sed 's/^/  /' /tmp/pkexec-args.txt
  case "$kind" in
    deb) expect='^/usr/bin/apt-get install -y /tmp/'"$id"'-update-[^/]+/'"$pkg_new"'$' ;;
    rpm) expect='^/usr/bin/dnf install -y /tmp/'"$id"'-update-[^/]+/'"$pkg_new"'$' ;;
    arch) expect='^/usr/bin/pacman -U --noconfirm /tmp/'"$id"'-update-[^/]+/'"$pkg_new"'$' ;;
  esac
  grep -E -q "$expect" <<<"$(paste -sd' ' /tmp/pkexec-args.txt)" || fail "pkexec's arguments: $(paste -sd' ' /tmp/pkexec-args.txt)"
  grep -q "SMOKE OK Codestead $new" <<<"$out" || fail "the hub did not start again as $new"
  [[ "$(installed_version)" == "$new" ]] || fail "installed: $(installed_version)"
  [[ -z "$(leftovers)" ]] || fail "temporary files left: $(leftovers)"

  echo "NATIVE UPDATE TEST OK ($kind: $old -> $new)"
}

if [[ "${1:-}" == --in-container ]]; then
  shift
  in_container "$@"
  exit 0
fi

# ---------------------------------------------------------------------------------------------------------------------
# On the host: the test's files (CA, certificate, signed catalog), then the container.
old_dir="$(cd "$1" && pwd)"; new_dir="$(cd "$2" && pwd)"; kind="$3"
case "$kind" in
  deb) image="${4:-ubuntu:24.04}"; pattern='codestead-hub_*_amd64.deb' ;;
  rpm) image="${4:-fedora:latest}"; pattern='codestead-hub-*-1.x86_64.rpm' ;;
  arch) image="${4:-archlinux:latest}"; pattern='codestead-hub-*-1-x86_64.pkg.tar.zst' ;;
  *) echo "Unknown kind: $kind" >&2; exit 2 ;;
esac
root="$(cd "$(dirname "$0")/.." && pwd)"
product() { python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); p=[p for p in d["products"] if p["key"]=="hub"][0]; print(d["releasesRepo"] if sys.argv[2]=="repo" else p[sys.argv[2]])' "$root/packaging/products.json" "$1"; }
id=$(product id); exe=$(product exe); name=$(product name); repo=$(product repo)
version_of() {
  local f; f=$(cd "$1" && ls $pattern | head -1)
  [[ -n "$f" ]] || { echo "No $pattern in $1" >&2; exit 1; }
  sed -E "s/^${id}[-_]([0-9]+\.[0-9]+\.[0-9]+).*/\1/" <<<"$f"
}
old=$(version_of "$old_dir"); new=$(version_of "$new_dir")
echo "$id: $old -> $new ($kind, $image)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp "$root/packaging/native-update-server.cjs" "$root/packaging/native-update-test.sh" "$work/"
# A throw-away CA and a certificate for GitHub's two download hosts (and a host that is not GitHub's).
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout "$work/ca.key" -out "$work/ca.pem" \
  -days 2 -subj "/CN=Codestead native update test CA" -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign" 2>/dev/null
openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout "$work/server.key" -out "$work/server.csr" -subj "/CN=github.com" 2>/dev/null
printf 'subjectAltName=DNS:github.com,DNS:objects.githubusercontent.com,DNS:elsewhere.test\nextendedKeyUsage=serverAuth\n' > "$work/ext.cnf"
openssl x509 -req -in "$work/server.csr" -CA "$work/ca.pem" -CAkey "$work/ca.key" -CAcreateserial -out "$work/server.pem" -days 2 -extfile "$work/ext.cnf" 2>/dev/null
# The catalog names the new hub (signed with a throw-away key, given with --public-key as in the smoke test).
openssl ecparam -name prime256v1 -genkey -noout -out "$work/key.pem"
openssl ec -in "$work/key.pem" -pubout -out "$work/pub.pem" 2>/dev/null
echo "a portable archive the test does not download" > "$work/hub.tar.gz"
python3 "$root/packaging/catalog.py" --catalog "$work/catalog.json" --id "$id" --name "$name" --version "$new" \
  --description-file "$root/src/Hub/description.json" \
  --asset "linux-x64=$work/hub.tar.gz=https://github.com/$repo/releases/download/$id-v$new/$id-$new-linux-x64.tar.gz=$exe"
openssl dgst -sha256 -sign "$work/key.pem" "$work/catalog.json" | base64 | tr -d '\n' > "$work/catalog.json.sig"
chmod -R a+rX "$work"

# NATIVE_UPDATE_DOCKER_ARGS: more options for docker run (e.g. "--tmpfs /opt:exec,size=2g" where disk space is short).
# shellcheck disable=SC2086
docker run --rm ${NATIVE_UPDATE_DOCKER_ARGS:-} --add-host github.com:127.0.0.1 --add-host objects.githubusercontent.com:127.0.0.1 \
  --add-host elsewhere.test:127.0.0.1 \
  -v "$work:/work:ro" -v "$old_dir:/old:ro" -v "$new_dir:/new:ro" "$image" \
  bash /work/native-update-test.sh --in-container "$kind" "$id" "$exe" "$repo" "$old" "$new"
