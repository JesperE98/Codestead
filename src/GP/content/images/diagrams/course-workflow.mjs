// Setting up your IDE, "How you work in this course": the loop between the app and the student's IDE – read the task,
// write the code, build and run, compare the window with the expected result, tick the task (or let Check my code
// read the files and tick it). The app's buttons have their names from the app's language files.
import { C, PAD, W, arrow, arrowPath, badge, box, perLanguage, svg, t, text } from "./style.mjs";

export const variants = perLanguage("course-workflow");
export const height = 300;

export function draw(v) {
  let s = "";
  const ax = PAD, aw = 270, ix = W - PAD - 270, iw = 270, top = PAD;
  const card = (x, w, title) =>
    `<rect x="${x}" y="${top}" width="${w}" height="${height - 2 * PAD}" rx="8" fill="#fff" fill-opacity="0.6" stroke="${C.line}" stroke-width="1.5"/>` +
    text(x + 14, top + 20, title, { weight: 700, size: 15 });
  s += card(ax, aw, "Codestead GP");
  s += card(ix, iw, t(v, "Your IDE", "Din IDE"));
  const bx = (x) => x + 16, bw = aw - 32, bh = 40;
  const ys = [56, 116, 176, 222];
  // The app.
  s += box(bx(ax), ys[0], bw, bh, { label: t(v, "The text and the task", "Texten och uppgiften"), size: 13 });
  s += box(bx(ax), ys[1], bw, bh, { label: t(v, "Expected result", "Förväntat resultat"), sub: t(v, "a picture for every task", "en bild för varje uppgift"), size: 13, style: "accent2" });
  s += box(bx(ax), ys[2], bw, 34, { label: t(v, "Mark as done", "Markera som klar"), size: 13, style: "accent" });
  s += box(bx(ax), ys[3], bw, 34, { label: t(v, "Check my code", "Kontrollera min kod"), size: 13, style: "accent" });
  // The IDE.
  s += box(bx(ix), ys[0], bw, bh, { label: t(v, "Write the code", "Skriv koden"), sub: "main.cpp, shaders", subMono: true, size: 13 });
  s += box(bx(ix), ys[1], bw, bh, { label: t(v, "Build and run", "Bygg och kör"), size: 13 });
  s += box(bx(ix), ys[2], bw, 34, { label: t(v, "Your window", "Ditt fönster"), size: 13, style: "accent2" });
  // The loop.
  const mid = (y, h = bh) => y + h / 2;
  const gapL = ax + aw, gapR = ix;
  s += arrow(bx(ax) + bw + 4, mid(ys[0]), bx(ix) - 4, mid(ys[0]), { color: C.ink, width: 2 });
  s += badge((gapL + gapR) / 2, mid(ys[0]) - 14, 1);
  s += arrow(bx(ix) + bw / 2, ys[0] + bh + 3, bx(ix) + bw / 2, ys[1] - 3, { color: C.ink, width: 2 });
  s += badge(bx(ix) + bw / 2 + 18, (ys[0] + bh + ys[1]) / 2, 2);
  s += arrow(bx(ix) + bw / 2, ys[1] + bh + 3, bx(ix) + bw / 2, ys[2] - 3, { color: C.ink, width: 2 });
  // Compare the window with the expected result.
  s += arrowPath(`M${bx(ix) - 4},${mid(ys[2], 34)} C${gapR - 40},${mid(ys[2], 34)} ${gapL + 40},${mid(ys[1])} ${bx(ax) + bw + 4},${mid(ys[1])}`, bx(ax) + bw + 4, mid(ys[1]), -1, 0, { color: C.accent2, width: 2, dash: "6 4" });
  s += badge(gapL + 30, mid(ys[1]) - 20, 3, { color: C.accent2 });
  s += text(gapL + 44, mid(ys[1]) - 20, t(v, "compare", "jämför"), { size: 12, color: C.accent2, weight: 600 });
  // Tick the task – or let the app read the files.
  s += arrow(bx(ax) + bw / 2, ys[1] + bh + 3, bx(ax) + bw / 2, ys[2] - 3, { color: C.ink, width: 2 });
  s += badge(bx(ax) + bw / 2 + 18, (ys[1] + bh + ys[2]) / 2, 4);
  s += arrowPath(`M${bx(ix) + 10},${ys[0] + bh} C${bx(ix) - 30},${ys[3] + 10} ${gapL + 70},${mid(ys[3], 34)} ${bx(ax) + bw + 4},${mid(ys[3], 34)}`, bx(ax) + bw + 4, mid(ys[3], 34), -1, 0, { color: C.muted, width: 1.5, dash: "4 4" });
  s += text((gapL + gapR) / 2 + 6, mid(ys[3], 34) + 14, t(v, "reads your files", "läser dina filer"), { anchor: "middle", size: 12, color: C.muted });
  // Next task.
  s += arrowPath(`M${bx(ax) - 2},${mid(ys[2], 34)} C${ax + 2},${mid(ys[2], 34)} ${ax + 2},${mid(ys[0])} ${bx(ax) - 2},${mid(ys[0])}`, bx(ax) - 2, mid(ys[0]), 1, 0, { color: C.line, width: 1.5 });
  return svg(height, s);
}
