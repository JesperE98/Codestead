#!/usr/bin/env bash
# End-to-end test of the hub (Linux or Windows/Git Bash): unpacks the portable hub, writes a catalog with the
# portable tool package (as file:// URL), signs it with a throw-away key, and lets the hub install the tool,
# start it with --smoke-test and uninstall it again – the same code path a user takes, minus the download.
# Usage: packaging/hub-e2e.sh <hub-archive> <hub-exe> <tool-archive> <tool-id> <tool-name> <tool-version> <tool-exe> <rid>
set -euo pipefail
hub_archive="$1"; hub_exe="$2"; tool_archive="$3"; tool_id="$4"; tool_name="$5"; tool_version="$6"; tool_exe="$7"; rid="$8"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
native() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
# Git Bash on Windows: never rewrite arguments that look like paths – they are given as Windows paths.
export MSYS2_ARG_CONV_EXCL="*"
py=$(command -v python || command -v python3)
abs() { echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; }

mkdir -p "$work/hub"
case "$hub_archive" in
  *.zip) "$py" -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$(native "$(abs "$hub_archive")")" "$(native "$work/hub")" ;;
  *) tar -xzf "$hub_archive" -C "$work/hub" ;;
esac

# openssl on Windows is a native program: give it Windows paths.
openssl ecparam -name prime256v1 -genkey -noout -out "$(native "$work/key.pem")"
openssl ec -in "$(native "$work/key.pem")" -pubout -out "$(native "$work/pub.pem")" 2>/dev/null
tool_file="$(native "$(abs "$tool_archive")")"
url=$("$py" -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).resolve().as_uri())' "$tool_file")
"$py" "$(native "$root/packaging/catalog.py")" --catalog "$(native "$work/catalog.json")" --id "$tool_id" --name "$tool_name" \
  --version "$tool_version" --description-file "$(native "$root/packaging/descriptions/$tool_id.json")" \
  --asset "$rid=$tool_file=$url=$tool_exe"
openssl dgst -sha256 -sign "$(native "$work/key.pem")" "$(native "$work/catalog.json")" | base64 | tr -d '\n' > "$work/catalog.json.sig"

export CODESTEAD_HUB_DIR="$(native "$work/hub-data")" CODESTEAD_DATA_DIR="$(native "$work/settings")"
args=(--smoke-test --catalog "$(native "$work/catalog.json")" --public-key "$(native "$work/pub.pem")" --install "$tool_id")
if [[ "$rid" == linux-* ]]; then
  chmod +x "$work/hub/$hub_exe"
  out=$(timeout 300 xvfb-run -a "$work/hub/$hub_exe" "${args[@]}" 2>&1) || { echo "$out"; exit 1; }
else
  out=$(timeout 300 "$work/hub/$hub_exe.exe" "${args[@]}" 2>&1) || { echo "$out"; exit 1; }
fi
echo "$out"
grep -q "SMOKE OK" <<<"$out" || { echo "The hub did not print SMOKE OK" >&2; exit 1; }
grep -q "installed, started and removed $tool_id" <<<"$out" || { echo "The hub did not install and start $tool_id" >&2; exit 1; }
echo "HUB END-TO-END TEST OK ($rid)"
