// Navigating: what the columns of `ls -l` are, on two rows of the simulator's own output in the learner's home
// directory – the documents directory and the notes file.
import { C, PAD, W, label, perLanguage, svg, terminal, tr, world } from "./style.mjs";

export const variants = perLanguage("ls-long");

export const words = {
  type: {
    en: "type: d = directory, - = file",
    sv: "typ: d = katalog, - = fil",
    de: "Typ: d = Verzeichnis, - = Datei",
    fr: "type : d = répertoire, - = fichier",
    es: "tipo: d = directorio, - = archivo",
    pt: "tipo: d = diretório, - = arquivo",
    ru: "тип: d = каталог, - = файл",
    zh: "类型：d = 目录，- = 文件",
    ja: "種類：d = ディレクトリ、- = ファイル",
    ar: "النوع: d = مجلد، - = ملف",
    hi: "type: d = directory, - = file",
  },
  permissions: { en: "permissions", sv: "rättigheter", de: "Rechte", fr: "permissions", es: "permisos", pt: "permissões", ru: "права доступа", zh: "权限", ja: "パーミッション", ar: "الصلاحيات", hi: "permissions" },
  links: { en: "links", sv: "länkar", de: "Links", fr: "liens", es: "enlaces", pt: "links", ru: "ссылки", zh: "链接数", ja: "リンク数", ar: "الروابط", hi: "links" },
  owner: { en: "owner", sv: "ägare", de: "Besitzer", fr: "propriétaire", es: "propietario", pt: "dono", ru: "владелец", zh: "所有者", ja: "所有者", ar: "المالك", hi: "owner" },
  group: { en: "group", sv: "grupp", de: "Gruppe", fr: "groupe", es: "grupo", pt: "grupo", ru: "группа", zh: "组", ja: "グループ", ar: "المجموعة", hi: "group" },
  size: { en: "size in bytes", sv: "storlek i byte", de: "Größe in Bytes", fr: "taille en octets", es: "tamaño en bytes", pt: "tamanho em bytes", ru: "размер в байтах", zh: "大小（字节）", ja: "サイズ（バイト）", ar: "الحجم بالبايت", hi: "size (bytes में)" },
  changed: { en: "last changed", sv: "senast ändrad", de: "zuletzt geändert", fr: "dernière modification", es: "última modificación", pt: "última alteração", ru: "последнее изменение", zh: "最后修改时间", ja: "最終更新日時", ar: "آخر تعديل", hi: "आख़िरी बदलाव" },
  name: { en: "name", sv: "namn", de: "Name", fr: "nom", es: "nombre", pt: "nome", ru: "имя", zh: "名称", ja: "名前", ar: "الاسم", hi: "name" },
};

export const terminals = { ls: { commands: ["ls -l"] } };

const STEP = 34;
const FIELDS = [
  ["type", C.x],
  ["permissions", C.accent],
  ["links", C.muted],
  ["owner", C.y],
  ["group", C.z],
  ["size", C.accent2],
  ["changed", "#a0661a"],
  ["name", C.ink],
];
const fieldRe = /^(\S)(\S{9})( +)(\d+)( +)(\S+)( +)(\S+)( +)(\d+)( +)(\S+ +\d+ +[\d:]+)( +)(.+)$/;

/** The two rows shown: the prompt, the documents directory and the notes file. */
function shown(v, R) {
  const n = world(v.lang).names;
  const l = R.ls.lines[0];
  const text = (row) => row.map((r) => r.text).join("");
  const output = l.output.filter((row) => [n.documents, n.notes].includes(text(row).split(/ +/).at(-1)));
  return [{ ...l, output }];
}

// The longest rows (German: 60 characters) need nearly the whole card: the terminal goes almost to its edges.
const TX = 9, TPAD = 8;
const termHeight = (v, R) => terminal(0, 0, W, shown(v, R), { pad: TPAD }).height;
export const height = (v, R) => PAD + termHeight(v, R) + 24 + FIELDS.length * STEP + PAD - 8;

export function draw(v, R) {
  const lines = shown(v, R);
  // The columns of each field: from the first to the last character it has in either row.
  const spans = FIELDS.map(() => [Infinity, -Infinity]);
  for (const row of lines[0].output) {
    const m = fieldRe.exec(row.map((r) => r.text).join(""));
    if (m === null) throw new Error(`not an ls -l row: ${row.map((r) => r.text).join("")}`);
    let col = 0;
    const groups = m.slice(1);
    let f = 0;
    groups.forEach((g, i) => {
      // Odd groups after the first two are the spaces between fields.
      const isField = i < 2 || i % 2 === 1;
      if (isField) {
        spans[f][0] = Math.min(spans[f][0], col);
        spans[f][1] = Math.max(spans[f][1], col + [...g].length);
        f++;
      }
      col += [...g].length;
    });
  }
  const marks = [];
  spans.forEach(([a, b], i) => {
    for (const row of [1, 2]) marks.push({ row, col: a, len: b - a, color: FIELDS[i][1] === C.ink ? "#9aa4b2" : FIELDS[i][1], opacity: 0.3 });
  });
  const t = terminal(TX, PAD, W - 2 * TX, lines, { marks, pad: TPAD });
  let s = t.svg;
  // Under the terminal: a bracket per field, and a line from each down to its name – the right-most field on top, so
  // that no line crosses a name.
  const by = PAD + t.height + 8;
  spans.forEach(([a, b], i) => {
    const [key, color] = FIELDS[i];
    const x0 = t.colX(a) + 1, x1 = t.colX(b) - 1;
    const lx = x0 + Math.min(6, (x1 - x0) / 2);
    const ly = by + 22 + (FIELDS.length - 1 - i) * STEP;
    s += `<path d="M${x0},${by - 6} V${by} H${x1} V${by - 6}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    s += `<path d="M${lx},${by} V${ly} H${lx + 10}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    s += label(v, lx + 16, ly, tr(v, words[key]), { visual: true, weight: 600, fit: W - PAD - 6 - (lx + 16) });
  });
  return svg(height(v, R), s);
}
