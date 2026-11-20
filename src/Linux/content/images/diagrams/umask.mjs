// Links and file information: what the usual umask 022 does. New files start from rw-rw-rw- (666) and new directories
// from rwxrwxrwx (777); the umask's bits (the w of the group and of others) are taken away, which leaves 644 and 755.
import { C, FS, FS_TITLE, PAD, W, code, label, perLanguage, startX, svg, tr } from "./style.mjs";
import { words as systemWords } from "./_system.mjs";

export const variants = perLanguage("umask");

export const words = {
  owner: systemWords.owner,
  group: systemWords.group,
  others: systemWords.others,
  files: { en: "New files", sv: "Nya filer", de: "Neue Dateien", fr: "Nouveaux fichiers", es: "Archivos nuevos", pt: "Arquivos novos", ru: "Новые файлы", zh: "新文件", ja: "新しいファイル", ar: "الملفات الجديدة", hi: "नई files" },
  dirs: { en: "New directories", sv: "Nya kataloger", de: "Neue Verzeichnisse", fr: "Nouveaux répertoires", es: "Directorios nuevos", pt: "Diretórios novos", ru: "Новые каталоги", zh: "新目录", ja: "新しいディレクトリ", ar: "المجلدات الجديدة", hi: "नई directories" },
};

const CELL = 34, IN = 4, GAP = 26;
const X0 = PAD + 236; // the first cell
const TW = 3 * CELL + 2 * IN;
const tripX = (g) => X0 + g * (TW + GAP);
const LABEL_END = X0 - 18;
const SETS = [["owner", C.y], ["group", C.z], ["others", C.accent2]];
const HEAD = PAD + 14;
const ROW = 44;
const BLOCK = 40 + 3 * ROW + 24;
const B0 = HEAD + 30;
const UMASK = "----w--w-";
const BLOCKS = [["files", "666", "rw-rw-rw-", "644"], ["dirs", "777", "rwxrwxrwx", "755"]];
export const height = B0 + BLOCKS.length * BLOCK - 24 + PAD - 4;

function cell(x, y, ch, o = {}) {
  return `<rect x="${x}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}" rx="5" fill="${o.fill ?? "#ffffff"}" stroke="${o.stroke ?? C.boxStroke}" stroke-width="${o.width ?? 1.5}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>` +
    (ch ? code(x + CELL / 2, y, ch, { anchor: "middle", weight: 700, color: o.color ?? C.ink, size: 21 }) : "");
}

export function draw(v) {
  let s = "";
  SETS.forEach(([key, color], g) => (s += label(v, tripX(g) + TW / 2, HEAD, tr(v, words[key]), { anchor: "middle", color, weight: 700, fit: TW + GAP - 4 })));
  BLOCKS.forEach(([key, start, bits, result], b) => {
    const top = B0 + b * BLOCK;
    if (b > 0) s += `<line x1="${PAD}" y1="${top - 14}" x2="${W - PAD}" y2="${top - 14}" stroke="${C.grid}" stroke-width="1"/>`;
    s += label(v, startX(v, PAD + 4, W - PAD - 4), top + 12, tr(v, words[key]), { size: FS_TITLE, weight: 700 });
    const y1 = top + 40 + ROW / 2, y2 = y1 + ROW, y3 = y2 + ROW;
    // The start, the umask's bits and what is left; the numbers on the left.
    s += code(LABEL_END, y1, start, { anchor: "end", weight: 700, color: C.muted, size: 21 });
    s += code(LABEL_END, y2, "− 022", { anchor: "end", weight: 700, color: C.bad, size: 21 });
    s += `<rect x="${LABEL_END - 170}" y="${y2 - 15}" width="78" height="30" rx="15" fill="${C.xSoft}" stroke="${C.bad}" stroke-width="1.5"/>` + code(LABEL_END - 131, y2, "umask", { anchor: "middle", weight: 700, color: C.bad });
    s += code(LABEL_END, y3, `= ${result}`, { anchor: "end", weight: 800, color: C.accent, size: 23 });
    let left = "";
    for (let i = 0; i < 9; i++) {
      const g = Math.floor(i / 3), k = i % 3;
      const x = tripX(g) + k * (CELL + IN);
      const color = SETS[g][1];
      const on = bits[i] !== "-", masked = UMASK[i] !== "-";
      s += cell(x, y1, bits[i], on ? { stroke: color } : { fill: C.card, color: C.line });
      s += masked ? cell(x, y2, UMASK[i], { fill: C.xSoft, stroke: C.bad, color: C.bad, width: 2 }) : cell(x, y2, "", { fill: "none", stroke: C.grid, dash: "3 3", width: 1 });
      const kept = on && !masked;
      left += kept ? bits[i] : "-";
      s += kept ? cell(x, y3, bits[i], { stroke: color, width: 2 }) : cell(x, y3, "-", { fill: masked ? C.xSoft : C.card, stroke: masked ? C.bad : C.boxStroke, color: masked ? C.bad : C.line, dash: masked ? "4 3" : undefined });
    }
    const octal = [0, 3, 6].map((i) => [...left.slice(i, i + 3)].reduce((n, ch, k) => n + (ch === "-" ? 0 : [4, 2, 1][k]), 0)).join("");
    if (octal !== result) throw new Error(`${bits} minus the umask is ${left} (${octal}), not ${result}`);
  });
  return svg(height, s);
}
