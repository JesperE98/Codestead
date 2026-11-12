#!/usr/bin/env python3
"""Decides the version of every product and which ones to publish (the "plan" job of release.yml).

For each product in packaging/products.json:
  - major.minor comes from build/Codestead.props (e.g. CodesteadLinuxVersion = 0.5);
  - the patch number is one more than the newest release <id>-v<major.minor>.<patch> in the releases
    repository, or 0 if there is none;
  - a new version is made if the product's own files ("own": its folder and icon) changed since the commit
    the newest release was built from (recorded as <!-- codestead-source: SHA --> in its release notes);
  - if only shared files changed ("paths" minus "own", minus "exclude": src/Shared, the build and packaging
    files), a new version is made only when the product's changelog already has an entry for it – a change in
    shared code that does not change the product (say, a hook only Codestead GP uses) then waits for the
    product's next release instead of releasing it with nothing to tell;
    "exclude" lists files in a shared folder that the product does not use, e.g. the lesson controls in
    src/Shared/Codestead.UI for the hub (tests/Hub/Codestead.Hub.Tests checks that the hub really does not use them).
  - every product has its own folder ("dir", e.g. src/Linux) with changelog.json (What's new, must have an entry
    for the next version), description.json (shown by the hub) and release-notes.md (the release page).
Publishing also needs WANT_PUBLISH=true (a run by hand on main with "publish" ticked) and both secrets.
Merges to main do not publish: several pull requests are collected, and they all add their lines to the one
changelog entry for the next version (which stays the same until it is published).
Writes products=[...] and publish=[...] to $GITHUB_OUTPUT.
"""
import json
import os
import re
import subprocess

REPO = os.environ.get("RELEASES_REPO", "JesperE98/codestead-releases")


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def releases():
    r = run("gh", "release", "list", "--repo", REPO, "--limit", "1000", "--json", "tagName", "--jq", ".[].tagName")
    return r.stdout.split() if r.returncode == 0 else []


def source_commit(tag):
    r = run("gh", "release", "view", tag, "--repo", REPO, "--json", "body", "--jq", ".body")
    m = re.search(r"codestead-source: ([0-9a-f]{40})", r.stdout) if r.returncode == 0 else None
    return m.group(1) if m else None


def pathspecs(product):
    """The product's files as git pathspecs: its paths (globs allowed) without its excludes."""
    return list(product["paths"]) + [f":(exclude){e}" for e in product.get("exclude", [])]


def own_pathspecs(product):
    """The product's own files (its folder and icon); without "own", all of its paths count as its own."""
    return list(product.get("own", product["paths"])) + [f":(exclude){e}" for e in product.get("exclude", [])]


def has_entry(path, version):
    """Does the changelog have an entry for `version`?"""
    with open(path, encoding="utf-8") as f:
        return any(e.get("version") == version for e in json.load(f))


def changed_since(sha, specs):
    if sha is None:
        return True
    if run("git", "cat-file", "-e", f"{sha}^{{commit}}").returncode != 0:
        return True  # unknown commit (e.g. history rewritten): treat as changed
    return run("git", "diff", "--quiet", sha, "HEAD", "--", *specs).returncode != 0


# The languages the apps offer (build/languages.json); parked languages need no changelog lines.
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build", "languages.json"), encoding="utf-8") as _f:
    LANGUAGES = [l["code"] for l in json.load(_f)["languages"] if l["offered"]]


def changelog_problem(path, version):
    """Why the changelog is not ready for a release of `version`, or None.

    Every new version must say what changed – the apps show it after an update ("What's new") – in all
    languages, with as many lines in each language as in English."""
    with open(path, encoding="utf-8") as f:
        entries = json.load(f)
    entry = next((e for e in entries if e.get("version") == version), None)
    if entry is None:
        return (f"{path} has no entry for version {version}, which this change will release. Add what changed "
                f"(in all languages) – see \"Ändringslogg\" in docs/DEVELOPMENT.md.")
    changes = entry.get("changes", {})
    en = changes.get("en") or []
    if not en:
        return f"{path}: version {version} has no English changes."
    missing = [lang for lang in LANGUAGES if len(changes.get(lang) or []) != len(en)]
    if missing:
        return f"{path}: version {version} needs {len(en)} lines in every language; check {', '.join(missing)}."
    return None


