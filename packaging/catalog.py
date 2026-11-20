#!/usr/bin/env python3
"""Adds or updates one tool in the hub's catalog.json (the release workflow signs the result).

Usage:
  packaging/catalog.py --catalog catalog.json --id codestead-linux --name "Codestead Linux" \
      --version 0.4.0 --notes-url URL --description-file src/Linux/description.json \
      --changelog-file src/Linux/changelog.json \
      --asset linux-x64=FILE=URL=EXECUTABLE [--asset win-x64=FILE=URL=EXECUTABLE ...] \
      --native-package linux-x64=deb=FILE [--native-package linux-x64=rpm=FILE ...]

The catalog file is created if it does not exist. Sizes and SHA-256 sums are computed from the files.

"nativePackages" (the .deb, .rpm and Arch packages of the version, by runtime id and kind: file name, SHA-256, size) is
what an app installed as such a package checks its update against (ts/packages/ui/src/electron/SignedCatalog.ts): the
catalog is signed, the release's SHA256SUMS.txt is not. The file names are the ones in the release <id>-v<version>.
The catalog only grows: released hubs ignore properties they do not know (as the C# hub's System.Text.Json did), so
new properties may be added to a tool, but the existing ones must keep their names, types and meaning.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys

# The kinds of native package the apps can update themselves from (NativePackageKind in NativePackageUpdate.ts).
NATIVE_KINDS = ("deb", "rpm", "arch")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--catalog", required=True)
    p.add_argument("--id", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--notes-url")
    p.add_argument("--description-file", required=True)
    p.add_argument("--changelog-file", help="src/<App>/changelog.json: the latest versions' changes are shown by the hub")
    p.add_argument("--asset", action="append", default=[], help="RID=FILE=URL=EXECUTABLE")
    p.add_argument("--native-package", action="append", default=[],
                   help="RID=KIND=FILE: a native package of the version (KIND: deb, rpm or arch), named as in its release")
    a = p.parse_args()

    catalog = {"schema": 1, "generated": "", "tools": []}
    if os.path.exists(a.catalog) and os.path.getsize(a.catalog) > 0:
        with open(a.catalog, encoding="utf-8") as f:
            catalog = json.load(f)
    with open(a.description_file, encoding="utf-8") as f:
        description = json.load(f)
    if "en" not in description:
        sys.exit("the description needs an English text (\"en\")")

    assets = {}
    for spec in a.asset:
        rid, path, url, exe = spec.split("=", 3)
        assets[rid] = {"url": url, "sha256": sha256(path), "size": os.path.getsize(path), "executable": exe}

    native = {}
    for spec in a.native_package:
        rid, kind, path = spec.split("=", 2)
        if kind not in NATIVE_KINDS:
            sys.exit(f"--native-package {spec}: the kind must be one of {', '.join(NATIVE_KINDS)}")
        name = os.path.basename(path)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._+-]*", name) or ".." in name:
            sys.exit(f"--native-package {spec}: not a plain file name")
        if os.path.getsize(path) <= 0:
            sys.exit(f"--native-package {spec}: the file is empty")
        native.setdefault(rid, {})[kind] = {"file": name, "sha256": sha256(path), "size": os.path.getsize(path)}

    tool = {"id": a.id, "name": a.name, "description": description, "version": a.version, "assets": assets}
    if native:
        tool["nativePackages"] = native
    if a.notes_url:
        tool["releaseNotesUrl"] = a.notes_url
    if a.changelog_file:
        with open(a.changelog_file, encoding="utf-8") as f:
            changes = json.load(f)
        # Only versions up to the one being published, newest first, and not the whole history.
        def key(v):
            return tuple(int(x) for x in v.split("."))
        changes = [c for c in changes if key(c["version"]) <= key(a.version)]
        changes.sort(key=lambda c: key(c["version"]), reverse=True)
        tool["changes"] = changes[:10]
    catalog["tools"] = [t for t in catalog.get("tools", []) if t.get("id") != a.id] + [tool]
    catalog["tools"].sort(key=lambda t: t["id"])
    catalog["generated"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(a.catalog, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write("\n")
    packages = [f"{rid} {kind}" for rid, kinds in native.items() for kind in kinds]
    print(f"{a.catalog}: {a.id} {a.version} ({', '.join(assets) or 'no assets'}; native packages: {', '.join(packages) or 'none'})")


if __name__ == "__main__":
    main()
