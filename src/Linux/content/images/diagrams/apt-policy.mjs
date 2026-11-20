// The Debian family: what apt policy shows about moonphase once it is installed from the PPA – the simulator's own
// output, with *** (the installed version), 500 (the repository's priority) and 100 (what is already installed) marked
// in colour and explained under the terminal.
import { C, FS, MONO, PAD, W, esc, isRtl, label, perLanguage, svg, terminal, textWidth, tr } from "./style.mjs";

export const variants = perLanguage("apt-policy");

export const words = {
  installed: { en: "the installed version", sv: "den installerade versionen", de: "die installierte Version", fr: "la version installée", es: "la versión instalada", pt: "a versão instalada", ru: "установленная версия", zh: "已安装的版本", ja: "インストールされているバージョン", ar: "الإصدار المثبّت", hi: "इंस्टॉल किया गया संस्करण" },
  priority: { en: "the repository's priority", sv: "förrådets prioritet", de: "die Priorität des Repositorys", fr: "la priorité du dépôt", es: "la prioridad del repositorio", pt: "a prioridade do repositório", ru: "приоритет репозитория", zh: "软件源的优先级", ja: "リポジトリの優先度", ar: "أولوية المستودع", hi: "रिपॉज़िटरी की प्राथमिकता" },
  already: { en: "what is already installed", sv: "det som redan är installerat", de: "das, was schon installiert ist", fr: "ce qui est déjà installé", es: "lo que ya está instalado", pt: "o que já está instalado", ru: "то, что уже установлено", zh: "已经安装的版本", ja: "すでにインストールされているもの", ar: "ما هو مثبّت أصلًا", hi: "जो पहले से इंस्टॉल है" },
};

export const terminals = {
  policy: {
    setup: ["sudo apt update", "sudo add-apt-repository -y ppa:lunatool/moonphase", "sudo apt install -y moonphase"],
    commands: ["apt policy moonphase"],
  },
};

const ROW = 42;
const termHeight = (R) => terminal(0, 0, W, R.policy.lines).height;
export const height = (v, R) => PAD + termHeight(R) + 18 + 3 * ROW + PAD - 8;

export function draw(v, R) {
  const rows = R.policy.lines.flatMap((l) => [l.prompt.map((r) => r.text).join("") + l.typed, ...l.output.map((r) => r.map((x) => x.text).join(""))]);
  const find = (re) => {
    const i = rows.findIndex((r) => re.test(r));
    if (i < 0) throw new Error(`no row ${re} in apt policy's output`);
    return [i, rows[i].search(re)];
  };
  const [rStar, cStar] = find(/\*\*\*/);
  const [rPrio, cPrio0] = find(/^ +500 /);
  const [rDpkg, cDpkg0] = find(/^ +100 /);
  const cPrio = cPrio0 + rows[rPrio].slice(cPrio0).search(/5/), cDpkg = cDpkg0 + rows[rDpkg].slice(cDpkg0).search(/1/);
  const cVer = rows[rStar].lastIndexOf("500");
  const marks = [
    { row: rStar, col: cStar, len: 3, color: C.accent, opacity: 0.55 },
    { row: rStar, col: cVer, len: 3, color: C.accent2, opacity: 0.55 },
    { row: rPrio, col: cPrio, len: 3, color: C.accent2, opacity: 0.55 },
    { row: rDpkg, col: cDpkg, len: 3, color: C.y, opacity: 0.55 },
  ];
  const t = terminal(PAD, PAD, W - 2 * PAD, R.policy.lines, { marks, cut: 57 });
  let s = t.svg;
  // The legend: the marked text on a chip of its colour, and what it means.
  const rtl = isRtl(v);
  const legend = [["***", C.accent, "installed"], ["500", C.accent2, "priority"], ["100", C.y, "already"]];
  legend.forEach(([code, color, word], i) => {
    const y = PAD + t.height + 18 + ROW / 2 + i * ROW;
    const cw = textWidth(code, FS, true) + 20;
    const cx = rtl ? W - PAD - 6 - cw : PAD + 6;
    s += `<rect x="${cx}" y="${y - 15}" width="${cw}" height="30" rx="5" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1.5"/>`;
    s += `<text x="${cx + cw / 2}" y="${y}" font-size="${FS}" font-weight="700" fill="${C.ink}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(code)}</text>`;
    const tx = rtl ? cx - 14 : cx + cw + 14;
    s += label(v, tx, y, tr(v, words[word]), { weight: 600, fit: rtl ? tx - PAD : W - PAD - tx });
  });
  return svg(height(v, R), s);
}
