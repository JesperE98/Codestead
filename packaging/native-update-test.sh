#!/usr/bin/env bash
# The update button of the hub installed as a native package (.deb, .rpm or Arch), end to end in a clean container:
# an OLDER hub is installed with the system's package manager, the signed catalog of the releases repository names a
# NEWER build, and the hub downloads that version's package from "GitHub", checks it against the SHA-256 the signed
# catalog gives it, installs it with the package manager and starts again as the new version
# (ts/packages/ui/src/electron/NativePackageUpdate.ts, SignedCatalog.ts).
#
# Nothing in the app can point its updates at another address or key, and the test adds no switch for it: as a
# man-in-the-middle would have to, it changes the system. The container's /etc/hosts sends github.com and
# objects.githubusercontent.com to a local HTTPS server (packaging/native-update-server.cjs, run by the installed
# Electron as Node), whose certificate is signed by a throw-away CA that only the container trusts (Chromium's NSS
# database of the user); the catalog there is signed with a throw-away key, which the test writes over the release key
# built into the INSTALLED old hub (its main.cjs, as root – what only someone who already owns the system could do).
# The hub is started with --smoke-test --self-update-test: its update button without the window.
#
# The old hub can be a build of this commit or the previous release (release.yml's upgrade gate). Hubs before 0.2.8
# checked the package against the release's SHA256SUMS.txt, with the catalog of --catalog/--public-key: the server
# has both, and the checks follow what the old hub does. A hub without --self-update-test (before 0.2.7) is skipped.
#
# Cases: as root (no pkexec); a SHA-256 that does not match, and (signed catalog) a catalog whose signature is not the
# built-in key's and one that does not list the package; a download redirected away from GitHub's hosts (nothing is
# installed); as a normal user with a fake pkexec that records its arguments and runs them with sudo; and that fake
# pkexec acting as if the password dialog was closed (126). After each: the installed package's version, and that the
# restarted hub is the new version.
#
# Usage (on a machine with docker; <old> holds the old hub's package of this kind, <new> packaging/build-linux.sh's
# output folder of the new hub):
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

  fail() { echo "NATIVE UPDATE TEST FAILED: $*" >&2; exit 1; }
  installed_version() {
    case "$kind" in
      deb) dpkg-query -W --showformat='${Version}' "$id" | sed 's/-[0-9]*$//' ;;
      rpm) rpm -q --qf '%{VERSION}' "$id" ;;
      arch) pacman -Q "$id" | awk '{print $2}' | sed 's/-[0-9]*$//' ;;
    esac
  }
  # The release key's two lines of base64 and the test key's (the PEM's lines 2 and 3; P-256 keys have the same length).
  local real1 real2 test1 test2
  real1=$(sed -n 2p /work/release-key.pem); real2=$(sed -n 3p /work/release-key.pem)
  test1=$(sed -n 2p /work/pub.pem); test2=$(sed -n 3p /work/pub.pem)
  # The installed hub's main process (where the build put the built-in key).
  main_js() { grep -rlF --include='*.cjs' -- "$1" "/opt/$id/resources/app" 2>/dev/null || true; }
  install_old() {
    case "$kind" in
      deb) apt-get install -y -qq --no-install-recommends --allow-downgrades "$pkg_old" >/dev/null 2>&1 \
             || apt-get install -y --no-install-recommends --allow-downgrades "$pkg_old" ;;
      # (--nosignature: the packages are not signed, and newer rpm refuses unsigned packages without it.)
      rpm) if rpm -q "$id" >/dev/null 2>&1; then rpm -U --oldpackage --nosignature "$pkg_old"; else dnf install -y -q --setopt=install_weak_deps=False "$pkg_old" >/dev/null; fi ;;
      arch) pacman -U --noconfirm "$pkg_old" >/dev/null ;;
    esac
    [[ "$(installed_version)" == "$old" ]] || { echo "The old version is not installed ($(installed_version))" >&2; exit 1; }
    # The man in the middle owns the system: the test key replaces the release key built into the installed hub.
    local files; files=$(main_js "$real1")
    if [[ -n "$files" ]]; then
      # shellcheck disable=SC2086
      sed -i "s|$real1|$test1|g; s|$real2|$test2|g" $files
    fi
    [[ $signed == 0 ]] || key_replaced
  }
  key_replaced() {
    [[ -n "$(main_js "$test1")" && -z "$(main_js "$real1")" ]] || fail "the release key built into the old hub was not found and replaced"
  }

  echo "--- Installing $id $old ($kind)"
  local signed=0
  install_old
  # The main process: "main" of the app folder's package.json (packaging/ts/package-app.mjs).
  local main
  main="/opt/$id/resources/app/$(sed -n -E 's/^ *"main": *"([^"]+)".*/\1/p' "/opt/$id/resources/app/package.json" | head -1)"
  [[ -f "$main" ]] || fail "no main process in /opt/$id/resources/app/package.json"
  if ! grep -qF -- "--self-update-test" "$main"; then
    echo "::notice::NATIVE UPDATE TEST SKIPPED: $id $old has no --self-update-test (its native update came later)"
    return 0
  fi
  # 0.2.8 and later: the package's SHA-256 from the signed catalog of the releases repository (built-in key).
  if grep -qF "matches the signed catalog" "$main"; then signed=1; key_replaced; fi
  echo "The old hub checks the package against $([[ $signed == 1 ]] && echo "the signed catalog" || echo "the release's SHA256SUMS.txt")"

  echo "--- The release $id-v$new and the signed catalog on the stand-in for GitHub"
  mkdir -p "/srv/release/$id-v$new" /srv/release/catalog
  ln -s "/new/$pkg_new" "/srv/release/$id-v$new/$pkg_new"
  (cd /new && sha256sum "$pkg_new") > /srv/sums-good
  sed -E 's/^[0-9a-f]{8}/00000000/' /srv/sums-good > /srv/sums-bad
  cp /srv/sums-good "/srv/release/$id-v$new/SHA256SUMS.txt"
  # catalog <variant>: what the releases repository's catalog is (catalog: the good one; catalog-badsum: another
  # SHA-256 for the package; catalog-nopackages: no native packages; catalog-otherkey: signed with another key).
  serve_catalog() {
    cp "/work/$1.json" /srv/release/catalog/catalog.json
    cp "/work/$1.json.sig" /srv/release/catalog/catalog.json.sig
  }
  serve_catalog catalog
  ELECTRON_RUN_AS_NODE=1 "/opt/$id/$exe.bin" /work/native-update-server.cjs /srv/release /work/server.pem /work/server.key "$repo" > /tmp/server.log 2>&1 &
  for _ in $(seq 50); do grep -q listening /tmp/server.log && break; sleep 0.2; done
  grep -q listening /tmp/server.log || { cat /tmp/server.log; fail "the server did not start"; }
  server_requests() { tail -n +"$(($1 + 1))" /tmp/server.log; }

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
  # sandbox; the restarted hub gets the same arguments). --catalog/--public-key: the tool list of the smoke test (and,
  # before 0.2.8, the catalog the update's version came from); 0.2.8 and later ignore them for the update.
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
  not_installed() { # <why>: the old version is still installed, nothing was left behind
    [[ "$(installed_version)" == "$old" ]] || fail "installed after $1: $(installed_version)"
    [[ -z "$(leftovers)" ]] || fail "temporary files left: $(leftovers)"
  }
  local out before

  echo "=== 1. As root: the package manager without pkexec"
  before=$(wc -l < /tmp/server.log)
  out=$(run_update root); echo "$out"
  grep -q "installed as $kind, canUpdateItself=true, asksForPassword=false" <<<"$out" || fail "not seen as a $kind installation"
  grep -q "SELF-UPDATE available: $new" <<<"$out" || fail "the update was not found"
  if [[ $signed == 1 ]]; then
    grep -q "matches the signed catalog" <<<"$out" || fail "the package was not checked against the signed catalog"
    grep -q "GET https://github.com/$repo/releases/download/catalog/catalog.json.sig" <<<"$(server_requests "$before")" || fail "the catalog's signature was not downloaded"
    ! grep -q "SHA256SUMS.txt" <<<"$(server_requests "$before")" || fail "SHA256SUMS.txt was downloaded"
  else
    grep -q "matches SHA256SUMS.txt" <<<"$out" || fail "the checksum was not checked"
  fi
  grep -q "GET https://objects.githubusercontent.com/test-release-asset/$id-v$new/$pkg_new" <<<"$(server_requests "$before")" || fail "the package was not downloaded"
  grep -q "SMOKE OK Codestead $new" <<<"$out" || fail "the hub did not start again as $new"
  [[ "$(installed_version)" == "$new" ]] || fail "installed: $(installed_version)"
  [[ "$("/usr/bin/$id" --version 2>/dev/null | tail -1)" == "$new" ]] || fail "/usr/bin/$id --version is not $new"
  [[ -z "$(leftovers)" ]] || fail "temporary files left: $(leftovers)"

  echo "=== 2. A SHA-256 that does not match: nothing is installed"
  install_old
  if [[ $signed == 1 ]]; then
    serve_catalog catalog-badsum
    out=$(run_update root); echo "$out"
    grep -q "SELF-UPDATE FAILED: $pkg_new does not have the SHA-256 the signed catalog gives it" <<<"$out" || fail "a wrong SHA-256 was not refused"
    not_installed "a wrong SHA-256"

    echo "=== 2b. A catalog that is not signed with the built-in key: nothing is offered or downloaded"
    serve_catalog catalog-otherkey
    before=$(wc -l < /tmp/server.log)
    out=$(run_update root); echo "$out"
    grep -q "SELF-UPDATE FAILED: The catalog signature is wrong" <<<"$out" || fail "a catalog with another key's signature was used"
    ! grep -q "$pkg_new" <<<"$(server_requests "$before")" || fail "the package was downloaded with a catalog of another key"
    not_installed "a catalog with another key's signature"

    echo "=== 2c. A signed catalog that does not list the package: nothing is downloaded"
    serve_catalog catalog-nopackages
    before=$(wc -l < /tmp/server.log)
    out=$(run_update root); echo "$out"
    grep -q "SELF-UPDATE FAILED: The signed catalog lists no $pkg_new for $id $new" <<<"$out" || fail "a package missing from the catalog was not refused"
    ! grep -q "$pkg_new" <<<"$(server_requests "$before")" || fail "a package missing from the catalog was downloaded"
    not_installed "a catalog without the package"
    serve_catalog catalog
  else
    cp /srv/sums-bad "/srv/release/$id-v$new/SHA256SUMS.txt"
    out=$(run_update root); echo "$out"
    grep -q "SELF-UPDATE FAILED: $pkg_new does not have the checksum its release gives" <<<"$out" || fail "a wrong checksum was not refused"
    not_installed "a wrong checksum"
    cp /srv/sums-good "/srv/release/$id-v$new/SHA256SUMS.txt"
  fi

  echo "=== 3. The package's download redirected away from GitHub's hosts: refused"
  echo "$pkg_new" > /srv/redirect-away
  out=$(run_update root); echo "$out"
  grep -q "SELF-UPDATE FAILED: The download was redirected away from GitHub: https://elsewhere.test/test-release-asset/$id-v$new/$pkg_new" <<<"$out" || fail "a redirect away from GitHub was followed"
  not_installed "a redirect away from GitHub"
  rm /srv/redirect-away

  echo "=== 4. As a user, the password dialog closed (pkexec 126)"
  touch /tmp/pkexec-cancel
  out=$(run_update tester); echo "$out"
  grep -q "asksForPassword=true" <<<"$out" || fail "a user's update should ask for the password"
  grep -q "SELF-UPDATE FAILED: The password dialog was closed" <<<"$out" || fail "the closed dialog was not reported"
  not_installed "the dialog was closed"
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

  echo "NATIVE UPDATE TEST OK ($kind: $old -> $new, $([[ $signed == 1 ]] && echo "signed catalog" || echo "SHA256SUMS.txt"))"
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
# The signed catalog of the stand-in releases repository names the new hub and lists its native packages (signed with a
# throw-away key, which the container writes over the release key built into the old hub; the smoke test's
# --public-key). Its variants: another SHA-256 for the package, no native packages, signed with yet another key.
openssl ecparam -name prime256v1 -genkey -noout -out "$work/key.pem"
openssl ec -in "$work/key.pem" -pubout -out "$work/pub.pem" 2>/dev/null
openssl ecparam -name prime256v1 -genkey -noout -out "$work/other-key.pem"
cp "$root/build/catalog-signing.pub.pem" "$work/release-key.pem"
echo "a portable archive the test does not download" > "$work/hub.tar.gz"
packages=()
for f in "${id}_${new}_amd64.deb=deb" "$id-$new-1.x86_64.rpm=rpm" "$id-$new-1-x86_64.pkg.tar.zst=arch"; do
  [[ -f "$new_dir/${f%=*}" ]] && packages+=(--native-package "linux-x64=${f#*=}=$new_dir/${f%=*}")
done
make_catalog() { # <file> [--native-package ...]
  local file="$1"; shift
  python3 "$root/packaging/catalog.py" --catalog "$file" --id "$id" --name "$name" --version "$new" \
    --description-file "$root/src/Hub/description.json" \
    --asset "linux-x64=$work/hub.tar.gz=https://github.com/$repo/releases/download/$id-v$new/$id-$new-linux-x64.tar.gz=$exe" "$@"
}
sign_catalog() { openssl dgst -sha256 -sign "$2" "$1" | base64 | tr -d '\n' > "$1.sig"; }
make_catalog "$work/catalog.json" "${packages[@]}"
sign_catalog "$work/catalog.json" "$work/key.pem"
python3 - "$work/catalog.json" "$work/catalog-badsum.json" "$kind" <<'PY'
import json, sys
c = json.load(open(sys.argv[1], encoding="utf-8"))
entry = c["tools"][0]["nativePackages"]["linux-x64"][sys.argv[3]]
entry["sha256"] = "0" * 8 + entry["sha256"][8:]
json.dump(c, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
sign_catalog "$work/catalog-badsum.json" "$work/key.pem"
make_catalog "$work/catalog-nopackages.json"
sign_catalog "$work/catalog-nopackages.json" "$work/key.pem"
cp "$work/catalog.json" "$work/catalog-otherkey.json"
sign_catalog "$work/catalog-otherkey.json" "$work/other-key.pem"
rm "$work/key.pem" "$work/other-key.pem" "$work/ca.key"
chmod -R a+rX "$work"

# NATIVE_UPDATE_DOCKER_ARGS: more options for docker run (e.g. "--tmpfs /opt:exec,size=2g" where disk space is short).
# shellcheck disable=SC2086
docker run --rm ${NATIVE_UPDATE_DOCKER_ARGS:-} --add-host github.com:127.0.0.1 --add-host objects.githubusercontent.com:127.0.0.1 \
  --add-host elsewhere.test:127.0.0.1 \
  -v "$work:/work:ro" -v "$old_dir:/old:ro" -v "$new_dir:/new:ro" "$image" \
  bash /work/native-update-test.sh --in-container "$kind" "$id" "$exe" "$repo" "$old" "$new"
