// The Arch family: how pacman's short options read – the capital letter is the operation, the lowercase letters are
// modifiers – on the chapter's two examples, pacman -Syu and pacman -Rs. The meanings are the chapter's table's.
import { C, FS, MONO, PAD, TERM, W, esc, isRtl, label, perLanguage, svg, tag, textWidth, tr } from "./style.mjs";
import { famBadge, famBadgeWidth, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("pacman-options");

export const words = {
  arch: distroWords.arch,
  operation: { en: "operation", sv: "åtgärd", de: "Operation", fr: "opération", es: "operación", pt: "operação", ru: "операция", zh: "操作", ja: "操作", ar: "العملية", hi: "ऑपरेशन" },
  modifier: { en: "modifier", sv: "tillägg", de: "Modifikator", fr: "modificateur", es: "modificador", pt: "modificador", ru: "модификатор", zh: "修饰符", ja: "調整", ar: "معدِّل", hi: "modifier" },
  S: { en: "Sync – install from the repositories", sv: "Sync – installera från förråden", de: "Sync – aus den Repositorys installieren", fr: "Sync – installer depuis les dépôts", es: "Sync: instalar desde los repositorios", pt: "Sync – instala a partir dos repositórios", ru: "Sync – установить из репозиториев", zh: "Sync（同步）——从软件源安装", ja: "Sync – リポジトリからインストールする", ar: "Sync – التثبيت من المستودعات", hi: "Sync – रिपॉज़िटरी से इंस्टॉल करना" },
  y: { en: "Refresh the package database", sv: "Uppdatera paketdatabasen", de: "Die Paketdatenbank aktualisieren", fr: "Rafraîchir la base de données des paquets", es: "Refrescar la base de datos de paquetes", pt: "Atualiza o banco de dados de pacotes", ru: "Обновить базу данных пакетов", zh: "刷新软件包数据库", ja: "パッケージデータベースを更新する", ar: "تحديث قاعدة بيانات الحزم", hi: "पैकेज डेटाबेस ताज़ा करना" },
  u: { en: "Upgrade all packages", sv: "Uppgradera alla paket", de: "Alle Pakete aktualisieren", fr: "Mettre à jour tous les paquets", es: "Actualizar todos los paquetes", pt: "Atualiza todos os pacotes", ru: "Обновить все пакеты", zh: "升级所有软件包", ja: "すべてのパッケージをアップグレードする", ar: "ترقية كل الحزم", hi: "सारे पैकेज अपग्रेड करना" },
  R: { en: "Remove", sv: "Remove – ta bort", de: "Remove – entfernen", fr: "Remove – supprimer", es: "Remove: desinstalar", pt: "Remove – remover", ru: "Remove – удалить", zh: "Remove（删除）", ja: "Remove – 削除する", ar: "Remove – الإزالة", hi: "Remove – हटाना" },
  s: {
    en: "Also remove dependencies nothing else needs",
    sv: "Ta även bort beroenden som inget annat behöver",
    de: "Auch Abhängigkeiten entfernen, die nichts mehr braucht",
    fr: "Supprimer aussi les dépendances inutiles",
    es: "Eliminar también las dependencias que nadie necesita",
    pt: "Remove também as dependências que nada usa",
    ru: "Удалить и зависимости, которые больше не нужны",
    zh: "同时删除不再被其他软件需要的依赖",
    ja: "ほかに必要とされていない依存関係も削除する",
    ar: "إزالة الاعتماديات التي لا يحتاجها شيء آخر أيضًا",
    hi: "वे निर्भरताएँ भी हटाना जिनकी किसी को ज़रूरत नहीं",
  },
};

const BIG = 28; // the commands, larger than the rest
const ROW = 40;
const EXAMPLES = [
  { pre: "pacman -", letters: "Syu", post: "" },
  { pre: "pacman -", letters: "Rs", post: " htop" },
];
const STRIP_H = 50;
const blockH = (e) => STRIP_H + 14 + e.letters.length * ROW;
const TOP = PAD + 48;
export const height = TOP + EXAMPLES.reduce((h, e) => h + blockH(e) + 22, 0) - 22 + PAD;

const colorOf = (ch) => (ch === ch.toUpperCase() ? C.accent : C.accent2);

export function draw(v) {
  const rtl = isRtl(v);
  const fam = tr(v, words.arch);
  let s = famBadge(v, rtl ? W - PAD - famBadgeWidth(fam) : PAD, PAD + 14, "arch", fam);
  // The key: capital letters are operations (orange), lowercase ones modifiers (purple).
  const op = tr(v, words.operation), mod = tr(v, words.modifier);
  const keyW = (t) => textWidth(t, FS) + 28;
  const k1 = rtl ? PAD + keyW(mod) + 10 : W - PAD - keyW(op) - 10 - keyW(mod);
  const [first, second] = rtl ? [[mod, C.accent2], [op, C.accent]] : [[op, C.accent], [mod, C.accent2]];
  s += tag(v, rtl ? PAD : k1, PAD + 14, first[0], { color: first[1], stroke: first[1], fill: "#ffffff" });
  s += tag(v, rtl ? PAD + keyW(mod) + 10 : k1 + keyW(op) + 10, PAD + 14, second[0], { color: second[1], stroke: second[1], fill: "#ffffff" });
  let y = TOP;
  for (const e of EXAMPLES) {
    // The command, with each letter of the option in its colour.
    const text = e.pre + e.letters + e.post;
    const w = text.length * BIG * 0.6 + 32;
    const x = (W - w) / 2;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${STRIP_H}" rx="7" fill="${TERM.bg}"/>`;
    s += `<text x="${x + 16}" y="${y + STRIP_H / 2}" font-size="${BIG}" font-weight="500" fill="${TERM.text}" dominant-baseline="central" font-family="${MONO}" style="white-space:pre">${esc(e.pre)}` +
      [...e.letters].map((ch) => `<tspan fill="${ch === ch.toUpperCase() ? "#f0a35e" : "#b79cf0"}" font-weight="800">${ch}</tspan>`).join("") + `${esc(e.post)}</text>`;
    // One row per letter: the letter on a chip of its colour and what it does.
    [...e.letters].forEach((ch, i) => {
      const ry = y + STRIP_H + 14 + ROW / 2 + i * ROW;
      const cw = 34;
      const cx = rtl ? W - PAD - 30 - cw : PAD + 30;
      const color = colorOf(ch);
      s += `<rect x="${cx}" y="${ry - 15}" width="${cw}" height="30" rx="5" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>`;
      s += `<text x="${cx + cw / 2}" y="${ry}" font-size="${FS}" font-weight="800" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="${MONO}">${ch}</text>`;
      const tx = rtl ? cx - 14 : cx + cw + 14;
      s += label(v, tx, ry, tr(v, words[ch]), { weight: 600, fit: rtl ? tx - PAD - 4 : W - PAD - 4 - tx });
    });
    y += blockH(e) + 22;
  }
  return svg(height, s);
}
