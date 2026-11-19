// A hemisphere drawn in a slightly tilted view (not a picture itself): for the PBR pictures.
import { C } from "./style.mjs";

export const variants = [];
export const height = 0;
export const draw = () => "";

/** The view: x to the right, y up (the normal), z towards the viewer; tilted so the base circle is an ellipse. */
export function view(ox, oy, R, tilt = 18) {
  const a = (tilt * Math.PI) / 180;
  const P = (x, y, z) => [ox + x * R, oy - (y * Math.cos(a) - z * Math.sin(a)) * R];
  const depth = (x, y, z) => y * Math.sin(a) + z * Math.cos(a); // > 0: in front
  return { P, depth, R, a };
}

/** The hemisphere's outline: the base ellipse (back half dashed) and the dome's silhouette. */
export function hemisphere(vw, o = {}) {
  const { P, R, a } = vw;
  const [cx, cy] = P(0, 0, 0);
  const ry = R * Math.sin(a);
  const fill = o.fill ?? C.accentSoft;
  let s = `<path d="M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy} A${R},${ry} 0 0 1 ${cx - R},${cy} Z" fill="${fill}" fill-opacity="${o.opacity ?? 0.55}"/>`;
  s += `<path d="M${cx - R},${cy} A${R},${ry} 0 0 1 ${cx + R},${cy}" fill="none" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  s += `<path d="M${cx - R},${cy} A${R},${ry} 0 0 0 ${cx + R},${cy}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`;
  s += `<path d="M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}" fill="none" stroke="${o.stroke ?? C.accent}" stroke-width="2"/>`;
  return s;
}

/** A point on the unit hemisphere for the zenith angle θ (from the normal) and the azimuth φ. */
export const sph = (theta, phi) => [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
