// Port of ChapterDefinitions.cs – the chapter definitions from src/content/chapters.ts (CHAPTERS), in the same order
// as the TypeScript. Texts, hints and solutions are kept byte for byte. Each chapter is defined in
// Chapters/<part>/<id>.ts; this list sets the course order.

import { anvandare } from "./Chapters/admin/anvandare.js";
import { diskar } from "./Chapters/admin/diskar.js";
import { systemd } from "./Chapters/admin/systemd.js";
import { distributioner } from "./Chapters/distro/distributioner.js";
import { familjArch } from "./Chapters/distro/familj-arch.js";
import { familjDebian } from "./Chapters/distro/familj-debian.js";
import { familjRedhat } from "./Chapters/distro/familj-redhat.js";
import { universellaPaket } from "./Chapters/distro/universella-paket.js";
import { filer } from "./Chapters/grunder/filer.js";
import { lasaText } from "./Chapters/grunder/lasa-text.js";
import { navigera } from "./Chapters/grunder/navigera.js";
import { pipes } from "./Chapters/grunder/pipes.js";
import { filoverforing } from "./Chapters/natverk/filoverforing.js";
import { natverk } from "./Chapters/natverk/natverk.js";
import { schemalaggning } from "./Chapters/skript/schemalaggning.js";
import { skript } from "./Chapters/skript/skript.js";
import { textbearbetning } from "./Chapters/skript/textbearbetning.js";
import { valkommen } from "./Chapters/start/valkommen.js";
import { arkiv } from "./Chapters/system/arkiv.js";
import { lankar } from "./Chapters/system/lankar.js";
import { miljo } from "./Chapters/system/miljo.js";
import { processer } from "./Chapters/system/processer.js";
import { rattigheter } from "./Chapters/system/rattigheter.js";
import { git } from "./Chapters/verktyg/git.js";
import { skal } from "./Chapters/verktyg/skal.js";
import type { Chapter } from "./Types/Chapter.js";

export function defineChapters(): Chapter[] {
  return [
    valkommen(),
    navigera(),
    filer(),
    lasaText(),
    pipes(),
    miljo(),
    rattigheter(),
    lankar(),
    processer(),
    arkiv(),
    systemd(),
    natverk(),
    filoverforing(),
    diskar(),
    distributioner(),
    familjDebian(),
    familjArch(),
    familjRedhat(),
    universellaPaket(),
    textbearbetning(),
    skript(),
    schemalaggning(),
    git(),
    skal(),
    anvandare(),
  ];
}
