// Text Rendering, GL_UNPACK_ALIGNMENT: the 'A' of the course's font at 48 pixels is 34 pixels wide, so its bitmap has
// rows of 34 bytes. Read with the default unpack alignment of 4, OpenGL expects every row to start at a multiple of 4
// bytes – 36 – and each row starts 2 bytes further into the data than it should: the glyph is sheared, and the last
// rows read past the end of the bitmap (drawn empty here). With an alignment of 1 the rows are read as they are.
import { C, PAD, W, perLanguage, svg, t } from "./style.mjs";
import { code, glyph, label, pixelImage, pngUrl } from "./_practice.mjs";

export const variants = perLanguage("unpack-alignment");
const K = 6;
export const height = PAD + 40 + 35 * K + 50 + PAD;

function rows(g, stride) {
  const w = g.width, h = g.rows;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * stride + x; // where OpenGL reads texel (x, y) from
      const a = i < w * h ? g.bitmap[Math.floor(i / w) * g.pitch + (i % w)] : 0;
      const p = (y * w + x) * 4;
      px[p] = 31; px[p + 1] = 36; px[p + 2] = 48; px[p + 3] = a;
    }
  return pngUrl(w, h, px);
}

export function draw(v) {
  const g = glyph(48, "A");
  const gw = g.width * K, gh = g.rows * K;
  const cols = [
    { x: W / 4, stride: g.width, title: "`GL_UNPACK_ALIGNMENT` 1", sub: t(v, `rows of ${g.width} bytes`, `rader om ${g.width} byte`), color: C.good },
    { x: (3 * W) / 4, stride: Math.ceil(g.width / 4) * 4, title: "`GL_UNPACK_ALIGNMENT` 4", sub: t(v, "rows read 36 bytes apart", "raderna läses 36 byte isär"), color: C.bad },
  ];
  let s = "";
  for (const c of cols) {
    const x = c.x - gw / 2, y = PAD + 40;
    s += code(c.x, PAD + 14, c.title, { anchor: "middle", weight: 600, color: c.color });
    s += `<rect x="${x - 8}" y="${y - 8}" width="${gw + 16}" height="${gh + 16}" rx="6" fill="#fff" stroke="${C.boxStroke}"/>`;
    s += pixelImage(rows(g, c.stride), x, y, gw, gh);
    s += label(c.x, y + gh + 34, c.sub, { anchor: "middle", weight: 500, color: C.muted, fit: W / 2 - 16 });
  }
  return svg(height, s);
}
