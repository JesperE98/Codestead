// Files and directories: the shell expands a wildcard pattern before the command runs (ls gets the names, never the
// pattern), and which of the three practice files some patterns match – *.txt, the pattern of the chapter's own
// question in this language (read from the chapter), and [fs]*. The expansions and the matches are the simulator's.
import { readFileSync } from "node:fs";
import { C, FS, PAD, W, arrow, code, file, label, perLanguage, startX, svg, textWidth, tr, world } from "./style.mjs";

export const variants = perLanguage("glob");

export const words = {
  type: { en: "you type", sv: "du skriver", de: "du tippst", fr: "vous tapez", es: "escribes", pt: "você digita", ru: "вы вводите", zh: "你输入", ja: "入力する", ar: "تكتب", hi: "आप type करते हैं" },
  expands: {
    en: "the shell replaces the pattern with the matching names",
    sv: "skalet byter ut mönstret mot namnen som matchar",
    de: "die Shell ersetzt das Muster durch die passenden Namen",
    fr: "le shell remplace le motif par les noms correspondants",
    es: "la shell sustituye el patrón por los nombres que coinciden",
    pt: "o shell substitui o padrão pelos nomes correspondentes",
    ru: "shell заменяет шаблон подходящими именами",
    zh: "shell 把模式替换成匹配的文件名",
    ja: "シェルがパターンを一致するファイル名に置き換える",
    ar: "يستبدل الـ shell النمط بالأسماء المطابقة",
    hi: "shell pattern को matching names से बदल देता है",
  },
  gets: { en: "ls gets", sv: "ls får", de: "ls bekommt", fr: "ls reçoit", es: "ls recibe", pt: "ls recebe", ru: "ls получает", zh: "ls 收到的是", ja: "ls が受け取るもの", ar: "ما يستلمه ls", hi: "ls को मिलता है" },
};

/** The pattern of the chapter's own question (```predict … $ ls {{documents}}/<pattern>) in this language. */
function questionPattern(lang) {
  const md = readFileSync(new URL(`../../chapters/${lang}/filer.md`, import.meta.url), "utf8");
  const m = /```predict\n\$ ls \{\{documents\}\}\/(\S+)\n/.exec(md);
  if (m === null) throw new Error(`no ls question in ${lang}/filer.md`);
  return m[1];
}

const patterns = (v) => ["*.txt", questionPattern(v.lang), "[fs]*"];

export function terminals(v) {
  return { glob: { commands: ["echo ls {{documents}}/*.txt", "ls {{documents}}", ...patterns(v).map((p) => `echo {{documents}}/${p}`)] } };
}

const ROW = 44;
const GRID_Y = 282;
export const height = GRID_Y + 4 * ROW + PAD - 4;

function strip(x, y, w, s) {
  return `<rect x="${x}" y="${y - 21}" width="${w}" height="42" rx="6" fill="#0f1318"/>` + code(x + 14, y, s, { color: "#e6edf3" });
}

export function draw(v, R) {
  const dir = world(v.lang).names.documents;
  const out = R.glob.lines.map((l) => l.output.map((row) => row.map((r) => r.text).join("")).join("\n"));
  const files = out[1].split(/\s+/).filter((f) => f !== "");
  let s = "";
  // You type the pattern; the shell replaces it; ls gets the names.
  const lx = startX(v, PAD + 4, W - PAD - 4);
  s += label(v, lx, PAD + 12, tr(v, words.type), { color: C.muted, weight: 600 });
  s += strip(PAD, PAD + 52, W - 2 * PAD, `ls ${dir}/*.txt`);
  const starX = PAD + 14 + textWidth(`ls ${dir}/`, FS, true);
  s += `<rect x="${starX - 3}" y="${PAD + 36}" width="${textWidth("*.txt", FS, true) + 6}" height="32" rx="4" fill="none" stroke="${C.accent}" stroke-width="2"/>`;
  const ax = startX(v, PAD + 40, W - PAD - 40);
  s += arrow(ax, PAD + 78, ax, PAD + 134, { color: C.accent, width: 2.5 });
  s += label(v, startX(v, ax + 20, ax - 20), PAD + 106, tr(v, words.expands), { color: C.accent, weight: 600, fit: W - 2 * PAD - 70 });
  s += label(v, lx, PAD + 152, tr(v, words.gets), { color: C.muted, weight: 600 });
  s += strip(PAD, PAD + 192, W - 2 * PAD, out[0]);
  const gotX = PAD + 14 + textWidth("ls ", FS, true);
  s += `<rect x="${gotX - 3}" y="${PAD + 176}" width="${textWidth(out[0].slice(3), FS, true) + 6}" height="32" rx="4" fill="none" stroke="${C.accent}" stroke-width="2"/>`;
  // Which files each pattern matches.
  const nameW = Math.max(...files.map((f) => textWidth(f, FS, true))) + 40;
  const colW = (W - 2 * PAD - nameW - 10) / 3;
  const gx = PAD + nameW + 10;
  s += `<rect x="${PAD}" y="${GRID_Y - 4}" width="${W - 2 * PAD}" height="${4 * ROW + 4}" rx="6" fill="#ffffff" stroke="${C.boxStroke}"/>`;
  patterns(v).forEach((p, j) => {
    const cx = gx + j * colW + colW / 2;
    s += code(cx, GRID_Y + ROW / 2, p, { anchor: "middle", weight: 700, color: C.accent2 });
    const matched = out[2 + j].split(/\s+/).map((f) => f.slice(dir.length + 1));
    files.forEach((f, i) => {
      const cy = GRID_Y + (i + 1.5) * ROW;
      if (matched.includes(f)) s += `<circle cx="${cx}" cy="${cy}" r="14" fill="${C.ySoft}" stroke="${C.good}" stroke-width="1.5"/><path d="M${cx - 6},${cy} l4.5,5 l8,-10" fill="none" stroke="${C.good}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      else s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${C.line}"/>`;
    });
  });
  files.forEach((f, i) => {
    const cy = GRID_Y + (i + 1.5) * ROW;
    s += `<line x1="${PAD}" y1="${cy - ROW / 2}" x2="${W - PAD}" y2="${cy - ROW / 2}" stroke="${C.grid}"/>`;
    s += file(PAD + 14, cy - 10) + code(PAD + 40, cy, f);
  });
  return svg(height, s);
}