def main():
    want = os.environ.get("WANT_PUBLISH") == "true"
    # Everything publishing needs, with what is missing named one by one.
    needed = {
        "the secret RELEASES_TOKEN": os.environ.get("HAS_RELEASES_TOKEN") == "true",
        "the secret CATALOG_SIGNING_KEY": os.environ.get("HAS_CATALOG_SIGNING_KEY") == "true",
        "the file build/catalog-signing.pub.pem": os.path.exists("build/catalog-signing.pub.pem"),
    }
    for what, ok in needed.items():
        print(f"{what}: {'found' if ok else 'MISSING'}")
    missing = [what for what, ok in needed.items() if not ok]
    secrets_ok = not missing
    tags = releases()
    products, publish = [], []
    problems = []
    for p in json.load(open("packaging/products.json")):
        out = subprocess.check_output(["dotnet", "msbuild", p["project"], "-getProperty:AssemblyName",
                                       f"-getProperty:{p['idProperty']}", f"-getProperty:{p['nameProperty']}",
                                       f"-getProperty:{p['versionProperty']}"], text=True)
        props = json.loads(out)["Properties"]
        pid, minor = props[p["idProperty"]], props[p["versionProperty"]]
        if not re.fullmatch(r"\d+\.\d+", minor):
            raise SystemExit(f"{p['versionProperty']} must be major.minor (e.g. 0.5), not {minor!r}")
        patches = sorted(int(m.group(1)) for t in tags if (m := re.fullmatch(rf"{re.escape(pid)}-v{re.escape(minor)}\.(\d+)", t)))
        why = ""
        if patches:
            last, nxt = f"{minor}.{patches[-1]}", f"{minor}.{patches[-1] + 1}"
            source = source_commit(f"{pid}-v{last}")
            changed = changed_since(source, own_pathspecs(p))
            if not changed and changed_since(source, pathspecs(p)):
                # Only shared files changed: a release only if the product's changelog says what it brings.
                changed = has_entry(f"{p['dir']}/changelog.json", nxt)
                why = (" (only shared files changed, and the changelog has an entry for it)" if changed else
                       f"no release: only shared files changed, and {p['dir']}/changelog.json has no entry for {nxt} "
                       "(they come with its next release)")
            version = nxt if changed else last
        else:
            changed, version = True, f"{minor}.0"
        if changed:
            missing_note = changelog_problem(f"{p['dir']}/changelog.json", version)
            if missing_note:
                problems.append(missing_note)
        name = props[p["nameProperty"]]
        product = {"key": p["key"], "id": pid, "name": name, "version": version,
                   # The title of its releases in codestead-releases (several products share that repository).
                   "title": p.get("title", name),
                   "exe": props["AssemblyName"], "project": p["project"], "summary": p["summary"], "dir": p["dir"]}
        products.append(product)
        if want and changed and secrets_ok:
            publish.append(product)
        state = ("new version" + why) if changed else (why or "no changes since the last release")
        print(f"{product['name']} {version}: {state}" + (", will be published" if product in publish else ""))
    if want and not secrets_ok and any(True for _ in products):
        print(f"::warning::Nothing is published. Missing: {', '.join(missing)}. Secrets must be repository "
              "secrets under Settings -> Secrets and variables -> Actions (see docs/DEVELOPMENT.md).")
    if problems:
        for problem in problems:
            print(f"::error::{problem}")
        raise SystemExit(1)
    with open(os.environ.get("GITHUB_OUTPUT", os.devnull), "a") as f:
        f.write(f"products={json.dumps(products)}\n")
        f.write(f"publish={json.dumps(publish)}\n")


if __name__ == "__main__":
    main()
