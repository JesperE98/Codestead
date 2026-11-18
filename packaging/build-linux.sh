#!/usr/bin/env bash
# Builds every Linux artifact for one Codestead tool:
#   portable .tar.gz, .deb, .rpm, Arch .pkg.tar.zst (nfpm) and a self-updating .AppImage (Velopack).
# Usage: packaging/build-linux.sh [--ts <app-dir>] <project> <package-name> "<display name>" <version> [out-dir]
#   e.g. packaging/build-linux.sh src/Linux/Codestead.Linux/Codestead.Linux.csproj codestead-linux "Codestead Linux" 0.4.0
#   --ts ts/apps/linux: the TypeScript/Electron app instead of the C# project (docs/TYPESCRIPT-MIGRATION.md): the same
#   artifacts, names, package ids and paths, from the app folder packaging/ts/package-app.mjs makes; the C# project
#   still names the executable.
# Needs: dotnet (or, with --ts, node and the npm workspace in ts/ installed), nfpm, vpk (dotnet tool install -g vpk).
set -euo pipefail

ts_app=""
if [[ "${1:-}" == "--ts" ]]; then
  ts_app="$2"
  shift 2
fi
project="$1"
export PKG_NAME="$2"
export PKG_DISPLAY_NAME="$3"
export VERSION="$4"
out="${5:-artifacts}"
export PKG_EXECUTABLE
PKG_EXECUTABLE="$(basename "$project" .csproj)"
export PKG_SUMMARY="${PKG_SUMMARY:-Learn by doing}"
export PKG_DESCRIPTION="${PKG_DESCRIPTION:-$PKG_DISPLAY_NAME - learn the Linux shell by doing.}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
mkdir -p "$out"
export PUBLISH_DIR="$root/obj/publish/$PKG_NAME-linux-x64"
export GEN_DIR="$root/obj/packaging/$PKG_NAME"
rm -rf "$PUBLISH_DIR" "$GEN_DIR"
mkdir -p "$GEN_DIR"

if [[ -n "$ts_app" ]]; then
  node packaging/ts/package-app.mjs --app "$ts_app" --id "$PKG_NAME" --name "$PKG_DISPLAY_NAME" --exe "$PKG_EXECUTABLE" \
    --version "$VERSION" --platform linux --out "$PUBLISH_DIR"
  nfpm_config=packaging/ts/nfpm.yaml
else
  dotnet publish "$project" -c Release -r linux-x64 --self-contained true \
    -p:Version="$VERSION" -p:PublishSingleFile=false -o "$PUBLISH_DIR"
  nfpm_config=packaging/nfpm.yaml
fi

# Generated files with the names filled in.
fill() { sed -e "s|\${PKG_NAME}|$PKG_NAME|g" -e "s|\${PKG_DISPLAY_NAME}|$PKG_DISPLAY_NAME|g" \
             -e "s|\${PKG_EXECUTABLE}|$PKG_EXECUTABLE|g" -e "s|\${PKG_SUMMARY}|$PKG_SUMMARY|g" "$1"; }
fill packaging/linux/launcher.sh > "$GEN_DIR/launcher.sh"
fill packaging/linux/app.desktop > "$GEN_DIR/app.desktop"
[[ -z "$ts_app" ]] || fill packaging/ts/postinstall.sh > "$GEN_DIR/postinstall.sh"

# Portable archive (used by the Codestead hub).
tar -C "$PUBLISH_DIR" -czf "$out/$PKG_NAME-$VERSION-linux-x64.tar.gz" .

# Native packages. nfpm does not expand ${VARS} in file paths, so the config is filled in first.
perl -pe 's/\$\{(\w+)\}/$ENV{$1}/g' "$nfpm_config" > "$GEN_DIR/nfpm.yaml"
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager deb --target "$out/${PKG_NAME}_${VERSION}_amd64.deb"
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager rpm --target "$out/$PKG_NAME-$VERSION-1.x86_64.rpm"
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager archlinux --target "$out/$PKG_NAME-$VERSION-1-x86_64.pkg.tar.zst"

# Self-updating AppImage.
vpk pack --packId "$PKG_NAME" --packVersion "$VERSION" --packDir "$PUBLISH_DIR" \
  --mainExe "$PKG_EXECUTABLE" --packTitle "$PKG_DISPLAY_NAME" --icon "build/icons/$PKG_NAME.png" \
  --outputDir "$GEN_DIR/velopack" --runtime linux-x64
cp "$GEN_DIR"/velopack/*.AppImage "$out/$PKG_NAME-$VERSION-linux-x86_64.AppImage"
# Velopack update feed files (used for auto-update of the AppImage).
mkdir -p "$out/velopack-linux"
cp "$GEN_DIR"/velopack/* "$out/velopack-linux/"

ls -la "$out"
