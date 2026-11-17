// The accent colours of the Codestead tools (C#'s Themes/Brand.cs and BrandShade.cs).

/**
 * A tool's own accent colour, in the light and the dark theme (see "Färgsystemet" in docs/DEVELOPMENT.md).
 * Colours are "#rrggbb".
 */
export interface BrandShade {
  /** Primary buttons, the current item, focus. */
  accent: string;
  /** A light background in the same colour (selected items). */
  accentSoft: string;
  /** Text on `accent` – it must be easy to read. */
  onAccent: string;
}

/** The accent colours of the Codestead tools. Every tool has its own, so you can tell at a glance which one you are in. */
export class Brand {
  constructor(
    readonly name: string,
    readonly light: BrandShade,
    readonly dark: BrandShade,
  ) {}

  /** Codestead Linux: teal, like a terminal prompt. */
  static readonly Linux = new Brand("linux", { accent: "#0f766e", accentSoft: "#d4f2ee", onAccent: "#ffffff" }, { accent: "#2dd4bf", accentSoft: "#0f2f2b", onAccent: "#062420" });

  /** The hub: indigo. */
  static readonly Hub = new Brand("hub", { accent: "#4f46e5", accentSoft: "#e8e7fe", onAccent: "#ffffff" }, { accent: "#8b93fb", accentSoft: "#1e1f3d", onAccent: "#12132b" });

  /** Codestead GP: the orange of the first triangle (1.0, 0.5, 0.2) – in C# it is the GP app's own (App.GpBrand). */
  static readonly GP = new Brand("gp", { accent: "#c2410c", accentSoft: "#fde4d3", onAccent: "#ffffff" }, { accent: "#fb923c", accentSoft: "#3a1f10", onAccent: "#2a1205" });

  /**
   * The CSS that puts the colours over the theme's (codestead.css), in both themes – what ApplyTo does with an app's
   * resources in C#.
   */
  css(): string {
    const vars = (s: BrandShade) => `--cs-accent: ${s.accent}; --cs-accent-soft: ${s.accentSoft}; --cs-on-accent: ${s.onAccent};`;
    return [
      `:root, :root[data-theme="light"] { ${vars(this.light)} }`,
      `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(this.dark)} } }`,
      `:root[data-theme="dark"] { ${vars(this.dark)} }`,
    ].join("\n");
  }

  /** Puts the colours in the document (a &lt;style id="cs-brand"&gt; after the stylesheet). */
  applyTo(doc: Document = document): void {
    let style = doc.getElementById("cs-brand");
    if (!style) {
      style = doc.createElement("style");
      style.id = "cs-brand";
      doc.head.appendChild(style);
    }
    style.textContent = this.css();
  }
}
