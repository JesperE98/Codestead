// The Debian family: apt update and apt upgrade are different things. update only downloads the list of which versions
// the repository has; upgrade installs the new versions of what you already have. The versions are the simulator's
// (bash can be upgraded on its Ubuntu).
import { C, FS, MONO, PAD, W, arrow, box, esc, file, isRtl, label, perLanguage, svg, tr } from "./style.mjs";
import { cmd, computer, famBadge, famBadgeWidth, server, words as distroWords } from "./_distro.mjs";

export const variants = perLanguage("apt-update-upgrade");

export const words = {
  debian: distroWords.debian,
  repository: { en: "Repository", sv: "Förråd", de: "Repository", fr: "Dépôt", es: "Repositorio", pt: "Repositório", ru: "Репозиторий", zh: "软件源", ja: "リポジトリ", ar: "المستودع", hi: "रिपॉज़िटरी" },
  list: { en: "Package list", sv: "Paketlistan", de: "Paketliste", fr: "Liste des paquets", es: "Lista de paquetes", pt: "Lista de pacotes", ru: "Список пакетов", zh: "软件包列表", ja: "パッケージ一覧", ar: "قائمة الحزم", hi: "पैकेज सूची" },
  installed: { en: "Installed", sv: "Installerat", de: "Installiert", fr: "Installé", es: "Instalado", pt: "Instalado", ru: "Установлено", zh: "已安装", ja: "インストール済み", ar: "المثبَّت", hi: "इंस्टॉल हुआ" },
  updateDoes: { en: "only the list – installs nothing", sv: "bara listan – installerar inget", de: "nur die Liste – installiert nichts", fr: "la liste seulement – n'installe rien", es: "solo la lista – no instala nada", pt: "só a lista – não instala nada", ru: "только список, без установки", zh: "只有列表——不安装任何东西", ja: "一覧だけ – 何もインストールしない", ar: "القائمة فقط – لا يثبّت شيئًا", hi: "सिर्फ़ सूची – कुछ इंस्टॉल नहीं होता" },
  upgradeDoes: { en: "installs the new versions", sv: "installerar de nya versionerna", de: "installiert die neuen Versionen", fr: "installe les nouvelles versions", es: "instala las versiones nuevas", pt: "instala as versões novas", ru: "устанавливает новые версии", zh: "安装新版本", ja: "新しいバージョンをインストール", ar: "يثبّت الإصدارات الجديدة", hi: "नए संस्करण इंस्टॉल करता है" },
};

const PKGS = [["bash", "5.2.21-2ubuntu4", "5.2.21-2ubuntu4.1"]];
const ROWH = 82, GAPH = 56;
const TOP = PAD + 44; // under the family badge
export const height = TOP + 3 * ROWH + 2 * GAPH + PAD;

/** A row of mono runs [[text, colour, weight?]] starting at x. */
function runs(x, y, parts) {
  return `<text x="${x}" y="${y}" font-size="${FS}" font-weight="500" dominant-baseline="central" font-family="${MONO}" direction="ltr" style="white-space:pre">` +
    parts.map(([t, color, weight]) => `<tspan fill="${color}"${weight ? ` font-weight="${weight}"` : ""}>${esc(t)}</tspan>`).join("") + `</text>`;
}

export function draw(v) {
  const rtl = isRtl(v);
  const fam = tr(v, words.debian);
  let s = famBadge(v, rtl ? W - PAD - famBadgeWidth(fam) : PAD, PAD + 14, "debian", fam);
  const iconX = rtl ? W - PAD - 52 : PAD + 8; // the icons' left edge
  const nameX = rtl ? W - PAD - 70 : PAD + 70;
  const contentX = rtl ? W - PAD - 70 - 456 : PAD + 70; // the versions, under the names
  const rowY = (i) => TOP + i * (ROWH + GAPH);
  const station = (i, icon, name, style) => {
    const y = rowY(i);
    return box(PAD, y, W - 2 * PAD, ROWH, { style, fill: style ? undefined : "#ffffff" }) + icon(y) +
      label(v, nameX, y + 24, tr(v, words[name]), { weight: 700, size: 21, fit: W - 2 * PAD - 90 });
  };
  // 1. The repository: the new versions.
  s += station(0, (y) => server(iconX, y + 18, 44, 46), "repository");
  PKGS.forEach(([name, , next], j) => (s += runs(contentX, rowY(0) + 56 + j * 28, [[name.padEnd(5), C.ink, 700], [next, C.ink]])));
  // 2. The package list on your computer: now it knows the new versions.
  s += station(1, (y) => file(iconX + 8, y + 20, { scale: 1.8 }) + `<path d="M${iconX + 14},${y + 38} h16 M${iconX + 14},${y + 45} h16 M${iconX + 14},${y + 52} h16" stroke="${C.line}" stroke-width="1.6"/>`, "list", "accent2");
  PKGS.forEach(([name, , next], j) => (s += runs(contentX, rowY(1) + 56 + j * 28, [[name.padEnd(5), C.ink, 700], [next, C.accent2, 650]])));
  // 3. What is installed: the old version, replaced by the new one only by upgrade.
  s += station(2, (y) => computer(iconX + 2, y + 21, 40, 28), "installed", "accent");
  PKGS.forEach(([name, old, next], j) => (s += runs(contentX, rowY(2) + 56 + j * 28, [[name.padEnd(5), C.ink, 700], [old, C.muted], [" → ", C.ink], [next, C.accent, 650]])));
  // The commands between the stations, each with what it does.
  const steps = [["sudo apt update", "updateDoes", C.accent2], ["sudo apt upgrade", "upgradeDoes", C.accent]];
  steps.forEach(([command, does, color], i) => {
    const y0 = rowY(i) + ROWH, y1 = rowY(i + 1);
    const ax = iconX + 22, my = (y0 + y1) / 2;
    s += arrow(ax, y0 + 4, ax, y1 - 4, { color, width: 2.5 });
    const c = cmd(rtl ? ax - 22 : ax + 22, my, command, { anchor: rtl ? "end" : "start" });
    s += c.svg;
    const dx = rtl ? c.x - 14 : c.x + c.w + 14;
    s += label(v, dx, my, tr(v, words[does]), { color, weight: 600, fit: rtl ? dx - PAD - 4 : W - PAD - 4 - dx });
  });
  return svg(height, s);
}
