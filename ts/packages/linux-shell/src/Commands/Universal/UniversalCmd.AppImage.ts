// Port of Commands/Universal/UniversalCmd.AppImage.cs – the appimage-runtime command: the launcher inside an
// AppImage.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { dim, kids, simBinary, windowNote } from "./UniversalCmd.js";

const fuseError =
  "dlopen(): error loading libfuse.so.2\n\nAppImages require FUSE to run. \nYou might still be able to extract the contents of this AppImage \n" +
  "if you run it with the --appimage-extract option. \nSee https://github.com/AppImage/AppImageKit/wiki/FUSE \nfor more information\n";

const fusePkg = new Map<string, string>([
  ["debian", "libfuse2t64"],
  ["arch", "fuse2"],
  ["redhat", "fuse-libs"],
]);

const appImageHeader = /^AppImage: (.+?)(?: [0-9][0-9.]*)?$/m;
const desktopHeader = /^Desktop: (\S+)\.desktop$/m;
const appImageExt = /\.AppImage$/i;

/** Runs when an AppImage (or its extracted AppRun) is started. */
export const appImageRuntime: CommandDef = {
  name: "appimage-runtime",
  summary: "Startprogrammet inuti en AppImage",
  summaryEn: "The launcher inside an AppImage",
  man: `NAMN
       AppImage - ett helt program i en enda körbar fil

BESKRIVNING
       En AppImage startas som vilket program som helst: gör filen körbar
       med chmod +x och kör den med ./Fil.AppImage. Den monterar sig själv
       med FUSE (biblioteket libfuse.so.2).

FLAGGOR
       --appimage-extract           packa upp innehållet till squashfs-root/
       --appimage-extract-and-run   packa upp tillfälligt och kör (utan FUSE)`,
  manEn: `NAME
       AppImage - a whole program in a single executable file

DESCRIPTION
       An AppImage is started like any program: make the file executable
       with chmod +x and run it with ./File.AppImage. It mounts itself
       with FUSE (the library libfuse.so.2).

OPTIONS
       --appimage-extract           unpack the contents to squashfs-root/
       --appimage-extract-and-run   unpack temporarily and run (no FUSE)`,
  run: runAppImage,
};

function runAppImage(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const path = sh.resolve(ctx.name);
  const self = sh.vfs.tryLookup(path, sh.currentUser())?.content ?? "";
  const hm = appImageHeader.exec(self);
  const appName = hm ? hm[1]! : VfsLib.basename(path).replace(appImageExt, "").split("-")[0]!;
  const extracted = VfsLib.basename(path) === "AppRun" || path.includes("/squashfs-root/");
  const arg = ctx.args.length > 0 ? ctx.args[0]! : null;
  if (arg === "--appimage-version") {
    ctx.out("AppImage runtime version: continuous build\n");
    return 0;
  }
  if (arg === "--appimage-help") {
    ctx.out(
      "AppImage options:\n\n  --appimage-extract [<pattern>]  Extract content from embedded filesystem image\n  --appimage-extract-and-run      Temporarily extract and run without FUSE\n  --appimage-help                 Print this help\n  --appimage-version              Print version of AppImage runtime\n",
    );
    return 0;
  }
  if (arg === "--appimage-extract" && !extracted) {
    const user = sh.currentUser();
    const g = user.groups[0] ?? null;
    // File names come from the desktop id (ASCII), not from the app's name in the student's language.
    const dm = desktopHeader.exec(self);
    const lower = dm ? dm[1]! : appName.toLowerCase();
    const files: [string, FsNode][] = [
      ["AppRun", simBinary("appimage-runtime", user.name, Js.oct(755), g, `AppImage: ${appName}\nDesktop: ${lower}.desktop\n`)],
      [`${lower}.desktop`, VfsLib.makeFile(`[Desktop Entry]\nType=Application\nName=${appName}\nExec=${lower}\nIcon=${lower}\nCategories=Utility;Calculator;\n`, user.name, Js.oct(644), g)],
      [`${lower}.png`, VfsLib.makeFile("\u0089PNG (simulated icon)\n", user.name, Js.oct(644), g)],
      [".DirIcon", VfsLib.makeFile("\u0089PNG (simulated icon)\n", user.name, Js.oct(644), g)],
    ];
    const tree = VfsLib.makeDir(user.name, Js.oct(755), kids(...files), g);
    tree.children!.set(
      "usr",
      VfsLib.makeDir(
        user.name,
        Js.oct(755),
        kids(
          ["bin", VfsLib.makeDir(user.name, Js.oct(755), kids([lower, simBinary("appimage-runtime", user.name, Js.oct(755), g, `AppImage: ${appName}\nDesktop: ${lower}.desktop\n`)]), g)],
          ["lib", VfsLib.makeDir(user.name, Js.oct(755), kids(["libQt6Core.so.6", VfsLib.makeFile("(simulated library)\n", user.name, Js.oct(644), g)]), g)],
        ),
        g,
      ),
    );
    try {
      sh.vfs.insert(sh.resolve("squashfs-root"), tree, user);
    } catch (e) {
      if (!(e instanceof FsError)) throw e;
      ctx.err(`Failed to create squashfs-root: ${e.message}\n`);
      return 1;
    }
    for (const [n] of files) ctx.out(`squashfs-root/${n}\n`);
    ctx.out(`squashfs-root/usr\nsquashfs-root/usr/bin\nsquashfs-root/usr/bin/${lower}\nsquashfs-root/usr/lib\nsquashfs-root/usr/lib/libQt6Core.so.6\n`);
    return 0;
  }
  if (!extracted && arg !== "--appimage-extract-and-run" && !sh.installed.get("fuse2")) {
    ctx.err(fuseError);
    const pkg = fusePkg.get(sh.distro.family) ?? null;
    ctx.err(dim(sh, "universal.appImageFuse", { distro: sh.distro.name, pkg }));
    return 127;
  }
  ctx.out(windowNote(sh, appName));
  return 0;
}
