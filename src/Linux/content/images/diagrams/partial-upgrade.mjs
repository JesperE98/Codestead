// The Arch family: why pacman -Sy followed by pacman -S is dangerous. After -Sy the database knows the newest versions,
// so -S installs a new htop that needs a newer ncurses than the one you have (a partial upgrade: broken). -Syu upgrades
// everything together, so the new htop finds the new ncurses.
import { C, FS, PAD, W, box, isRtl, label, perLanguage, svg, tr } from "./style.mjs";
import { cmd, famBadge, famBadgeWidth, pkg, verdict, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("partial-upgrade");

export const words = {
  arch: distroWords.arch,
  partial: { en: "partial upgrade", sv: "partial upgrade", de: "partial upgrade", fr: "mise à jour partielle", es: "actualización parcial", pt: "atualização parcial", ru: "частичное обновление", zh: "部分升级", ja: "部分的なアップグレード", ar: "ترقية جزئية", hi: "partial upgrade" },
  needs: { en: "needs ncurses 6.5", sv: "behöver ncurses 6.5", de: "braucht ncurses 6.5", fr: "a besoin de ncurses 6.5", es: "necesita ncurses 6.5", pt: "precisa do ncurses 6.5", ru: "нужен ncurses 6.5", zh: "需要 ncurses 6.5", ja: "ncurses 6.5 が必要", ar: "تحتاج ncurses 6.5", hi: "ncurses 6.5 चाहिए" },
};

const GAP = 16;
const COL = (W - 2 * PAD - GAP) / 2;
const TOP = PAD + 46;
const CMD1 = TOP + 66, CMD2 = CMD1 + 46;
const PK1 = CMD2 + 64, PK2 = PK1 + 82;
export const height = PK2 + 34 + PAD;

export function draw(v) {
  const rtl = isRtl(v);
  const fam = tr(v, words.arch);
  let s = famBadge(v, rtl ? W - PAD - famBadgeWidth(fam) : PAD, PAD + 14, "arch", fam);
  const [badX, goodX] = rtl ? [PAD + COL + GAP, PAD] : [PAD, PAD + COL + GAP];
  // Each column: its commands, then what is installed afterwards, then the verdict.
  const column = (x, ok) => {
    let c = box(x, TOP, COL, height - PAD - TOP, { style: ok ? "y" : "x" });
    const vx = rtl ? x + 26 : x + COL - 26;
    c += verdict(vx, TOP + 26, ok, 15);
    if (ok) c += cmd(x + COL / 2, CMD1 + 23, "sudo pacman -Syu", { anchor: "middle" }).svg;
    else {
      c += cmd(x + COL / 2, CMD1, "sudo pacman -Sy", { anchor: "middle", w: 250 }).svg;
      c += cmd(x + COL / 2, CMD2, "sudo pacman -S htop", { anchor: "middle", w: 250 }).svg;
    }
    // Installed afterwards: the new htop on top, ncurses under it.
    const px = x + 24;
    c += pkg(px, PK1, "htop 3.4", { style: "accent", w: 180 }).svg;
    c += pkg(px, PK2, ok ? "ncurses 6.5" : "ncurses 6.4", { style: ok ? "accent" : "bad", w: 180 }).svg;
    // htop needs the new ncurses: a dashed line down, with the words beside it.
    const lx = px + 30;
    c += `<line x1="${lx}" y1="${PK1 + 18}" x2="${lx}" y2="${PK2 - 18}" stroke="${ok ? C.good : C.bad}" stroke-width="2" stroke-dasharray="4 3"/>`;
    c += label(v, lx + 12, (PK1 + PK2) / 2, tr(v, words.needs), { visual: true, weight: 600, color: ok ? C.good : C.bad, fit: x + COL - 10 - (lx + 12) });
    return c;
  };
  s += column(badX, false) + column(goodX, true);
  // The bad column's name.
  s += label(v, rtl ? badX + COL - 16 : badX + 16, TOP + 26, tr(v, words.partial), { weight: 700, color: C.bad, fit: COL - 64 });
  return svg(height, s);
}
