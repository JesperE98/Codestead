// Port of Commands/Repos/ReposCmd.Makepkg.cs – the makepkg command: builds an Arch package from a PKGBUILD (e.g.
// from the AUR).

import { Js } from "../../Js.js";
import { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { dim, has, isRoot, kids, pkgById, round } from "./ReposCmd.js";
import { type AurEntry, aurGet, missingDeps, pacmanTransaction, pkgFileName } from "./ReposCmd.Aur.js";

/** { ...ctx, ...asIO(io) } */
export function withIO(ctx: CmdCtx, io: Sink): CmdCtx {
  return new CmdCtx(new IO(io.outFn, io.errFn, null, true, ctx.reader), ctx.sh, ctx.name, ctx.args);
}

/** The file names of the source files with $pkgname and $pkgver filled in. */
function sourceFiles(name: string, e: AurEntry): string[] {
  return e.sources.map((s) => {
    const filled = s.replace(/\$\{?pkgname\}?/g, () => name).replace(/\$\{?pkgver\}?/g, () => e.pkgver);
    return filled.includes("::") ? filled.split("::")[0]! : filled.slice(filled.lastIndexOf("/") + 1);
  });
}

const makepkgTidy =
  "==> Tidying install...\n  -> Removing libtool files...\n  -> Purging unwanted files...\n  -> Removing static library files...\n  -> Stripping unneeded symbols from binaries and libraries...\n  -> Compressing man and info pages...\n==> Checking for packaging issues...\n";

export const makepkg: CommandDef = {
  name: "makepkg",
  summary: "Bygger ett Arch-paket från en PKGBUILD (t.ex. från AUR)",
  summaryEn: "Builds an Arch package from a PKGBUILD (e.g. from the AUR)",
  man: `NAMN
       makepkg - bygg paket från en PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

BESKRIVNING
       Läser filen PKGBUILD i den aktuella katalogen, hämtar källkoden,
       bygger programmet och packar det som en .pkg.tar.zst-fil som
       pacman kan installera. Så installerar man paket från AUR:

           git clone https://aur.archlinux.org/PAKET.git
           cd PAKET
           less PKGBUILD        (läs alltid receptet först!)
           makepkg -si

       makepkg vägrar köras som root – bygg som vanlig användare.
       Installationssteget (-i) använder sudo pacman själv. Paketgruppen
       base-devel (med bl.a. gcc, make och fakeroot) behövs för att bygga.

FLAGGOR
       -s, --syncdeps    installera beroenden som saknas med pacman
       -i, --install     installera paketet efter bygget
       -c, --clean       städa bort byggfilerna efteråt
       -f, --force       bygg om även om paketet redan är byggt
       --noconfirm       fråga inte om bekräftelse

EXEMPEL
       makepkg -si`,
  manEn: `NAME
       makepkg - build packages from a PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

DESCRIPTION
       Reads the file PKGBUILD in the current directory, downloads the
       source code, builds the program and packs it as a .pkg.tar.zst
       file that pacman can install. This is how packages from the AUR
       are installed:

           git clone https://aur.archlinux.org/PACKAGE.git
           cd PACKAGE
           less PKGBUILD        (always read the recipe first!)
           makepkg -si

       makepkg refuses to run as root - build as a normal user. The
       install step (-i) uses sudo pacman itself. The base-devel package
       group (gcc, make, fakeroot ...) is needed to build.

OPTIONS
       -s, --syncdeps    install missing dependencies with pacman
       -i, --install     install the package after building it
       -c, --clean       clean up the build files afterwards
       -f, --force       rebuild even if the package is already built
       --noconfirm       don't ask for confirmation

EXAMPLES
       makepkg -si`,
  run: runMakepkg,
};

const pkgnameLine = /^pkgname=['"]?([^'"\s]+)/m;
const sourceLine = /^source=\(["']?([^"'\s)]+)/m;

function runMakepkg(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const o = UtilCmd.parseOpts(ctx.args, {
    flags: "sicfrCLhV",
    long: {
      syncdeps: "s", install: "i", clean: "c", force: "f", rmdeps: "r", cleanbuild: "C",
      log: "L", help: "h", version: "V", noconfirm: "N", needed: "n",
    },
  });
  if (o.error !== null) {
    ctx.err(`==> ERROR: ${o.error}\n`);
    return 1;
  }
  if (o.flags.has("V")) {
    ctx.out("makepkg (pacman) 7.0.0\n");
    return 0;
  }
  if (o.flags.has("h")) {
    ctx.out(
      "makepkg (pacman) 7.0.0\nMake packages compatible for use with pacman\n\nUsage: makepkg [options]\n\nOptions:\n  -c, --clean      Clean up work files after build\n  -f, --force      Overwrite existing package\n  -i, --install    Install package after successful build\n  -s, --syncdeps   Install missing dependencies with pacman\n  --noconfirm      Do not ask for confirmation when resolving dependencies\n",
    );
    return 0;
  }
  if (isRoot(sh)) {
    ctx.err("==> ERROR: Running makepkg as root is not allowed as it can cause permanent,\ncatastrophic damage to your system.\n");
    ctx.err(dim(sh, "repos.makepkgNoSudo"));
    return 10;
  }
  const dir = sh.cwd;
  const user = sh.currentUser();
  let recipe: string;
  try {
    recipe = sh.vfs.readFile(`${dir}/PKGBUILD`, user);
  } catch (e) {
    if (!(e instanceof FsError)) throw e;
    ctx.err("==> ERROR: PKGBUILD does not exist.\n");
    if (sh.vfs.tryLookup(`${dir}/.git`, user) !== null) {
      ctx.err(dim(sh, "repos.emptyDirectory"));
    }
    return 1;
  }
  const nm = pkgnameLine.exec(recipe);
  const name = nm ? nm[1]! : VfsLib.basename(dir);
  const entry = aurGet(name);
  if (!has(sh, "base-devel")) {
    ctx.err("==> ERROR: Cannot find the fakeroot binary.\n");
    ctx.err(dim(sh, "repos.installBaseDevel"));
    return 1;
  }
  if (entry === null) {
    const sm = sourceLine.exec(recipe);
    const src = sm ? sm[1]! : name;
    ctx.out(`==> Making package: ${name} (${UtilCmd.longDate()})\n==> Retrieving sources...\n`);
    ctx.err(`==> ERROR: Failure while downloading ${src}\n    Aborting...\n`);
    ctx.err(dim(sh, "repos.onlyPretendAur"));
    return 1;
  }
  const pkg = pkgById(entry.pkgId);
  const full = `${name} ${entry.pkgver}-${entry.pkgrel}`;
  const pkgFile = `${dir}/${pkgFileName(name, entry)}`;
  const noconfirm = o.flags.has("N");

  const install = (io: Sink): number => {
    io.out(`==> Installing package ${name} with pacman -U...\n`);
    return sh.runAs("root", () =>
      pacmanTransaction(
        withIO(ctx, io),
        [pkg],
        noconfirm,
        () => 0,
        (io2) => {
          io2.out("==> WARNING: Failed to install built package(s).\n");
          return 0;
        },
      ),
    );
  };

  if (sh.vfs.tryLookup(pkgFile, user) !== null && !o.flags.has("f")) {
    if (o.flags.has("i")) {
      ctx.err("==> WARNING: A package has already been built, installing existing package...\n");
      return install(ctx);
    }
    ctx.err("==> ERROR: A package has already been built. (use -f to overwrite)\n");
    return 13;
  }

  const build = (io: Sink): number => {
    const g = user.groups[0] ?? null;
    const write = (path: string, node: FsNode): void => sh.vfs.insert(path, node, user);
    try {
      io.out("==> Retrieving sources...\n");
      for (const f of sourceFiles(name, entry)) {
        io.out(`  -> Downloading ${f}...\n`);
        const node = VfsLib.makeFile(`(source code of ${name} - simulated)\n`, user.name, Js.oct(644), g);
        node.size = round(pkg.sizeKb * 300);
        write(`${dir}/${f}`, node);
      }
      io.out("==> Validating source files with sha256sums...\n");
      for (const f of sourceFiles(name, entry)) io.out(`    ${f} ... Passed\n`);
      io.out("==> Removing existing $srcdir/ directory...\n==> Extracting sources...\n");
      for (const f of sourceFiles(name, entry)) io.out(`  -> Extracting ${f} with bsdtar\n`);
      write(`${dir}/src`, VfsLib.makeDir(user.name, Js.oct(755), kids([`${name}-${entry.pkgver}`, VfsLib.makeDir(user.name, Js.oct(755), Js.obj<FsNode>(), g)]), g));
      if (entry.build.length !== 0) {
        io.out("==> Starting build()...\n");
        if (name === "yay" || name === "snapd") io.out(`go: downloading modules for ${name}...\ngo build -trimpath -buildmode=pie -o ${name === "yay" ? "yay" : "snap"} .\n`);
        else io.out(`cc -O2 -pipe -fno-plt -fexceptions -Wall -o ${name} src/main.c src/${name === "moonphase" ? "phase" : "flakes"}.c ${name === "moonphase" ? "-lm" : "-lncursesw"}\n`);
      }
      io.out("==> Entering fakeroot environment...\n==> Starting package()...\n");
      io.out(`install -Dm755 ${name.replace(/-bin$/, "")} "${dir}/pkg/${name}/usr/bin/${pkg.provides.length > 0 ? pkg.provides[0] : name}"\n`);
      write(`${dir}/pkg`, VfsLib.makeDir(user.name, Js.oct(755), kids([name, VfsLib.makeDir(user.name, Js.oct(755), Js.obj<FsNode>(), g)]), g));
      io.out(makepkgTidy);
      io.out(`==> Creating package "${name}"...\n  -> Generating .PKGINFO file...\n  -> Generating .BUILDINFO file...\n  -> Generating .MTREE file...\n  -> Compressing package...\n`);
      const outFile = VfsLib.makeFile(`(built package ${name}-${entry.pkgver}-${entry.pkgrel} - simulated)\n`, user.name, Js.oct(644), g);
      outFile.size = round(pkg.sizeKb * 400);
      write(pkgFile, outFile);
      io.out(`==> Leaving fakeroot environment.\n==> Finished making: ${full} (${UtilCmd.longDate()})\n`);
      if (o.flags.has("c")) {
        io.out("==> Cleaning up...\n");
        sh.vfs.remove(`${dir}/src`, user);
        sh.vfs.remove(`${dir}/pkg`, user);
      }
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      io.err(`==> ERROR: Cannot write to the build directory: ${e.message}\n`);
      return 1;
    }
    return o.flags.has("i") ? install(io) : 0;
  };

  ctx.out(`==> Making package: ${full} (${UtilCmd.longDate()})\n==> Checking runtime dependencies...\n==> Checking buildtime dependencies...\n`);
  const missing = missingDeps(sh, [...entry.depends, ...entry.makedepends]);
  if (missing.length === 0) return build(ctx);
  const missingList = missing.map((m) => `  -> ${m.spec}\n`).join("");
  if (!o.flags.has("s")) {
    ctx.err(`==> Missing dependencies:\n${missingList}==> ERROR: Could not resolve all dependencies.\n`);
    ctx.err(dim(sh, "repos.makepkgSyncDeps"));
    return 8;
  }
  ctx.out("==> Installing missing dependencies...\n");
  return sh.runAs("root", () =>
    pacmanTransaction(
      ctx,
      missing.map((m) => m.pkg),
      noconfirm,
      (io) => sh.runAs(user.name, () => build(io)),
      (io) => {
        io.err(`==> ERROR: 'pacman' failed to install missing dependencies.\n==> Missing dependencies:\n${missingList}==> ERROR: Could not resolve all dependencies.\n`);
        return 8;
      },
    ),
  );
}
