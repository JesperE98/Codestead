// Other shells: the #! line decides which shell runs a script. In fish, the chapter's bash script (name=Kim is not
// allowed in fish) still works: fish only starts the file, the #!/bin/bash line makes bash run it. The terminal is the
// simulator's; the script is the chapter's own, read from the chapter text of each language.
import { readFileSync } from "node:fs";
import { C, FS, PAD, W, arrow, arrowPath, box, code, fill, isRtl, label, perLanguage, svg, terminal, textWidth, tr, world } from "./style.mjs";

export const variants = perLanguage("shebang");

export const words = {
  starts: { en: "starts it", sv: "startar det", de: "startet es", fr: "le lance", es: "lo inicia", pt: "o inicia", ru: "запускает", zh: "启动它", ja: "起動する", ar: "يشغّله", hi: "start करता है" },
  runs: { en: "runs it", sv: "kör det", de: "führt es aus", fr: "l'exécute", es: "lo ejecuta", pt: "o executa", ru: "выполняет", zh: "执行它", ja: "実行する", ar: "ينفّذه", hi: "चलाता है" },
};

/** The script of the chapter "Other shells" in a language: the lines of its heredoc (placeholders filled in). */
function script(v) {
  const md = readFileSync(new URL(`../../chapters/${v.lang}/skal.md`, import.meta.url), "utf8");
  const m = /cat > ~\/\{\{helloScript\}\} << '\{\{heredocEnd\}\}'\n([\s\S]*?)\n\{\{heredocEnd\}\}\n/.exec(md);
  if (m === null) throw new Error(`no hello script in ${v.lang}/skal.md`);
  return m[1].split("\n").map((l) => fill(v, l));
}

export function terminals(v) {
  const quoted = script(v).map((l) => `'${l}'`).join(" ");
  return {
    run: {
      setup: [`printf '%s\\n' ${quoted} > ~/{{helloScript}}`, "chmod +x ~/{{helloScript}}", "sudo apt update", "sudo apt install -y fish", "fish"],
      commands: ["~/{{helloScript}}"],
    },
  };
}

const LH = 30; // a script line
const SH_W = 190, SH_H = 54; // the shells' boxes
const scriptTop = (R) => PAD + terminal(0, 0, W, R.run.lines).height + 22 + SH_H + 34;
export const height = (v, R) => scriptTop(R) + 44 + 3 * LH + 10 + PAD;

export function draw(v, R) {
  const rtl = isRtl(v);
  const lines = script(v);
  const t = terminal(PAD, PAD, W - 2 * PAD, R.run.lines);
  let s = t.svg;
  // The shells: fish (where you are) at the start side, bash at the end side.
  const shY = PAD + t.height + 22;
  const fishX = rtl ? W - PAD - SH_W : PAD, bashX = rtl ? PAD : W - PAD - SH_W;
  const shellBox = (x, sh, word, style, color) =>
    box(x, shY, SH_W, SH_H, { style }) + code(x + SH_W / 2, shY + 17, sh, { anchor: "middle", weight: 700, color }) +
    label(v, x + SH_W / 2, shY + 40, tr(v, words[word]), { anchor: "middle", size: FS, weight: 600, color: C.muted, fit: SH_W - 12 });
  s += shellBox(fishX, "fish", "starts", "accent2", C.accent2);
  s += shellBox(bashX, "bash", "runs", "z", C.z);
  // The script under them: its name and its lines, the #! line marked.
  const name = `~/${world(v.lang).names.helloScript}`;
  const pw = Math.min(W - 2 * PAD, Math.max(...lines.map((l) => textWidth(l, FS, true))) + 32);
  const py = scriptTop(R);
  const ph = 44 + 3 * LH + 10;
  const px = rtl ? W - PAD - pw : PAD;
  s += box(px, py, pw, ph, { fill: "#ffffff" });
  s += code(px + 16, py + 22, name, { weight: 700, color: C.muted });
  s += `<line x1="${px}" y1="${py + 42}" x2="${px + pw}" y2="${py + 42}" stroke="${C.grid}"/>`;
  const ly = (i) => py + 44 + 4 + i * LH + LH / 2;
  const hashW = textWidth(lines[0], FS, true) + 16;
  s += `<rect x="${px + 8}" y="${ly(0) - 14}" width="${hashW}" height="28" rx="5" fill="${C.z}" fill-opacity="0.16" stroke="${C.z}" stroke-width="1.5"/>`;
  lines.forEach((l, i) => (s += code(px + 16, ly(i), l, { weight: i === 0 ? 700 : 500, color: i === 0 ? C.z : C.ink, fit: pw - 24 })));
  // fish starts the file: down from fish into the script.
  const fx = fishX + SH_W / 2;
  s += arrow(fx, shY + SH_H + 3, fx, py - 3, { color: C.accent2, width: 2.5 });
  // The #! line hands it to bash: from the line up to bash.
  const bx = bashX + SH_W / 2;
  const hx = rtl ? px + 8 : px + 8 + hashW; // the #! mark's end towards bash
  const hy = ly(0);
  const turnX = rtl ? Math.min(bx, hx - 30) : Math.max(bx, hx + 30);
  s += arrowPath(`M${hx},${hy} H${turnX} V${shY + SH_H + 3}`, turnX, shY + SH_H + 3, 0, -1, { color: C.z, width: 2.5 });
  // bash's output is what the terminal shows.
  const ox = rtl ? bashX + 24 : bashX + SH_W - 24;
  s += arrowPath(`M${ox},${shY} V${PAD + t.height + 4}`, ox, PAD + t.height + 4, 0, -1, { color: C.z, width: 1.5, dash: "4 3" });
  s += `<rect x="${t.colX(0) - 4}" y="${t.rowY(1) - 13}" width="${textWidth(rowText(R, 1), FS, true) + 8}" height="26" rx="4" fill="none" stroke="#7aa2f7" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  return svg(height(v, R), s);
}

const rowText = (R, i) => {
  const rows = [];
  for (const l of R.run.lines) rows.push(l.prompt.map((r) => r.text).join("") + l.typed, ...l.output.map((r) => r.map((x) => x.text).join("")));
  return rows[i];
};
