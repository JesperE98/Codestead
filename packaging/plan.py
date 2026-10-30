#!/usr/bin/env python3
"""Decides the version of every product and which ones to publish (the "plan" job of release.yml).

For each product in packaging/products.json:
  - major.minor comes from build/Codestead.props (e.g. CodesteadLinuxVersion = 0.5);
  - the patch number is one more than the newest release <id>-v<major.minor>.<patch> in the releases
    repository, or 0 if there is none;
  - a new version is only made if the product's files ("paths") changed since the commit the newest
    release was built from (recorded as <!-- codestead-source: SHA --> in its release notes).
Publishing also needs WANT_PUBLISH=true (push to main, or "publish" ticked) and both secrets.
Writes products=[...] and publish=[...] to $GITHUB_OUTPUT.
"""
import json
import os
import re
import subprocess

REPO = os.environ.get("RELEASES_REPO", "jesper-e98/codestead-releases")


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def releases():
    r = run("gh", "release", "list", "--repo", REPO, "--limit", "1000", "--json", "tagName", "--jq", ".[].tagName")
    return r.stdout.split() if r.returncode == 0 else []


def source_commit(tag):
    r = run("gh", "release", "view", tag, "--repo", REPO, "--json", "body", "--jq", ".body")
    m = re.search(r"codestead-source: ([0-9a-f]{40})", r.stdout) if r.returncode == 0 else None
    return m.group(1) if m else None


def changed_since(sha, paths):
    if sha is None:
        return True
    if run("git", "cat-file", "-e", f"{sha}^{{commit}}").returncode != 0:
        return True  # unknown commit (e.g. history rewritten): treat as changed
    return run("git", "diff", "--quiet", sha, "HEAD", "--", *paths).returncode != 0


def main():
    want = os.environ.get("WANT_PUBLISH") == "true"
    secrets_ok = os.environ.get("SECRETS_OK") == "true" and os.path.exists("build/catalog-signing.pub.pem")
    tags = releases()
    products, publish = [], []
    for p in json.load(open("packaging/products.json")):
        out = subprocess.check_output(["dotnet", "msbuild", p["project"], "-getProperty:AssemblyName",
                                       f"-getProperty:{p['idProperty']}", f"-getProperty:{p['nameProperty']}",
                                       f"-getProperty:{p['versionProperty']}"], text=True)
        props = json.loads(out)["Properties"]
        pid, minor = props[p["idProperty"]], props[p["versionProperty"]]
        if not re.fullmatch(r"\d+\.\d+", minor):
            raise SystemExit(f"{p['versionProperty']} must be major.minor (e.g. 0.5), not {minor!r}")
        patches = sorted(int(m.group(1)) for t in tags if (m := re.fullmatch(rf"{re.escape(pid)}-v{re.escape(minor)}\.(\d+)", t)))
        if patches:
            last = f"{minor}.{patches[-1]}"
            changed = changed_since(source_commit(f"{pid}-v{last}"), p["paths"])
            version = f"{minor}.{patches[-1] + 1}" if changed else last
        else:
            changed, version = True, f"{minor}.0"
        product = {"key": p["key"], "id": pid, "name": props[p["nameProperty"]], "version": version,
                   "exe": props["AssemblyName"], "project": p["project"], "summary": p["summary"]}
        products.append(product)
        if want and changed and secrets_ok:
            publish.append(product)
        state = "new version" if changed else "no changes since the last release"
        print(f"{product['name']} {version}: {state}" + (", will be published" if product in publish else ""))
    if want and not secrets_ok and any(True for _ in products):
        print("::warning::Nothing is published: the secrets RELEASES_TOKEN and CATALOG_SIGNING_KEY and the file "
              "build/catalog-signing.pub.pem are all needed (see docs/DEVELOPMENT.md).")
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"products={json.dumps(products)}\n")
        f.write(f"publish={json.dumps(publish)}\n")


if __name__ == "__main__":
    main()
