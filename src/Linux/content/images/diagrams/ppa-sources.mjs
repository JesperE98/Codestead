// The Debian family: what adding a PPA does. Every file in /etc/apt/sources.list.d/ points apt at a repository –
// ubuntu.sources at Ubuntu's own, the new lunatool-ubuntu-moonphase-noble.sources at the PPA on Launchpad (not reviewed
// by the distribution) – and apt update reads them all into the package list, which now has moonphase too. The names
// are the simulator's.
import { C, FS, PAD, W, arrow, arrowPath, box, code, folder, isRtl, label, perLanguage, svg, tag, tr } from "./style.mjs";
import { cmd, famBadge, famBadgeWidth, fileChip, pkg, server, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("ppa-sources");

export const words = {
  debian: distroWords.debian,
  isNew: { en: "new", sv: "ny", de: "neu", fr: "nouveau", es: "nuevo", pt: "novo", ru: "новый", zh: "新增", ja: "新規", ar: "جديد", hi: "नई" },
  ubuntu: { en: "Ubuntu's repository", sv: "Ubuntus förråd", de: "Ubuntus Repository", fr: "Dépôt d'Ubuntu", es: "Repositorio de Ubuntu", pt: "Repositório do Ubuntu", ru: "Репозиторий Ubuntu", zh: "Ubuntu 的软件源", ja: "Ubuntu のリポジトリ", ar: "مستودع Ubuntu", hi: "Ubuntu की रिपॉज़िटरी" },
  notReviewed: { en: "not reviewed", sv: "granskas inte", de: "nicht geprüft", fr: "non vérifié", es: "sin revisar", pt: "não revisado", ru: "не проверяется", zh: "未经审查", ja: "レビューなし", ar: "لا تُراجَع", hi: "समीक्षा नहीं होती" },
  list: { en: "Package list", sv: "Paketlistan", de: "Paketliste", fr: "Liste des paquets", es: "Lista de paquetes", pt: "Lista de pacotes", ru: "Список пакетов", zh: "软件包列表", ja: "パッケージ一覧", ar: "قائمة الحزم", hi: "पैकेज सूची" },
};

const DIR_Y = PAD + 44; // the directory panel
const FILE1 = DIR_Y + 62, FILE2 = FILE1 + 46;
const SRV_Y = FILE2 + 50; // the repositories
const SRV_H = 146;
const UPD_Y = SRV_Y + SRV_H + 40; // the apt update strip
const LIST_Y = UPD_Y + 62;
export const height = LIST_Y + 34 + PAD;

export function draw(v) {
  const rtl = isRtl(v);
  const fam = tr(v, words.debian);
  let s = famBadge(v, rtl ? W - PAD - famBadgeWidth(fam) : PAD, PAD + 14, "debian", fam);
  // The directory with its two files (paths are always left to right).
  const dirH = FILE2 + 30 - DIR_Y;
  s += box(PAD, DIR_Y, W - 2 * PAD, dirH, { fill: "#fffaf0", stroke: "#c99a2e" });
  s += folder(PAD + 14, DIR_Y + 14) + code(PAD + 48, DIR_Y + 23, "/etc/apt/sources.list.d/", { weight: 650 });
  // In the order ls lists them: the PPA's file first.
  const f2 = fileChip(PAD + 28, FILE1, "lunatool-ubuntu-moonphase-noble.sources", { style: "accent2" });
  const f1 = fileChip(PAD + 28, FILE2, "ubuntu.sources");
  s += f1.svg + f2.svg;
  // The two repositories, each pointed at by its file.
  const half = (W - 2 * PAD - 16) / 2;
  const [ux, px] = [PAD, PAD + half + 16];
  s += box(ux, SRV_Y, half, SRV_H, { fill: "#ffffff" });
  s += box(px, SRV_Y, half, SRV_H, { style: "accent2" });
  // Inside a repository box: x offsets from its start side (the right in a right-to-left language).
  const at = (bx, dx) => (rtl ? bx + half - dx : bx + dx);
  s += server(rtl ? at(ux, 52) : at(ux, 14), SRV_Y + 14, 38, 40) + server(rtl ? at(px, 52) : at(px, 14), SRV_Y + 14, 38, 40, { led: C.accent2 });
  s += label(v, at(ux, 64), SRV_Y + 24, tr(v, words.ubuntu), { weight: 700, fit: half - 72 });
  s += label(v, at(px, 64), SRV_Y + 24, `PPA – ${tr(v, words.notReviewed)}`, { weight: 700, color: C.bad, fit: half - 72 });
  const codeAt = (bx, s2) => code(at(bx, 16), SRV_Y + 74, s2, { color: C.muted, anchor: rtl ? "end" : "start", fit: half - 24 });
  s += codeAt(ux, "archive.ubuntu.com") + codeAt(px, "ppa.launchpadcontent.net");
  s += pkg(rtl ? at(ux, 114) : at(ux, 14), SRV_Y + 114, "bash", { w: 100 }).svg + pkg(rtl ? at(ux, 224) : at(ux, 124), SRV_Y + 114, "htop", { w: 100 }).svg;
  const moon = pkg(0, 0, "moonphase").w;
  s += pkg(rtl ? at(px, 14 + moon) : at(px, 14), SRV_Y + 114, "moonphase", { style: "accent2" }).svg;
  // The pointers: dashed from each file down to its repository, without crossing anything.
  const p1x = f1.x + 40;
  s += arrow(p1x, FILE2 + 18, p1x, SRV_Y - 3, { color: C.line, width: 1.8, dash: "5 4" });
  const p2x = px + half - 40;
  s += arrowPath(`M${f2.x + f2.w},${FILE1} H${p2x} V${SRV_Y - 3}`, p2x, SRV_Y - 3, 0, 1, { color: C.accent2, width: 1.8, dash: "5 4" });
  s += tag(v, f2.x + f2.w + 12, FILE1, tr(v, words.isNew), { color: C.accent2, stroke: C.accent2, fill: "#ffffff" });
  // apt update reads both into the package list.
  const mid = W / 2;
  s += arrowPath(`M${ux + half / 2},${SRV_Y + SRV_H + 2} V${UPD_Y} H${mid - 120}`, mid - 120, UPD_Y, 1, 0, { color: C.ink, width: 2 });
  s += arrowPath(`M${px + half / 2},${SRV_Y + SRV_H + 2} V${UPD_Y} H${mid + 120}`, mid + 120, UPD_Y, -1, 0, { color: C.accent2, width: 2 });
  s += cmd(mid, UPD_Y, "sudo apt update", { anchor: "middle", w: 220 }).svg;
  s += arrow(mid, UPD_Y + 19, mid, LIST_Y - 28, { color: C.ink, width: 2 });
  // The package list.
  const items = [["bash", "plain"], ["htop", "plain"], ["moonphase", "accent2"]];
  const listW = items.reduce((w, [n]) => w + pkg(0, 0, n).w + 10, 0) - 10;
  const lx = rtl ? PAD + 14 : W - PAD - 14 - listW;
  s += box(PAD, LIST_Y - 26, W - 2 * PAD, 52, { fill: "#ffffff" });
  s += label(v, rtl ? W - PAD - 14 : PAD + 14, LIST_Y, tr(v, words.list), { weight: 700, size: 21, fit: W - 2 * PAD - listW - 40 });
  let x = lx;
  for (const [n, style] of items) {
    const p = pkg(x, LIST_Y, n, { style, h: 34 });
    s += p.svg;
    x += p.w + 10;
  }
  return svg(height, s);
}
