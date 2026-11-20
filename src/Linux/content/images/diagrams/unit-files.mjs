// systemd: where the unit files live – the packages' in /usr/lib/systemd/system (not to be edited) and the
// administrator's own in /etc/systemd/system (they take precedence) – and what enable does there: a link in
// multi-user.target.wants, which systemd starts everything in at boot. The files are the simulator's.
// (After the question in the text: it shows the answer.)
import { C, PAD, W, arrowPath, isRtl, label, perLanguage, svg, tr, tree } from "./style.mjs";
import { strip } from "./_admin.mjs";

export const variants = perLanguage("unit-files");

export const words = {
  own: { en: "the administrator's own", sv: "administratörens egna", de: "die eigenen des Administrators", fr: "ceux de l'administrateur", es: "los propios del administrador", pt: "os do próprio administrador", ru: "собственные администратора", zh: "管理员自己的", ja: "管理者が自分で作るもの", ar: "الخاصة بالمدير", hi: "Administrator की अपनी" },
  precedence: { en: "they take precedence", sv: "har företräde", de: "sie haben Vorrang", fr: "ils ont la priorité", es: "tienen prioridad", pt: "eles têm prioridade", ru: "они имеют приоритет", zh: "优先级更高", ja: "こちらが優先される", ar: "ولها الأولوية", hi: "इन्हें प्राथमिकता मिलती है" },
  packages: { en: "from the packages", sv: "följer med paketen", de: "kommen mit den Paketen", fr: "fournis par les paquets", es: "vienen con los paquetes", pt: "vêm com os pacotes", ru: "поставляются с пакетами", zh: "随软件包一起安装", ja: "パッケージと一緒に入る", ar: "تأتي مع الحزم", hi: "Packages के साथ आती हैं" },
  noEdit: { en: "don't edit here!", sv: "ändra inte här!", de: "hier nichts ändern!", fr: "ne les modifiez pas ici !", es: "¡no los edites aquí!", pt: "não edite aqui!", ru: "здесь ничего не редактируйте!", zh: "不要在这里编辑！", ja: "ここは編集しないこと！", ar: "لا تعدّل هنا!", hi: "यहाँ edit मत कीजिए!" },
};

const ROW = 40;
const GAP = 34; // between the two directories
const ETC = [
  { name: "/etc/systemd/system", depth: 0, bold: true },
  { name: "multi-user.target.wants", depth: 1 },
  { name: "myserver.service", depth: 2, file: true, color: C.accent, edge: C.accent },
  { name: "ssh.service", depth: 2, file: true },
  { name: "myserver.service", depth: 1, file: true },
  { name: "reportd.service", depth: 1, file: true },
];
const USR = [
  { name: "/usr/lib/systemd/system", depth: 0, bold: true },
  { name: "cron.service", depth: 1, file: true },
  { name: "ssh.service", depth: 1, file: true },
  { name: "…", depth: 1, file: true },
];
const TX = PAD + 8;
const ETC_Y = PAD + 4;
const USR_Y = ETC_Y + ETC.length * ROW + GAP;
export const height = USR_Y + USR.length * ROW + PAD;

/** Two lines about a directory, beside it: what it is (bold) and what that means. */
function about(v, y, first, second, color) {
  const rtl = isRtl(v);
  const x = rtl ? W - PAD - 6 : 396;
  return label(v, x, y, tr(v, words[first]), { weight: 700, color, fit: W - PAD - 402 }) +
    label(v, x, y + 25, tr(v, words[second]), { color: C.muted, weight: 600, fit: W - PAD - 402 });
}

export function draw(v) {
  let s = "";
  // The two directories, each a band in its colour behind its tree.
  s += `<rect x="${PAD - 6 + 6}" y="${ETC_Y - 4}" width="${W - 2 * PAD}" height="${ETC.length * ROW + 8}" rx="8" fill="${C.accentSoft}" fill-opacity="0.45" stroke="${C.accent}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  s += `<rect x="${PAD}" y="${USR_Y - 4}" width="${W - 2 * PAD}" height="${USR.length * ROW + 8}" rx="8" fill="${C.card}" stroke="${C.line}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  const etc = tree(TX, ETC_Y, ETC, { row: ROW });
  const usr = tree(TX, USR_Y, USR, { row: ROW });
  s += etc.svg + usr.svg;
  // enable: the link in multi-user.target.wants that points at the unit file.
  const link = etc.rows[2], target = etc.rows[4];
  const lane = link.end + 22;
  s += arrowPath(`M${link.end + 4},${link.y} H${lane - 10} Q${lane},${link.y} ${lane},${link.y + 10} V${target.y - 10} Q${lane},${target.y} ${lane - 10},${target.y} H${target.end + 6}`, target.end + 6, target.y, -1, 0, { color: C.accent, width: 2.5 });
  const st = strip(lane + 16, link.y, "systemctl enable myserver", { color: "#ffb77a" });
  s += st.svg;
  // What each directory is.
  s += about(v, etc.rows[4].y + 6, "own", "precedence", C.accent);
  s += about(v, usr.rows[1].y + 8, "packages", "noEdit", C.ink);
  return svg(height, s);
}
