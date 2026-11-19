// Gamma Correction, the start: the chapter's two rows of grey tones. Above, equal steps of the value sent to the monitor
// (0.0, 0.1 … 1.0), which look even; below, equal steps of light – each patch emits i/10 of white's light, so its value
// is (i/10)^(1/2.2) – which look as if they rush through the dark tones. (The picture's own pixels are what the monitor
// shows: the lower row's patches are encoded with 1/2.2.)
import { C, PAD, W, perLanguage, svg, t, text } from "./style.mjs";
import { S, label } from "./_advlight.mjs";

export const variants = perLanguage("gamma-ramps");

const N = 11, PW = (W - 2 * PAD) / N, PH = 58;
const ROW = 30 + PH + 46;
export const height = PAD + 2 * ROW + 4;

const grey = (v) => { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; };

export function draw(v) {
  let s = "";
  const rows = [
    [t(v, "Equal steps of the value sent to the monitor", "Lika steg i värdet som skickas till bildskärmen"), (x) => x],
    [t(v, "Equal steps of light (physically linear)", "Lika steg i ljus (fysikaliskt linjärt)"), (x) => Math.pow(x, 1 / 2.2)],
  ];
  rows.forEach(([name, value], j) => {
    const y = PAD + j * ROW;
    s += label(PAD, y + 10, name, { fit: W - 2 * PAD });
    for (let i = 0; i < N; i++) {
      const x = PAD + i * PW;
      s += `<rect x="${x}" y="${y + 28}" width="${PW + 0.5}" height="${PH}" fill="${grey(value(i / 10))}"/>`;
      s += text(x + PW / 2, y + 28 + PH + 16, (i / 10).toFixed(1), { size: S, anchor: "middle", color: C.muted });
    }
    s += `<rect x="${PAD}" y="${y + 28}" width="${W - 2 * PAD}" height="${PH}" rx="3" fill="none" stroke="${C.boxStroke}"/>`;
  });
  return svg(height, s);
}
