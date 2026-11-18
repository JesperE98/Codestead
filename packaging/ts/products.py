#!/usr/bin/env python3
"""The products of packaging/products.json for the TypeScript packaging workflow (.github/workflows/ts-packaging.yml).

The same names, ids and executables as packaging/plan.py gives the release workflow (from the C# projects' properties),
plus the TypeScript app of each product (ts/apps/<key>). The version is the one the switch (phase 6) would release the
build as: one patch above the newest release <id>-v<major.minor>.<patch> in the releases repository, as plan.py counts
(major.minor.0 when there is none, or when the releases cannot be listed). These builds are install-tested, never
published; the upgrade test (packaging/upgrade-test.sh) updates the released C# version to them, which needs the higher
version. Writes products=[...] to $GITHUB_OUTPUT.
"""
import json
import os
import re
import subprocess

REPO = os.environ.get("RELEASES_REPO", "JesperE98/codestead-releases")


def release_tags():
    """The releases repository's tags (gh with GH_TOKEN, as plan.py), or None when they cannot be listed."""
    try:
        r = subprocess.run(["gh", "release", "list", "--repo", REPO, "--limit", "1000", "--json", "tagName", "--jq", ".[].tagName"],
                           capture_output=True, text=True)
    except FileNotFoundError:
        return None
    return r.stdout.split() if r.returncode == 0 else None


def next_version(pid, minor, tags):
    """plan.py's next version of a product that changed: the newest patch of major.minor plus one, else .0."""
    patches = sorted(int(m.group(1)) for t in tags or [] if (m := re.fullmatch(rf"{re.escape(pid)}-v{re.escape(minor)}\.(\d+)", t)))
    return f"{minor}.{patches[-1] + 1}" if patches else f"{minor}.0"


def main():
    products = []
    tags = release_tags()
    if tags is None:
        print("::warning::The releases could not be listed: the builds get version major.minor.0 (the upgrade test needs a higher one than the released).")
    for p in json.load(open("packaging/products.json")):
        out = subprocess.check_output(["dotnet", "msbuild", p["project"], "-getProperty:AssemblyName",
                                       f"-getProperty:{p['idProperty']}", f"-getProperty:{p['nameProperty']}",
                                       f"-getProperty:{p['versionProperty']}"], text=True)
        props = json.loads(out)["Properties"]
        app = f"ts/apps/{p['key']}"
        if not os.path.isfile(os.path.join(app, "package.json")):
            raise SystemExit(f"{p['key']}: no TypeScript app in {app}")
        product = {"key": p["key"], "id": props[p["idProperty"]], "name": props[p["nameProperty"]],
                   "version": next_version(props[p["idProperty"]], props[p["versionProperty"]], tags), "exe": props["AssemblyName"],
                   "project": p["project"], "summary": p["summary"], "dir": p["dir"], "app": app}
        products.append(product)
        print(f"{product['name']} {product['version']}: {app} as {product['exe']}")
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"products={json.dumps(products)}\n")


if __name__ == "__main__":
    main()
