#!/usr/bin/env python3
"""Adds or updates one tool in the hub's catalog.json (the release workflow signs the result).

Usage:
  packaging/catalog.py --catalog catalog.json --id codestead-linux --name "Codestead Linux" \
      --version 0.4.0 --notes-url URL --description-file src/Linux/description.json \
      --changelog-file src/Linux/changelog.json \
      --asset linux-x64=FILE=URL=EXECUTABLE [--asset win-x64=FILE=URL=EXECUTABLE ...]

The catalog file is created if it does not exist. Sizes and SHA-256 sums are computed from the files.
"""
import argparse
import datetime
import hashlib
import json
import os
import sys


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

    tool = {"id": a.id, "name": a.name, "description": description, "version": a.version, "assets": assets}
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
    print(f"{a.catalog}: {a.id} {a.version} ({', '.join(assets) or 'no assets'})")


if __name__ == "__main__":
    main()
