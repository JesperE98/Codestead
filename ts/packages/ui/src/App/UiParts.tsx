import type { CSSProperties, ReactNode } from "react";

/** Small building blocks the windows of every app use. */
export const UiParts = {
  /** A wrapping text with a size, an optional weight and an optional style class ("muted", "eyebrow" …). */
  text(text: ReactNode, size = 14, weight?: number, cls?: string, style?: CSSProperties): ReactNode {
    return (
      <div className={"cs-text" + (cls ? " " + cls : "")} style={{ fontSize: size, fontWeight: weight, ...style }}>
        {text}
      </div>
    );
  },
};

/** Font weights by their Avalonia names. */
export const FontWeight = { Normal: 400, SemiBold: 600, Bold: 700 } as const;
