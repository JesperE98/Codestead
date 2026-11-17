// Port of Commands/Repos/ReposCmd.Aur.cs – AUR (Arch): the package catalogue, PKGBUILDs, git clone and the pacman
// transaction.

import { Js } from "../../Js.js";
import type { PackageDef } from "../../Packages/PackageDef.js";
import { availableVersion, findPackage, formatMiB, installPackage, isForeign, isInstalled, removePackage } from "../../Packages/PackagesLib.js";
import type { Shell } from "../../Shell/Shell.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { askYesNo, dim, kids, pkgById } from "./ReposCmd.js";

export interface AurEntry {
  /** The package's id in Packages/PackagesLib.Catalog.ts. */
  pkgId: string;
  pkgver: string;
  pkgrel: string;
  url: string;
  license: string;
  maintainer: string;
  depends: string[];
  makedepends: string[];
  provides?: string[] | null;
  conflicts?: string[] | null;
  /** Source files makepkg downloads. */
  sources: string[];
  /** Commands in build() – shown when the package is built. Empty for prebuilt -bin packages. */
  build: string[];
  package: string[];
  votes: number;
  popularity: number;
}

export const aur = new Map<string, AurEntry>([
  [
    "moonphase",
    {
      pkgId: "moonphase",
      pkgver: "1.4.2",
      pkgrel: "1",
      url: "https://moonphase.example.org",
      license: "MIT",
      maintainer: "Luna Toolsmith <luna at lunatool dot example dot org>",
      depends: ["glibc"],
      makedepends: [],
      sources: ["$pkgname-$pkgver.tar.gz::https://moonphase.example.org/releases/$pkgname-$pkgver.tar.gz"],
      build: ["cd \"$pkgname-$pkgver\"", "make PREFIX=/usr"],
      package: ["cd \"$pkgname-$pkgver\"", "make PREFIX=/usr DESTDIR=\"$pkgdir\" install", "install -Dm644 LICENSE \"$pkgdir/usr/share/licenses/$pkgname/LICENSE\""],
      votes: 87,
      popularity: 1.42,
    },
  ],
  [
    "snowfall",
    {
      pkgId: "snowfall",
      pkgver: "2.0.1",
      pkgrel: "1",
      url: "https://snowfall.example.org",
      license: "GPL-3.0-or-later",
      maintainer: "Frost Pixel <frost at example dot org>",
      depends: ["ncurses"],
      makedepends: [],
      sources: ["$pkgname-$pkgver.tar.gz::https://snowfall.example.org/$pkgname-$pkgver.tar.gz"],
      build: ["cd \"$pkgname-$pkgver\"", "make"],
      package: ["cd \"$pkgname-$pkgver\"", "install -Dm755 snowfall \"$pkgdir/usr/bin/snowfall\""],
      votes: 42,
      popularity: 0.85,
    },
  ],
  [
    "yay-bin",
    {
      pkgId: "yay-bin",
      pkgver: "12.5.2",
      pkgrel: "1",
      url: "https://github.com/Jguer/yay",
      license: "GPL-3.0-or-later",
      maintainer: "Jguer <pkgbuilds at jguer.space>",
      depends: ["pacman>6.1", "git"],
      makedepends: [],
      provides: ["yay"],
      conflicts: ["yay"],
      sources: ["https://github.com/Jguer/yay/releases/download/v$pkgver/yay_${pkgver}_x86_64.tar.gz"],
      build: [],
      package: ["cd \"yay_${pkgver}_x86_64\"", "install -Dm755 yay \"$pkgdir/usr/bin/yay\"", "install -Dm644 yay.8 \"$pkgdir/usr/share/man/man8/yay.8\""],
      votes: 1350,
      popularity: 28.9,
    },
  ],
  [
    "yay",
    {
      pkgId: "yay",
      pkgver: "12.5.2",
      pkgrel: "1",
      url: "https://github.com/Jguer/yay",
      license: "GPL-3.0-or-later",
      maintainer: "Jguer <pkgbuilds at jguer.space>",
      depends: ["pacman>6.1", "git"],
      makedepends: ["go>=1.24"],
      conflicts: ["yay-bin"],
      sources: ["$pkgname-$pkgver.tar.gz::https://github.com/Jguer/yay/archive/v$pkgver.tar.gz"],
      build: ["export GOFLAGS=\"-buildmode=pie -trimpath -mod=readonly -modcacherw\"", "cd \"$srcdir/$pkgname-$pkgver\"", "make VERSION=$pkgver DESTDIR=\"$pkgdir\" PREFIX=\"/usr\" build"],
      package: ["cd \"$srcdir/$pkgname-$pkgver\"", "make VERSION=$pkgver DESTDIR=\"$pkgdir\" PREFIX=\"/usr\" install"],
      votes: 2480,
      popularity: 18.3,
    },
  ],
  [
    "snapd",
    {
      pkgId: "snapd",
      pkgver: "2.71",
      pkgrel: "1",
      url: "https://github.com/canonical/snapd",
      license: "GPL-3.0-only",
      maintainer: "Maciej Borzecki <maciek.borzecki at gmail dot com>",
      depends: ["squashfs-tools", "libseccomp", "libsystemd", "apparmor"],
      makedepends: ["go"],
      sources: ["$pkgname-$pkgver.tar.xz::https://github.com/canonical/$pkgname/releases/download/$pkgver/${pkgname}_$pkgver.vendor.tar.xz"],
      build: ["cd \"$pkgname-$pkgver\"", "./mkversion.sh $pkgver-$pkgrel", "go build -o \"$srcdir/go/bin/snap\" ./cmd/snap", "go build -o \"$srcdir/go/bin/snapd\" ./cmd/snapd"],
      package: ["cd \"$pkgname-$pkgver\"", "make -C data install DESTDIR=\"$pkgdir\" BINDIR=/usr/bin", "install -Dm755 \"$srcdir/go/bin/snap\" \"$pkgdir/usr/bin/snap\""],
      votes: 410,
      popularity: 2.1,
    },
  ],
]);

