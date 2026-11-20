// Distributions and families: where a program comes from – the distribution's repository (tested and signed packages),
// the package manager (apt, pacman or dnf) and your computer – and that the package manager brings a package's
// dependency along by itself: htop needs the ncurses library (on every distribution), so both are installed.
import { C, FS, PAD, W, arrow, box, code, isRtl, label, perLanguage, svg, tr } from "./style.mjs";
import { computer, lock, pkg, server } from "./_distro.mjs";

export const variants = perLanguage("packages");

export const words = {
  repository: { en: "Repository", sv: "Förråd", de: "Repository", fr: "Dépôt", es: "Repositorio", pt: "Repositório", ru: "Репозиторий", zh: "软件源", ja: "リポジトリ", ar: "المستودع", hi: "रिपॉज़िटरी" },
  // A line break (\n) where the words need two lines.
  manager: { en: "Package\nmanager", sv: "Paket-\nhanterare", de: "Paket-\nmanager", fr: "Gestionnaire\nde paquets", es: "Gestor\nde paquetes", pt: "Gerenciador\nde pacotes", ru: "Пакетный\nменеджер", zh: "包管理器", ja: "パッケージ\nマネージャー", ar: "مدير الحزم", hi: "पैकेज\nमैनेजर" },
  computer: { en: "Your computer", sv: "Din dator", de: "Dein Computer", fr: "Votre ordinateur", es: "Tu ordenador", pt: "Seu computador", ru: "Ваш компьютер", zh: "你的计算机", ja: "コンピューター", ar: "حاسوبك", hi: "आपका कंप्यूटर" },
  dependency: { en: "dependency", sv: "beroende", de: "Abhängigkeit", fr: "dépendance", es: "dependencia", pt: "dependência", ru: "зависимость", zh: "依赖", ja: "依存関係", ar: "الاعتمادية", hi: "निर्भरता" },
};

const COLW = 210, MIDW = 180, GAPX = 40;
const Y_HTOP = PAD + 132, Y_NCURSES = PAD + 212;
export const height = PAD + 306 + PAD;

export function draw(v) {
  const rtl = isRtl(v);
  // x of a box w wide whose left edge is x in a left-to-right picture (mirrored in a right-to-left one).
  const mx = (x, w) => (rtl ? W - x - w : x);
  const repoX = mx(PAD, COLW), midX = mx(PAD + COLW + GAPX, MIDW), pcX = mx(PAD + COLW + GAPX + MIDW + GAPX, COLW);
  const inner = height - 2 * PAD;
  let s = "";
  // The repository: a server, its name, a lock (signed) and some of its packages.
  s += box(repoX, PAD, COLW, inner, { fill: "#ffffff" });
  s += server(repoX + COLW / 2 - 26, PAD + 14, 52, 44);
  s += lock(repoX + COLW / 2 + 32, PAD + 34, C.good);
  s += label(v, repoX + COLW / 2, PAD + 84, tr(v, words.repository), { anchor: "middle", size: 21, weight: 700, fit: COLW - 16 });
  // The two packages at the start side, so that the word "dependency" has room beside them.
  const chipX = rtl ? repoX + COLW - 14 - 132 : repoX + 14;
  s += pkg(chipX, Y_HTOP, "htop", { style: "accent", w: 132 }).svg;
  s += pkg(chipX, Y_NCURSES, "ncurses", { style: "accent2", w: 132 }).svg;
  // htop needs ncurses: a dashed arrow down from one to the other, with the word beside it.
  const depX = rtl ? chipX + 132 - 30 : chipX + 30;
  s += arrow(depX, Y_HTOP + 20, depX, Y_NCURSES - 20, { color: C.accent2, width: 2, dash: "4 3" });
  s += label(v, depX + (rtl ? -10 : 10), (Y_HTOP + Y_NCURSES) / 2, tr(v, words.dependency), { size: FS, weight: 600, color: C.accent2, fit: COLW - 14 - 30 - 10 - 8 });
  s += pkg(repoX + 14, PAD + 268, "vim", { style: "muted", w: 84 }).svg;
  s += pkg(repoX + COLW - 14 - 84, PAD + 268, "git", { style: "muted", w: 84 }).svg;

  // The package manager.
  const my = PAD + 96, mh = 152;
  s += box(midX, my, MIDW, mh, { style: "accent" });
  const lines = tr(v, words.manager).split("\n");
  lines.forEach((l, i) => (s += label(v, midX + MIDW / 2, my + 44 - (lines.length - 1) * 13 + i * 26, l, { anchor: "middle", weight: 700, fit: MIDW - 14 })));
  s += code(midX + MIDW / 2, my + 96, "apt · dnf", { anchor: "middle", weight: 600 });
  s += code(midX + MIDW / 2, my + 124, "pacman", { anchor: "middle", weight: 600 });

  // Your computer: both packages installed.
  s += box(pcX, PAD, COLW, inner, { fill: "#ffffff" });
  s += computer(pcX + COLW / 2 - 30, PAD + 14, 60, 36);
  s += label(v, pcX + COLW / 2, PAD + 84, tr(v, words.computer), { anchor: "middle", size: 21, weight: 700, fit: COLW - 16 });
  s += pkg(pcX + COLW / 2, Y_HTOP, "htop", { anchor: "middle", style: "accent", w: 132 }).svg;
  s += pkg(pcX + COLW / 2, Y_NCURSES, "ncurses", { anchor: "middle", style: "accent2", w: 132 }).svg;

  // The flow: repository → package manager → computer, for both packages.
  const repoEdge = rtl ? chipX : chipX + 132;
  const midIn = rtl ? midX + MIDW : midX, midOut = rtl ? midX : midX + MIDW;
  const pcEdge = rtl ? pcX + COLW / 2 + 66 : pcX + COLW / 2 - 66;
  for (const [y, color] of [[Y_HTOP, C.accent], [Y_NCURSES, C.accent2]]) {
    s += arrow(repoEdge + (rtl ? -4 : 4), y, midIn + (rtl ? 2 : -2), y, { color, width: 2.5 });
    s += arrow(midOut, y, pcEdge + (rtl ? 4 : -4), y, { color, width: 2.5 });
  }
  return svg(height, s);
}
