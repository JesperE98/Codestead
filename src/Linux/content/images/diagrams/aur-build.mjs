// The Arch family: how a package from the AUR comes about. The AUR only has the build recipe (PKGBUILD); git clone
// fetches it, makepkg downloads the source code and builds a .pkg.tar.zst on your computer, and -i installs that with
// pacman. The names are the simulator's (moonphase 1.4.2-1).
import { C, FS, PAD, W, arrow, box, code, folder, isRtl, label, perLanguage, svg, textWidth, tr } from "./style.mjs";
import { cmd, computer, famBadge, famBadgeWidth, fileChip, pkg, server, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("aur-build");

export const words = {
  arch: distroWords.arch,
  recipe: { en: "build recipe", sv: "byggrecept", de: "Baurezept", fr: "recette de construction", es: "receta de compilación", pt: "receita de build", ru: "рецепт сборки", zh: "构建脚本", ja: "ビルドレシピ", ar: "وصفة بناء", hi: "बिल्ड नुस्ख़ा" },
  builds: { en: "downloads the source code and builds", sv: "hämtar källkoden och bygger", de: "lädt den Quellcode und baut", fr: "télécharge le code source et construit", es: "descarga el código fuente y compila", pt: "baixa o código-fonte e compila", ru: "скачивает исходники и собирает", zh: "下载源代码并构建", ja: "ソースコードを取得してビルド", ar: "ينزّل الشيفرة المصدرية ويبنيها", hi: "सोर्स कोड डाउनलोड करके बिल्ड करता है" },
  installs: { en: "installs it with pacman", sv: "installerar det med pacman", de: "installiert es mit pacman", fr: "l'installe avec pacman", es: "lo instala con pacman", pt: "instala com o pacman", ru: "устанавливает через pacman", zh: "用 pacman 安装", ja: "pacman でインストール", ar: "يثبّتها باستخدام pacman", hi: "pacman से इंस्टॉल करता है" },
  installed: { en: "Installed", sv: "Installerat", de: "Installiert", fr: "Installé", es: "Instalado", pt: "Instalado", ru: "Установлено", zh: "已安装", ja: "インストール済み", ar: "المثبَّت", hi: "इंस्टॉल हुआ" },
};

const ROWH = 56, GAPH = 54;
const TOP = PAD + 44;
export const height = TOP + 4 * ROWH + 3 * GAPH + PAD;

export function draw(v) {
  const rtl = isRtl(v);
  const fam = tr(v, words.arch);
  let s = famBadge(v, rtl ? W - PAD - famBadgeWidth(fam) : PAD, PAD + 14, "arch", fam);
  // x of something w wide that starts dx from the row's start side.
  const at = (dx, w = 0) => (rtl ? W - PAD - dx - w : PAD + dx);
  const rowY = (i) => TOP + i * (ROWH + GAPH);
  const mid = (i) => rowY(i) + ROWH / 2;
  const row = (i, style) => box(PAD, rowY(i), W - 2 * PAD, ROWH, style ? { style } : { fill: "#ffffff" });
  // A mono text that starts dx from the start side (always written left to right).
  const mono = (dx, y, t, o = {}) => code(at(dx, textWidth(t, FS, true)), y, t, o);

  // 1. The AUR: only the recipe.
  s += row(0) + server(at(12, 34), rowY(0) + 10, 34, 36);
  s += label(v, at(58), mid(0), "AUR", { weight: 700, size: 21, ltr: true, anchor: rtl ? "end" : "start" });
  const p1 = fileChip(at(124, 160), mid(0), "PKGBUILD", { style: "accent2", w: 160 });
  s += p1.svg + label(v, at(124 + 160 + 12), mid(0), tr(v, words.recipe), { color: C.accent2, weight: 600, fit: W - 2 * PAD - 300 });
  // 2. Your copy of the recipe.
  s += row(1) + folder(at(16, 24), mid(1) - 9) + mono(58, mid(1), "~/moonphase/", { weight: 650 });
  s += fileChip(at(200, 160), mid(1), "PKGBUILD", { style: "accent2", w: 160 }).svg;
  // 3. The package makepkg built.
  s += row(2, "accent") + folder(at(16, 24), mid(2) - 9) + mono(58, mid(2), "~/moonphase/", { weight: 650 });
  const zst = "moonphase-1.4.2-1-x86_64.pkg.tar.zst";
  s += pkg(at(200, textWidth(zst, FS, true) + 50), mid(2), zst, { style: "accent" }).svg;
  // 4. Installed.
  s += row(3, "y") + computer(at(12, 36), rowY(3) + 13, 36, 24);
  s += label(v, at(58), mid(3), tr(v, words.installed), { weight: 700, size: 21, fit: 250 });
  s += pkg(at(320, 150), mid(3), "moonphase", { style: "good", w: 150 }).svg;

  // The steps between the rows.
  const steps = [["git clone https://aur.archlinux.org/moonphase.git", null, C.ink], ["makepkg -si", "builds", C.accent], ["-i", "installs", C.good]];
  steps.forEach(([command, does, color], i) => {
    const y0 = rowY(i) + ROWH, y1 = rowY(i + 1), my = (y0 + y1) / 2;
    const ax = at(29);
    s += arrow(ax, y0 + 4, ax, y1 - 4, { color, width: 2.5 });
    const c = cmd(at(52, textWidth(command, FS, true) + 24), my, command);
    s += c.svg;
    if (does) {
      const dx = rtl ? c.x - 14 : c.x + c.w + 14;
      s += label(v, dx, my, tr(v, words[does]), { color, weight: 600, fit: rtl ? dx - PAD - 4 : W - PAD - 4 - dx });
    }
  });
  return svg(height, s);
}