export function aurGet(name: string): AurEntry | null {
  return aur.get(name) ?? null;
}

function arr(xs: string[]): string {
  return `(${xs.map((x) => `'${x}'`).join(" ")})`;
}

export function pkgbuild(name: string, e: AurEntry): string {
  const p = pkgById(e.pkgId);
  const lines = [
    `# Maintainer: ${e.maintainer}`,
    "",
    `pkgname=${name}`,
    `pkgver=${e.pkgver}`,
    `pkgrel=${e.pkgrel}`,
    `pkgdesc="${p.description}"`,
    "arch=('x86_64')",
    `url="${e.url}"`,
    `license=('${e.license}')`,
    `depends=${arr(e.depends)}`,
  ];
  if (e.makedepends.length !== 0) lines.push(`makedepends=${arr(e.makedepends)}`);
  if (e.provides) lines.push(`provides=${arr(e.provides)}`);
  if (e.conflicts) lines.push(`conflicts=${arr(e.conflicts)}`);
  lines.push(`source=(${e.sources.map((s) => `"${s}"`).join(" ")})`);
  lines.push(`sha256sums=('${Js.repeat("4f1c2b9e7d", 6)}6a3c')`);
  lines.push("");
  if (e.build.length !== 0) {
    lines.push("build() {");
    lines.push(...e.build.map((l) => `  ${l}`));
    lines.push("}");
    lines.push("");
  }
  lines.push("package() {");
  lines.push(...e.package.map((l) => `  ${l}`));
  lines.push("}");
  return lines.join("\n") + "\n";
}

function srcinfo(name: string, e: AurEntry): string {
  const p = pkgById(e.pkgId);
  return (
    `pkgbase = ${name}\n\tpkgdesc = ${p.description}\n\tpkgver = ${e.pkgver}\n\tpkgrel = ${e.pkgrel}\n\turl = ${e.url}\n\tarch = x86_64\n\tlicense = ${e.license}\n` +
    e.makedepends.map((d) => `\tmakedepends = ${d}\n`).join("") +
    e.depends.map((d) => `\tdepends = ${d}\n`).join("") +
    `\npkgname = ${name}\n`
  );
}

export function pkgFileName(name: string, e: AurEntry): string {
  return `${name}-${e.pkgver}-${e.pkgrel}-x86_64.pkg.tar.zst`;
}

const aurUrl = /^(?:https?:\/\/|ssh:\/\/aur@|aur@)aur\.archlinux\.org[/:]([^/]+?)(?:\.git)?\/?$/;

/**
 * `git clone https://aur.archlinux.org/PACKAGE.git [DIR]` – downloads the build recipe.
 * Returns null if the address does not go to the AUR (then git handles it as usual).
 * A git command that really clones should call this function first.
 */
