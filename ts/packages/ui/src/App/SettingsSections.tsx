import { Languages, type ProductMeta } from "@codestead/common";
import type { ReactNode } from "react";
import { FontWeight, UiParts } from "./UiParts.js";

/** The parts of the settings dialog that every app has: language, theme and the version line. */
export const SettingsSections = {
  title: (text: string): ReactNode => UiParts.text(text, 21, FontWeight.Bold),

  heading: (text: string): ReactNode => UiParts.text(text, 15, FontWeight.SemiBold),

  /** One chip per offered language; `onPick` gets the chosen code. */
  languages(current: string, onPick: (code: string) => void, minWidth = 120): ReactNode {
    return (
      <div className="cs-wrap">
        {Languages.offered.map((l) => (
          <button key={l.code} type="button" className={"chip" + (l.code === current ? " active" : "")} style={{ margin: "0 8px 8px 0", minWidth }} onClick={() => onPick(l.code)}>
            {l.name}
          </button>
        ))}
      </div>
    );
  },

  /** System / light / dark; `onPick` gets null, "light" or "dark". */
  theme(current: string | null, system: string, light: string, dark: string, onPick: (theme: string | null) => void): ReactNode {
    const options: [string | null, string][] = [
      [null, system],
      ["light", light],
      ["dark", dark],
    ];
    return (
      <div className="cs-row" style={{ gap: 8 }}>
        {options.map(([value, label]) => (
          <button key={label} type="button" className={"chip" + (current === value ? " active" : "")} onClick={() => onPick(value)}>
            {label}
          </button>
        ))}
      </div>
    );
  },

  /** The primary close button at the end of the dialog. */
  close(label: string, onClose: () => void): ReactNode {
    return (
      <button type="button" className="primary" style={{ alignSelf: "flex-end", marginTop: 8 }} onClick={onClose}>
        {label}
      </button>
    );
  },

  /** "Name 1.2.3", and a "What's new" button when there is a changelog. */
  version(product: ProductMeta, whatsNewLabel?: string, onWhatsNew?: () => void): ReactNode {
    return (
      <div className="cs-row" style={{ gap: 10 }}>
        {UiParts.text(`${product.name} ${product.version}`, 11.5, undefined, "muted")}
        {whatsNewLabel !== undefined && onWhatsNew !== undefined && (
          <button type="button" className="secondary" style={{ padding: "2px 8px", fontSize: 11.5 }} onClick={onWhatsNew}>
            {whatsNewLabel}
          </button>
        )}
      </div>
    );
  },
};
