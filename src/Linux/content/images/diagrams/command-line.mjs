// Welcome: the parts of a command line in the course's terminal – the prompt (user, computer, where you are, $) and the
// command (command, option, argument) – with the prompt the simulator shows the learner.
import { C, FS, PAD, W, badge, isRtl, label, perLanguage, svg, terminal, textWidth, tr, world } from "./style.mjs";

export const variants = perLanguage("command-line");

export const words = {
  user: { en: "user", sv: "användare", de: "Benutzer", fr: "utilisateur", es: "usuario", pt: "usuário", ru: "пользователь", zh: "用户", ja: "ユーザー", ar: "المستخدم", hi: "user" },
  host: { en: "computer", sv: "dator", de: "Rechner", fr: "ordinateur", es: "ordenador", pt: "computador", ru: "компьютер", zh: "计算机", ja: "コンピューター", ar: "الحاسوب", hi: "computer" },
  where: {
    en: "where you are (~ = your home directory)",
    sv: "var du står (~ = din hemkatalog)",
    de: "wo du bist (~ = dein Home-Verzeichnis)",
    fr: "où vous êtes (~ = votre répertoire personnel)",
    es: "dónde estás (~ = tu directorio personal)",
    pt: "onde você está (~ = seu diretório pessoal)",
    ru: "где вы (~ = ваш домашний каталог)",
    zh: "你所在的位置（~ = 你的主目录）",
    ja: "今いる場所（~ = ホームディレクトリ）",
    ar: "أين أنت (~ = مجلد المنزل الخاص بك)",
    hi: "आप कहाँ हैं (~ = आपकी home directory)",
  },
  dollar: {
    en: "a regular user (root gets #)",
    sv: "en vanlig användare (root får #)",
    de: "ein normaler Benutzer (root bekommt #)",
    fr: "un utilisateur ordinaire (root a #)",
    es: "un usuario normal (root tiene #)",
    pt: "um usuário comum (o root tem #)",
    ru: "обычный пользователь (у root – #)",
    zh: "普通用户（root 是 #）",
    ja: "一般ユーザー（root なら #）",
    ar: "مستخدم عادي (المدير root يرى #)",
    hi: "सामान्य user (root के लिए #)",
  },
  command: { en: "command", sv: "kommando", de: "Befehl", fr: "commande", es: "comando", pt: "comando", ru: "команда", zh: "命令", ja: "コマンド", ar: "الأمر", hi: "command" },
  option: { en: "option", sv: "flagga", de: "Option", fr: "option", es: "opción", pt: "opção", ru: "опция", zh: "选项", ja: "オプション", ar: "الخيار", hi: "option" },
  argument: { en: "argument", sv: "argument", de: "Argument", fr: "argument", es: "argumento", pt: "argumento", ru: "аргумент", zh: "参数", ja: "引数", ar: "الوسيط", hi: "argument" },
};

export const terminals = { line: { commands: ["ls -l /etc"] } };

const SIZE = 25; // the command line, larger than the rest
const CW = SIZE * 0.6;
const STRIP_Y = PAD + 6;
const ROW = 42;
const LEGEND_Y = STRIP_Y + 64 + 80;
export const height = LEGEND_Y + 7 * ROW + PAD - 6;

export function draw(v, R) {
  const user = world(v.lang).names.user;
  // The parts: [first column, length, word, colour].
  const prompt = `${user}@ubuntu:~$ `;
  const at = prompt.length;
  const parts = [
    [0, user.length, "user", C.y],
    [user.length + 1, 6, "host", C.y],
    [user.length + 8, 1, "where", C.z],
    [user.length + 9, 1, "dollar", C.muted],
    [at, 2, "command", C.accent],
    [at + 3, 2, "option", C.accent2],
    [at + 6, 4, "argument", C.x],
  ];
  const width = (prompt.length + 10) * CW + 28;
  const x0 = (W - width) / 2;
  const t = terminal(x0, STRIP_Y, width, R.line.lines.map((l) => ({ ...l, output: [] })), { size: SIZE, pad: 14 });
  let s = t.svg;
  // A bracket under each part with its number; the numbers move apart where the parts are close (~$ ls).
  const centers = parts.map(([col, len]) => (t.colX(col) + t.colX(col + len)) / 2);
  const spread = spaced(centers, 36);
  parts.forEach(([col, len, , color], i) => {
    const a = t.colX(col) + 1, b = t.colX(col + len) - 1;
    const y = STRIP_Y + t.height + 8;
    s += `<path d="M${a},${y} v6 H${b} v-6" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    s += `<path d="M${centers[i]},${y + 6} L${spread[i]},${y + 16}" stroke="${color}" stroke-width="1.5"/>`;
    s += badge(spread[i], y + 32, i + 1, { color, r: 16 });
  });
  // The legend: number, the part as code, what it is – in reading order from the start side.
  const rtl = isRtl(v);
  parts.forEach(([col, len, word, color], i) => {
    const y = LEGEND_Y + i * ROW + (i >= 4 ? 10 : 0);
    const part = (prompt + "ls -l /etc").slice(col, col + len);
    const chipW = textWidth(part, FS, true) + 16;
    const bx = rtl ? W - PAD - 40 : PAD + 40;
    s += badge(bx, y, i + 1, { color, r: 16 });
    const cx = rtl ? bx - 22 - chipW : bx + 22;
    s += `<rect x="${cx}" y="${y - 15}" width="${chipW}" height="30" rx="5" fill="#ffffff" stroke="${C.boxStroke}"/>`;
    s += `<text x="${cx + chipW / 2}" y="${y}" font-size="${FS}" font-weight="600" fill="${color === C.muted ? C.ink : color}" text-anchor="middle" dominant-baseline="central" font-family="'JetBrains Mono', monospace" style="white-space:pre">${part}</text>`;
    const tx = rtl ? cx - 14 : cx + chipW + 14;
    s += label(v, tx, y, tr(v, words[word]), { fit: rtl ? tx - PAD - 8 : W - PAD - 8 - tx });
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