export function aurClone(ctx: CmdCtx, args: string[]): number | null {
  const sh = ctx.sh;
  const operands = args.filter((a) => !a.startsWith("-"));
  const url = operands.length > 0 ? operands[0]! : null;
  const m = url ? aurUrl.exec(url) : null;
  if (m === null || url === null) return null;
  const name = m[1]!;
  const dest = operands.length > 1 ? operands[1]! : name;
  const path = sh.resolve(dest);
  const user = sh.currentUser();
  const existing = sh.vfs.tryLookup(path, user);
  if (existing !== null && (existing.type !== "dir" || (existing.children?.size ?? 0) !== 0)) {
    ctx.err(`fatal: destination path '${dest}' already exists and is not an empty directory.\n`);
    return 128;
  }
  try {
    if (existing === null) sh.vfs.mkdir(path, user);
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err(`fatal: could not create work tree dir '${dest}': ${e.message}\n`);
    return 128;
  }
  ctx.err(`Cloning into '${dest}'...\n`);
  const g = user.groups[0] ?? null;
  const dir = sh.vfs.lookup(path, user);
  dir.children!.set(
    ".git",
    VfsLib.makeDir(
      user.name,
      Js.oct(755),
      kids(
        ["HEAD", VfsLib.makeFile("ref: refs/heads/master\n", user.name, Js.oct(644), g)],
        [
          "config",
          VfsLib.makeFile(
            `[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "master"]\n\tremote = origin\n\tmerge = refs/heads/master\n`,
            user.name,
            Js.oct(644),
            g,
          ),
        ],
        ["objects", VfsLib.makeDir(user.name, Js.oct(755), Js.obj<FsNode>(), g)],
        ["refs", VfsLib.makeDir(user.name, Js.oct(755), kids(["heads", VfsLib.makeDir(user.name, Js.oct(755), Js.obj<FsNode>(), g)]), g)],
      ),
      g,
    ),
  );
  const entry = aurGet(name);
  if (entry === null) {
    // Just like for real: the AUR lets you clone anything – if the package doesn't exist the directory is empty.
    ctx.err("warning: You appear to have cloned an empty repository.\n");
    ctx.err(dim(sh, "repos.noSuchAurPackage", { name }));
    return 0;
  }
  dir.children!.set("PKGBUILD", VfsLib.makeFile(pkgbuild(name, entry), user.name, Js.oct(644), g));
  dir.children!.set(".SRCINFO", VfsLib.makeFile(srcinfo(name, entry), user.name, Js.oct(644), g));
  ctx.err(
    "remote: Enumerating objects: 24, done.\nremote: Counting objects: 100% (24/24), done.\nremote: Compressing objects: 100% (20/20), done.\n" +
      "remote: Total 24 (delta 4), reused 24 (delta 4), pack-reused 0 (from 0)\nReceiving objects: 100% (24/24), 6.12 KiB | 6.12 MiB/s, done.\nResolving deltas: 100% (4/4), done.\n",
  );
  return 0;
}

function bar(label: string): string {
  return `${label.padEnd(48)} [${Js.repeat("#", 22)}] 100%\n`;
}

/** Shows the package list and asks like `pacman -U`/`pacman -S`, then installs. */
export function pacmanTransaction(ctx: CmdCtx, pkgs: PackageDef[], noconfirm: boolean, done: (io: Sink) => number, onNo: (io: Sink) => number): number {
  const sh = ctx.sh;
  const full = (p: PackageDef): string => `${p.names.get("arch")}-${availableVersion(sh, p)}`;
  const size = pkgs.reduce((s, p) => s + p.sizeKb, 0);
  ctx.out(`loading packages...\nresolving dependencies...\nlooking for conflicting packages...\n\nPackages (${pkgs.length}) ${pkgs.map(full).join("  ")}\n\nTotal Installed Size:  ${formatMiB(size)}\n\n`);
  return askYesNo(
    ctx,
    ":: Proceed with installation? [Y/n] ",
    true,
    noconfirm,
    (io) => {
      const n = pkgs.length;
      for (const step of ["checking keys in keyring", "checking package integrity", "loading package files", "checking for file conflicts"]) io.out(bar(`(${n}/${n}) ${step}`));
      io.out(":: Processing package changes...\n");
      for (let i = 0; i < pkgs.length; i++) {
        const p = pkgs[i]!;
        // Packages that conflict (e.g. yay and yay-bin) are replaced.
        for (const c of aurGet(p.names.get("arch")!)?.conflicts ?? []) {
          const other = findPackage("arch", c, sh);
          if (other !== null && isInstalled(sh, other)) {
            io.out(`:: ${p.names.get("arch")} and ${c} are in conflict. Removing ${c}.\n`);
            removePackage(sh, other);
          }
        }
        io.out(bar(`(${i + 1}/${n}) ${isInstalled(sh, p) ? "reinstalling" : "installing"} ${p.names.get("arch")}`));
        installPackage(sh, p);
      }
      io.out(":: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n");
      return done(io);
    },
    onNo,
  );
}

/** Dependencies (from Arch's normal repositories) that are missing. Unknown names such as glibc count as installed. */
export function missingDeps(sh: Shell, deps: Iterable<string>): { spec: string; pkg: PackageDef }[] {
  const result: { spec: string; pkg: PackageDef }[] = [];
  for (const spec of deps) {
    const pkg = findPackage("arch", spec.replace(/[<>=].*$/, ""), sh);
    if (pkg !== null && !isInstalled(sh, pkg) && !isForeign("arch", pkg)) result.push({ spec, pkg });
  }
  return result;
}
