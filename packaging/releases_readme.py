#!/usr/bin/env python3
"""Writes the README of the public releases repository (JesperE98/codestead-releases).

Several products share that repository (the hub, Codestead Linux and later more tools) plus the hub's
catalog, so the README explains what is there: one section per product with its latest version and
download links, and what the different releases are. The release flow regenerates it after every publish.

Usage: releases_readme.py --repo OWNER/REPO --tags FILE [--out README.md]
  --tags  a file with the repository's release tags, one per line (gh release list --json tagName ...)
"""
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Downloads per system: (system, file name in the <id>-latest release, how to install).
DOWNLOADS = [
    ("Windows 10/11 (x64)", "{id}-win-x64-Setup.exe", "Run the file. It installs for your user and updates itself."),
    ("Ubuntu / Debian", "{id}_amd64.deb", "`sudo apt install ./{id}_amd64.deb`"),
    ("Fedora", "{id}.x86_64.rpm", "`sudo dnf install ./{id}.x86_64.rpm`"),
    ("Arch Linux / CachyOS", "{id}-x86_64.pkg.tar.zst", "`sudo pacman -U {id}-x86_64.pkg.tar.zst`"),
    ("Any Linux (AppImage)", "{id}-linux-x86_64.AppImage", "`chmod +x` the file and start it. It updates itself."),
]

# Products in this order; the hub first, because it installs the others.
ORDER = {"hub": 0}


def product_ids():
    """(key, id, title, summary) of every product, read from build/Codestead.props and packaging/products.json."""
    props = open(os.path.join(ROOT, "build", "Codestead.props"), encoding="utf-8").read()
    out = []
    for p in json.load(open(os.path.join(ROOT, "packaging", "products.json"), encoding="utf-8")):
        m = re.search(rf"<{p['idProperty']}>([^<]+)</{p['idProperty']}>", props)
        if not m:
            raise SystemExit(f"{p['idProperty']} is missing from build/Codestead.props")
        out.append((p["key"], m.group(1), p.get("title", m.group(1)), p["summary"]))
    return sorted(out, key=lambda x: ORDER.get(x[0], 1))


def latest_version(pid, tags):
    """The highest <id>-v<x.y.z> tag, or None."""
    versions = []
    for t in tags:
        m = re.fullmatch(rf"{re.escape(pid)}-v(\d+)\.(\d+)\.(\d+)", t.strip())
        if m:
            versions.append(tuple(int(x) for x in m.groups()))
    return ".".join(map(str, max(versions))) if versions else None


def render(repo, tags):
    base = f"https://github.com/{repo}"
    lines = [
        "# Codestead – downloads",
        "",
        "Installers for **Codestead**, a family of learning tools where you learn by doing. Every tool and the",
        "hub have their own releases here; their names start with the tool's id.",
        "",
        "**New here? Install the Codestead hub.** It installs, starts and updates the tools for you.",
        "",
    ]
    for key, pid, title, summary in product_ids():
        version = latest_version(pid, tags)
        if version is None:
            continue
        lines += [
            f"## {title}",
            "",
            f"{summary}. Latest version: **{version}** · "
            f"[release notes]({base}/releases/tag/{pid}-v{version}) · "
            f"[all versions]({base}/releases?q={pid}-v&expanded=true)",
            "",
            "| System | Download | How to install |",
            "|---|---|---|",
        ]
        for system, file, how in DOWNLOADS:
            name = file.format(id=pid)
            lines.append(f"| **{system}** | [{name}]({base}/releases/download/{pid}-latest/{name}) | {how.format(id=pid)} |")
        lines.append("")
    lines += [
        "## What the releases are",
        "",
        "| Release | Contents |",
        "|---|---|",
        "| `<id>-v<version>`, e.g. `codestead-linux-v0.5.1` | Every file of that version and `SHA256SUMS.txt` with their checksums |",
        "| `<id>-latest` | The latest version under fixed names (the links above), and the update feed that installed copies check |",
        "| `catalog` | `catalog.json`, the signed list of tools the hub reads (`catalog.json.sig` is its signature) |",
        "",
        "The apps are not yet signed with a developer certificate. On Windows, SmartScreen may say",
        "\"Windows protected your PC\": choose **More info** → **Run anyway**.",
        "",
        "This page is updated automatically when a new version is published.",
        "",
    ]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--tags", required=True)
    ap.add_argument("--out", default="README.md")
    a = ap.parse_args()
    tags = [t for t in open(a.tags, encoding="utf-8").read().split("\n") if t.strip()]
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(render(a.repo, tags))


if __name__ == "__main__":
    main()
