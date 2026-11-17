// The UI half of Codestead.Terminal/Ansi.cs (ToInlines): text with ANSI colour codes as React spans. The parsing and
// the palette are in @codestead/linux-shell (Ansi.parse, Ansi.foreground, …).

import { Ansi } from "@codestead/linux-shell";
import type { CSSProperties, ReactNode } from "react";

/** The terminal's text colour (C#'s TermText). */
export const TermText = "#e6edf3";

/** "#rrggbb" with an opacity, as C#'s new SolidColorBrush(color, opacity). */
function withOpacity(hex: string, opacity: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** The style of one segment. `defaultForeground` is used when no colour is set. */
export function segmentStyle(s: { fg: number; bg: number; bold: boolean; dim: boolean }, defaultForeground: string = TermText): CSSProperties {
  let color = defaultForeground;
  if (s.fg !== 0) {
    color = Ansi.foreground.get(s.fg >= 90 ? s.fg - 60 : s.fg)!;
    // Black text on a green background (sticky + world-writable dirs in ls).
    if (s.bg === 42 && s.fg === 30) color = Ansi.blackOnGreen;
  }
  const style: CSSProperties = { color: s.dim ? withOpacity(color, Ansi.dimOpacity) : color };
  const bg = s.bg !== 0 ? Ansi.background.get(s.bg) : undefined;
  if (bg !== undefined) style.backgroundColor = bg;
  if (s.bold) style.fontWeight = "bold";
  return style;
}

/** Creates runs (spans) for the text (C#'s Ansi.ToInlines). */
export function ansiRuns(text: string, defaultForeground: string = TermText): ReactNode[] {
  return Ansi.parse(text).map((s, i) => (
    <span key={i} style={segmentStyle(s, defaultForeground)}>
      {s.text}
    </span>
  ));
}
