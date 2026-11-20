// Archives and compression: the parts of tar -czvf documents.tar.gz documents – the options c, z, v and f (with the
// meanings of the chapter's table), the archive's name right after f, and then what gets packed.
import { C, FS, PAD, W, badge, isRtl, label, perLanguage, svg, textWidth, tr, world } from "./style.mjs";
import { cmdStrip } from "./_system.mjs";

export const variants = perLanguage("tar-options");

export const words = {
  c: { en: "Create a new archive", sv: "Skapa ett nytt arkiv", de: "Ein neues Archiv anlegen", fr: "Créer une nouvelle archive", es: "Crear un archivador nuevo", pt: "Cria um novo arquivo tar", ru: "Создать новый архив", zh: "创建新的归档文件", ja: "新しいアーカイブを作成する", ar: "إنشاء أرشيف جديد", hi: "नया archive बनाना" },
  z: {
    en: "Compress or decompress with gzip",
    sv: "Komprimera eller dekomprimera med gzip",
    de: "Mit gzip komprimieren oder dekomprimieren",
    fr: "Compresser ou décompresser avec gzip",
    es: "Comprimir o descomprimir con gzip",
    pt: "Comprime ou descomprime com o gzip",
    ru: "Сжимать или распаковывать с помощью gzip",
    zh: "用 gzip 压缩或解压",
    ja: "gzip で圧縮・展開する",
    ar: "الضغط أو فك الضغط بـ gzip",
    hi: "gzip से compress या decompress करना",
  },
  v: { en: "Show the files being processed", sv: "Visa filerna som hanteras", de: "Die verarbeiteten Dateien anzeigen", fr: "Afficher les fichiers traités", es: "Mostrar los archivos que se procesan", pt: "Mostra os arquivos sendo processados", ru: "Показывать обрабатываемые файлы", zh: "显示正在处理的文件", ja: "処理中のファイルを表示する", ar: "عرض الملفات التي تجري معالجتها", hi: "Process हो रही files दिखाना" },
  f: {
    en: "The archive file's name comes next",
    sv: "Arkivfilens namn kommer härnäst",
    de: "Als Nächstes kommt der Name der Archivdatei",
    fr: "Le nom du fichier d'archive vient ensuite",
    es: "A continuación viene el nombre del archivador",
    pt: "O nome do arquivo tar vem em seguida",
    ru: "Дальше идёт имя файла архива",
    zh: "接下来是归档文件的名字",
    ja: "次にアーカイブファイルの名前が来る",
    ar: "اسم ملف الأرشيف يأتي بعده",
    hi: "आगे archive file का नाम आता है",
  },
  archive: { en: "The archive file", sv: "Arkivfilen", de: "Die Archivdatei", fr: "Le fichier d'archive", es: "El archivador", pt: "O arquivo tar", ru: "Файл архива", zh: "归档文件", ja: "アーカイブファイル", ar: "ملف الأرشيف", hi: "Archive file" },
  packed: { en: "What gets packed", sv: "Det som packas ihop", de: "Was eingepackt wird", fr: "Ce qui est empaqueté", es: "Lo que se empaqueta", pt: "O que é empacotado", ru: "Что упаковывается", zh: "要打包的内容", ja: "まとめる対象", ar: "ما يُحزم", hi: "जो pack होता है" },
};

const SIZE = 25, CW = SIZE * 0.6;
const STRIP_Y = PAD + 30;
const ROW = 44;
const LEGEND_Y = STRIP_Y + 26 + 92;
export const height = LEGEND_Y + 5 * ROW + 12 + 16 + PAD;

export function draw(v) {
  const n = world(v.lang).names;
  const cmd = `tar -czvf ${n.documents}.tar.gz ${n.documents}`;
  const at = 2; // after "$ "
  const archiveCol = at + "tar -czvf ".length;
  const filesCol = archiveCol + `${n.documents}.tar.gz `.length;
  // The parts: [first column, length, word, colour].
  const parts = [
    [at + 5, 1, "c", C.accent],
    [at + 6, 1, "z", C.x],
    [at + 7, 1, "v", C.z],
    [at + 8, 1, "f", C.accent2],
    [archiveCol, `${n.documents}.tar.gz`.length, "archive", C.accent2],
    [filesCol, n.documents.length, "packed", C.y],
  ];
  const strip = cmdStrip(0, 0, cmd, { size: SIZE, h: 52 });
  const x0 = (W - strip.w) / 2;
  let s = cmdStrip(x0, STRIP_Y, cmd, { size: SIZE, h: 52 }).svg;
  const colX = (c) => x0 + 14 + c * CW;
  // A bracket under each part with its number.
  const centers = parts.map(([col, len]) => (colX(col) + colX(col + len)) / 2);
  const spread = spaced(centers, 38);
  const by = STRIP_Y + 26 + 8;
  parts.forEach(([col, len, , color], i) => {
    const a = colX(col) + 1, b = colX(col + len) - 1;
    s += `<path d="M${a},${by} v6 H${b} v-6" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    s += `<path d="M${centers[i]},${by + 6} L${spread[i]},${by + 18}" stroke="${color}" stroke-width="1.5"/>`;
    s += badge(spread[i], by + 36, i + 1, { color, r: 16 });
  });
  // The legend: number, the part, what it means – in reading order from the start side.
  const rtl = isRtl(v);
  parts.forEach(([col, len, word, color], i) => {
    const y = LEGEND_Y + i * ROW + (i >= 4 ? 12 : 0);
    const part = cmd.slice(col - at, col - at + len);
    const chipW = textWidth(part, FS, true) + 16;
    const bx = rtl ? W - PAD - 24 : PAD + 24;
    s += badge(bx, y, i + 1, { color, r: 16 });
    const cx = rtl ? bx - 22 - chipW : bx + 22;
    s += `<rect x="${cx}" y="${y - 15}" width="${chipW}" height="30" rx="5" fill="#ffffff" stroke="${C.boxStroke}"/>`;
    s += `<text x="${cx + chipW / 2}" y="${y}" font-size="${FS}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono', monospace" style="white-space:pre">${part}</text>`;
    const tx = rtl ? cx - 14 : cx + chipW + 14;
    s += label(v, tx, y, tr(v, words[word]), { fit: rtl ? tx - PAD - 4 : W - PAD - 4 - tx });
  });
  return svg(height, s);
}

/** Positions near `xs` (in order) at least `gap` apart: the mean of pushing them apart to the right and to the left. */
function spaced(xs, gap) {
  const right = [...xs], left = [...xs];
  for (let i = 1; i < xs.length; i++) right[i] = Math.max(right[i], right[i - 1] + gap);
  for (let i = xs.length - 2; i >= 0; i--) left[i] = Math.min(left[i], left[i + 1] - gap);
  return xs.map((_, i) => (right[i] + left[i]) / 2);
}
