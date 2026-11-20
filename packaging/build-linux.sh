#!/usr/bin/env bash
# Builds every Linux artifact for one Codestead tool:
#   portable .tar.gz, .deb, .rpm, Arch .pkg.tar.zst (nfpm) and a self-updating .AppImage (Velopack).
# Usage: packaging/build-linux.sh <app-dir> <package-name> "<display name>" <executable> <version> [out-dir]
#   e.g. packaging/build-linux.sh ts/apps/linux codestead-linux "Codestead Linux" Codestead.Linux 0.6.6
#   (the values of the product in packaging/products.json; release.yml passes them from packaging/plan.py).
#   packaging/ts/package-app.mjs builds the TypeScript/Electron app and makes the app folder the packages are made of.
# Needs: node and the npm workspace in ts/ installed (npm ci), nfpm, vpk (dotnet tool install -g vpk), mksquashfs (4.4 or
# later, for zstd), xz, zstd.
set -euo pipefail

app="$1"
export PKG_NAME="$2"
export PKG_DISPLAY_NAME="$3"
export PKG_EXECUTABLE="$4"
export VERSION="$5"
out="${6:-artifacts}"
export PKG_SUMMARY="${PKG_SUMMARY:-Learn by doing}"
export PKG_DESCRIPTION="${PKG_DESCRIPTION:-$PKG_DISPLAY_NAME - learn the Linux shell by doing.}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
mkdir -p "$out"
export PUBLISH_DIR="$root/obj/publish/$PKG_NAME-linux-x64"
export GEN_DIR="$root/obj/packaging/$PKG_NAME"
rm -rf "$PUBLISH_DIR" "$GEN_DIR"
mkdir -p "$GEN_DIR"

node packaging/ts/package-app.mjs --app "$app" --id "$PKG_NAME" --name "$PKG_DISPLAY_NAME" --exe "$PKG_EXECUTABLE" \
  --version "$VERSION" --platform linux --out "$PUBLISH_DIR"

# Generated files with the names filled in.
fill() { sed -e "s|\${PKG_NAME}|$PKG_NAME|g" -e "s|\${PKG_DISPLAY_NAME}|$PKG_DISPLAY_NAME|g" \
             -e "s|\${PKG_EXECUTABLE}|$PKG_EXECUTABLE|g" -e "s|\${PKG_SUMMARY}|$PKG_SUMMARY|g" "$1"; }
fill packaging/linux/launcher.sh > "$GEN_DIR/launcher.sh"
fill packaging/linux/app.desktop > "$GEN_DIR/app.desktop"
fill packaging/ts/postinstall.sh > "$GEN_DIR/postinstall.sh"
fill packaging/ts/postremove.sh > "$GEN_DIR/postremove.sh"
fill packaging/ts/apparmor-profile > "$GEN_DIR/apparmor-profile"

# Portable archive (used by the Codestead hub).
tar -C "$PUBLISH_DIR" -czf "$out/$PKG_NAME-$VERSION-linux-x64.tar.gz" .

# Native packages. nfpm does not expand ${VARS} in file paths, so the config is filled in first.
perl -pe 's/\$\{(\w+)\}/$ENV{$1}/g' packaging/ts/nfpm.yaml > "$GEN_DIR/nfpm.yaml"
# Their compression: see the end of packaging/ts/nfpm.yaml.
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager deb --target "$out/${PKG_NAME}_${VERSION}_amd64.deb"
node packaging/ts/deb-xz.mjs "$out/${PKG_NAME}_${VERSION}_amd64.deb"
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager rpm --target "$out/$PKG_NAME-$VERSION-1.x86_64.rpm"
nfpm package --config "$GEN_DIR/nfpm.yaml" --packager archlinux --target "$GEN_DIR/arch.pkg.tar.zst"
zstd -d -q -c "$GEN_DIR/arch.pkg.tar.zst" | zstd -19 -T0 -q -c > "$out/$PKG_NAME-$VERSION-1-x86_64.pkg.tar.zst"
rm "$GEN_DIR/arch.pkg.tar.zst"

# Self-updating AppImage, its squashfs made with zstd (packaging/ts/squashfs/mksquashfs, which vpk runs instead of the
# real one). Its runtime must read that: it extracts a file of it again here.
REAL_MKSQUASHFS="$(command -v mksquashfs)" PATH="$root/packaging/ts/squashfs:$PATH" \
  vpk pack --packId "$PKG_NAME" --packVersion "$VERSION" --packDir "$PUBLISH_DIR" \
  --mainExe "$PKG_EXECUTABLE" --packTitle "$PKG_DISPLAY_NAME" --icon "build/icons/$PKG_NAME.png" \
  --outputDir "$GEN_DIR/velopack" --runtime linux-x64
appimage=$(ls "$GEN_DIR"/velopack/*.AppImage)
(cd "$GEN_DIR" && "$appimage" --appimage-extract usr/bin/sq.version >/dev/null)
grep -q "<version>$VERSION</version>" "$GEN_DIR/squashfs-root/usr/bin/sq.version" \
  || { echo "The AppImage's runtime did not extract its own sq.version" >&2; exit 1; }
rm -rf "$GEN_DIR/squashfs-root"
cp "$appimage" "$out/$PKG_NAME-$VERSION-linux-x86_64.AppImage"
# Velopack update feed files (used for auto-update of the AppImage).
mkdir -p "$out/velopack-linux"
cp "$GEN_DIR"/velopack/* "$out/velopack-linux/"

ls -la "$out"
