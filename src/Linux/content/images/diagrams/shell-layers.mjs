// Welcome: what the terminal, the shell, the kernel and the hardware each do, and that a distribution is all of the
// software together. The terminal shows the chapter's first command, run by the simulator.
import { C, FS_TITLE, PAD, W, arrow, box, isRtl, label, perLanguage, startX, svg, tag, terminal, tr } from "./style.mjs";

export const variants = perLanguage("shell-layers");

export const words = {
  terminal: { en: "Terminal", sv: "Terminal", de: "Terminal", fr: "Terminal", es: "Terminal", pt: "Terminal", ru: "Терминал", zh: "终端", ja: "ターミナル", ar: "الطرفية", hi: "Terminal" },
  terminalDo: {
    en: "the window that shows the text",
    sv: "fönstret som visar texten",
    de: "das Fenster, das den Text anzeigt",
    fr: "la fenêtre qui affiche le texte",
    es: "la ventana que muestra el texto",
    pt: "a janela que mostra o texto",
    ru: "окно, которое показывает текст",
    zh: "显示文字的窗口",
    ja: "文字を表示するウィンドウ",
    ar: "النافذة التي تعرض النص",
    hi: "वह window जो text दिखाती है",
  },
  shell: { en: "Shell (bash)", sv: "Skal (bash)", de: "Shell (bash)", fr: "Shell (bash)", es: "Shell (bash)", pt: "Shell (bash)", ru: "Shell (bash)", zh: "shell（bash）", ja: "シェル（bash）", ar: "الـ shell (bash)", hi: "Shell (bash)" },
  shellDo: {
    en: "reads your commands and runs them",
    sv: "läser dina kommandon och kör dem",
    de: "liest deine Befehle und führt sie aus",
    fr: "lit vos commandes et les exécute",
    es: "lee tus comandos y los ejecuta",
    pt: "lê os seus comandos e os executa",
    ru: "читает ваши команды и выполняет их",
    zh: "读取你的命令并执行",
    ja: "入力したコマンドを読み取って実行する",
    ar: "يقرأ أوامرك وينفّذها",
    hi: "आपके commands पढ़ता है और उन्हें चलाता है",
  },
  kernel: { en: "Kernel (Linux)", sv: "Kärnan (Linux)", de: "Kernel (Linux)", fr: "Noyau (Linux)", es: "Kernel (Linux)", pt: "Kernel (Linux)", ru: "Ядро (Linux)", zh: "内核（Linux）", ja: "カーネル（Linux）", ar: "النواة (Linux)", hi: "Kernel (Linux)" },
  kernelDo: {
    en: "lets programs share processor, memory and disks",
    sv: "låter program dela på processor, minne och diskar",
    de: "lässt Programme Prozessor, Speicher und Platten teilen",
    fr: "partage processeur, mémoire et disques entre les programmes",
    es: "reparte procesador, memoria y discos entre los programas",
    pt: "divide processador, memória e discos entre os programas",
    ru: "делит процессор, память и диски между программами",
    zh: "让程序共享处理器、内存和磁盘",
    ja: "プロセッサ・メモリ・ディスクをプログラムで共有させる",
    ar: "تتيح للبرامج أن تتقاسم المعالج والذاكرة والأقراص",
    hi: "programs को processor, memory और disks बाँटने देता है",
  },
  hardware: { en: "Hardware", sv: "Hårdvara", de: "Hardware", fr: "Matériel", es: "Hardware", pt: "Hardware", ru: "Железо", zh: "硬件", ja: "ハードウェア", ar: "العتاد", hi: "Hardware" },
  distro: {
    en: "Distribution (here Ubuntu 24.04 LTS)",
    sv: "Distribution (här Ubuntu 24.04 LTS)",
    de: "Distribution (hier Ubuntu 24.04 LTS)",
    fr: "Distribution (ici Ubuntu 24.04 LTS)",
    es: "Distribución (aquí Ubuntu 24.04 LTS)",
    pt: "Distribuição (aqui Ubuntu 24.04 LTS)",
    ru: "Дистрибутив (здесь Ubuntu 24.04 LTS)",
    zh: "发行版（这里是 Ubuntu 24.04 LTS）",
    ja: "ディストリビューション（ここでは Ubuntu 24.04 LTS）",
    ar: "التوزيعة (هنا Ubuntu 24.04 LTS)",
    hi: "Distribution (यहाँ Ubuntu 24.04 LTS)",
  },
};

export const terminals = { hello: { commands: ["echo {{helloWorld}}"] } };

const X0 = PAD + 16, X1 = W - PAD - 16; // the layers, inside the distribution's frame
const TOP = 56; // the terminal layer's top
const termBox = 162, layer = 70, gap = 34;

export const height = TOP + termBox + gap + layer + gap + layer + 18 + 40 + layer - 6 + PAD;

/** A layer: its title and what it does, on two lines at the start side. */
function layerBox(v, y, h, name, does, style = "plain") {
  const x = startX(v, X0 + 18, X1 - 18);
  return box(X0, y, X1 - X0, h, { style }) +
    label(v, x, does ? y + 24 : y + h / 2, tr(v, words[name]), { size: FS_TITLE, weight: 700 }) +
    (does ? label(v, x, y + 51, tr(v, words[does]), { color: C.muted, fit: X1 - X0 - 36 }) : "");
}

export function draw(v, R) {
  let s = "";
  // The distribution: everything but the hardware.
  const frameBottom = TOP + termBox + gap + layer + gap + layer + 18;
  s += `<rect x="${PAD}" y="${TOP - 26}" width="${W - 2 * PAD}" height="${frameBottom - TOP + 26}" rx="10" fill="${C.accent2Soft}" fill-opacity="0.45" stroke="${C.accent2}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  const distro = tr(v, words.distro);
  s += tag(v, isRtl(v) ? W - PAD - 24 : PAD + 24, TOP - 26, distro, { anchor: isRtl(v) ? "end" : "start", color: C.accent2, stroke: C.accent2 });

  // 1. The terminal, with the chapter's first command in it.
  let y = TOP + 8;
  s += layerBox(v, y, termBox, "terminal", "terminalDo");
  const t = terminal(X0 + 18, y + 72, X1 - X0 - 36, R.hello.lines);
  s += t.svg;
  // 2.–4. The shell, the kernel and the hardware, one below the other: the command goes down through them.
  const arrowX = W / 2;
  y += termBox;
  s += arrow(arrowX, y + 4, arrowX, y + gap - 4, { color: C.accent, width: 2.5 });
  y += gap;
  s += layerBox(v, y, layer, "shell", "shellDo", "accent");
  y += layer;
  s += arrow(arrowX, y + 4, arrowX, y + gap - 4, { color: C.accent, width: 2.5 });
  y += gap;
  s += layerBox(v, y, layer, "kernel", "kernelDo");
  y += layer + 18 + 40;
  s += arrow(arrowX, y - 36, arrowX, y - 4, { color: C.accent, width: 2.5 });
  s += layerBox(v, y, layer - 6, "hardware", null, "muted");
  return svg(height, s);
}
