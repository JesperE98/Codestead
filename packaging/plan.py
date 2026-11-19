#!/usr/bin/env python3
"""Decides the version of every product and which ones to publish (the "plan" job of release.yml).

For each product in packaging/products.json (its id, name, executable, TypeScript app and folder are there too):
  - major.minor is its "majorMinor" (e.g. 0.6);
  - the patch number is one more than the newest release <id>-v<major.minor>.<patch> in the releases
    repository, or 0 if there is none;
  - a new version is made if the product's own files ("own": its folder, its app and packages in ts/, its icon)
    changed since the commit the newest release was built from (recorded as <!-- codestead-source: SHA --> in its
    release notes);
  - if only shared files changed ("paths" minus "own", minus "exclude": the shared packages ts/packages/common,
    learning and ui, the workspace's package files, the build and packaging files), a new version is made only
    when the product's changelog already has an entry for it – a change in shared code that does not change the
    product (say, a hook only Codestead GP uses) then waits for the product's next release instead of releasing it
    with nothing to tell;
    "exclude" lists what does not go into the product: tests, and files in a shared folder that the product does
    not use, e.g. the learning window in ts/packages/ui for the hub (ts/apps/hub/test/ProductFilesTests.test.ts
    checks that the hub really does not use them).
  - every product has its own folder ("dir", e.g. src/Linux) with changelog.json (What's new, must have an entry
    for the next version), description.json (shown by the hub) and release-notes.md (the release page).
Publishing also needs WANT_PUBLISH=true (a run by hand on main with "publish" ticked) and both secrets.
Merges to main do not publish: several pull requests are collected, and they all add their lines to the one
changelog entry for the next version (which stays the same until it is published).

The upgrade gate (release.yml's upgrade-linux and upgrade-windows jobs): every product that gets a new version is
updated to the new build from a user's installation of
  - its last C# release ("lastCSharpRelease" in products.json: the releases before the switch to TypeScript), so that an
    old installation can always update straight to the newest version, and
  - its previous release, when that is not the same one (a TypeScript release).
Writes products=[...], publish=[...], upgrade_linux=[...] and upgrade_windows=[...] to $GITHUB_OUTPUT.
"""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, "packaging", "products.json"), encoding="utf-8") as _f:
    PRODUCTS = json.load(_f)
REPO = os.environ.get("RELEASES_REPO", PRODUCTS["releasesRepo"])

# Where the upgrade tests run: (name, docker image) on Linux (AppImage), runner images on Windows (Setup.exe). The update
# from the last C# release runs on all of them; the cheaper one from a TypeScript release on the first only.
UPGRADE_LINUX = [("Ubuntu 24.04 LTS (AppImage)", "ubuntu:24.04"), ("Fedora (AppImage)", "fedora:latest")]
UPGRADE_WINDOWS = ["windows-2025", "windows-2022"]


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
with open(os.path.join(ROOT, "build", "languages.json"), encoding="utf-8") as _f:
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


def parse_version(v):
    return tuple(int(x) for x in v.split("."))


def upgrade_cases(product, previous):
    """The upgrade tests of a product that gets a new version: from its last C# release (with the new build then
    updating itself once more, TS -> TS), and from its previous release when that is a TypeScript one. A product
    that never was C# (no lastCSharpRelease) has only the second, once it has a release; its first has none."""
    cs = product["lastCSharpRelease"]
    cases = []
    if cs is not None:
        cases.append(dict(product, upgradeFrom=cs, upgradeKind="csharp", upgradeChain=True))
    if previous is not None and previous != cs:
        # The TS -> TS step of the C# case is the cheap stand-in for this one when there is no C# case.
        cases.append(dict(product, upgradeFrom=previous, upgradeKind="typescript", upgradeChain=cs is None))
    notes = ([f"the last C# release {cs}"] if cs is not None else []) + \
            ([f"the previous release {previous}"] if previous is not None and previous != cs else [])
    note = ("upgrade tests from " + " and from ".join(notes)) if notes else "no release to upgrade from yet"
    if cs is not None and previous == cs:
        note += " (the previous release; no TypeScript release yet)"
    full = lambda c: c["upgradeKind"] == "csharp" or cs is None  # the main case of the product: every target
    linux = [dict(c, targetName=name, image=image) for c in cases for (name, image) in (UPGRADE_LINUX if full(c) else UPGRADE_LINUX[:1])]
    windows = [dict(c, os=os_) for c in cases for os_ in (UPGRADE_WINDOWS if full(c) else UPGRADE_WINDOWS[:1])]
    return linux, windows, note


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
    upgrade_linux, upgrade_windows = [], []
    for p in PRODUCTS["products"]:
        pid, minor, name = p["id"], p["majorMinor"], p["name"]
        if not re.fullmatch(r"\d+\.\d+", minor):
            raise SystemExit(f"{p['key']}: majorMinor in packaging/products.json must be major.minor (e.g. 0.5), not {minor!r}")
        patches = sorted(int(m.group(1)) for t in tags if (m := re.fullmatch(rf"{re.escape(pid)}-v{re.escape(minor)}\.(\d+)", t)))
        why = ""
        # The newest release of the product (of any major.minor): what an up-to-date user has.
        released = [parse_version(m.group(1)) for t in tags if (m := re.fullmatch(rf"{re.escape(pid)}-v(\d+\.\d+\.\d+)", t))]
        previous = ".".join(map(str, max(released))) if released else None
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
        cs = p.get("lastCSharpRelease")
        if cs is not None and parse_version(version) < parse_version(cs):
            # Below what users already have: the releases could not be listed (or majorMinor went down).
            problems.append(f"{name} would be {version}, older than its last C# release {cs}: are the releases of "
                            f"{REPO} readable (GH_TOKEN)?")
        if changed:
            missing_note = changelog_problem(f"{p['dir']}/changelog.json", version)
            if missing_note:
                problems.append(missing_note)
        product = {"key": p["key"], "id": pid, "name": name, "version": version,
                   # The title of its releases in codestead-releases (several products share that repository).
                   "title": p.get("title", name),
                   "exe": p["exe"], "app": p["app"], "summary": p["summary"], "dir": p["dir"],
                   "changed": changed, "lastCSharpRelease": cs}
        products.append(product)
        if want and changed and secrets_ok:
            publish.append(product)
        state = ("new version" + why) if changed else (why or "no changes since the last release")
        if changed:
            linux, windows, note = upgrade_cases(product, previous)
            upgrade_linux += linux
            upgrade_windows += windows
            state += f"; {note}"
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
        f.write(f"upgrade_linux={json.dumps(upgrade_linux)}\n")
        f.write(f"upgrade_windows={json.dumps(upgrade_windows)}\n")


if __name__ == "__main__":
    main()
