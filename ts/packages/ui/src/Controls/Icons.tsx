import type { ReactNode } from "react";

// Simple line icons drawn in the text colour of the button they sit in, for the places where a colour
// emoji would stand out too much (the settings and achievements entries in the menus).

const n = (v: number) => String(Math.round(v * 100) / 100);

/** A gear: eight teeth around a ring (24 × 24). */
const gearPath = (() => {
  const cx = 12;
  const cy = 12;
  const outer = 10;
  const root = 7.4;
  let d = "";
  for (let i = 0; i < 8; i++) {
    const a = i * 45;
    for (const [deg, r] of [
      [a - 15, root],
      [a - 8, outer],
      [a + 8, outer],
      [a + 15, root],
    ] as const) {
      const rad = (deg * Math.PI) / 180;
      d += (d.length === 0 ? "M" : " L") + n(cx + r * Math.cos(rad)) + "," + n(cy + r * Math.sin(rad));
    }
  }
  return d + " Z M15,12 A3,3 0 1 1 9,12 A3,3 0 1 1 15,12 Z";
})();

/** A trophy: cup with handles, stem and base (24 × 24). */
const trophyPath =
  "M7,4 L17,4 L17,9 A5,5 0 0 1 7,9 Z " +
  "M7,5.5 L4.5,5.5 A2.6,2.6 0 0 0 7.6,11 " +
  "M17,5.5 L19.5,5.5 A2.6,2.6 0 0 1 16.4,11 " +
  "M12,14 L12,17 " +
  "M9,17 L15,17 L15,20 L9,20 Z";

function draw(d: string, size: number): ReactNode {
  // The same colour as the text around it.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const Icons = {
  gear: (size = 16): ReactNode => draw(gearPath, size),

  trophy: (size = 16): ReactNode => draw(trophyPath, size),

  /** An icon followed by a text, for a menu entry. */
  label: (icon: ReactNode, text: string, spacing = 9): ReactNode => (
    <span className="cs-icon-label" style={{ gap: spacing }}>
      {icon}
      <span>{text}</span>
    </span>
  ),
};
