const placeholder = /\{([A-Za-z0-9_]+)\}/g;

export type TextArgs = Readonly<Record<string, unknown>>;

/** How a value becomes text: numbers and the like in the invariant (English) form, as the C# apps do. */
function invariant(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

/** The {names} in a text. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(placeholder)].map((m) => m[1] ?? "");
}

/** Fills in {placeholders}; unknown ones stay as they are. */
export function fill(text: string, args?: TextArgs, format: (value: unknown) => string = invariant): string {
  if (!args || Object.keys(args).length === 0) return text;
  return text.replace(placeholder, (whole, name: string) => (Object.hasOwn(args, name) ? format(args[name]) : whole));
}

/**
 * The text of `key` in the first language of `chain` that has it (the key itself if none has), with its {placeholders}
 * filled from `args`. Unknown placeholders stay as they are.
 */
export function translate(
  texts: (lang: string) => Readonly<Record<string, string>> | undefined,
  chain: Iterable<string>,
  key: string,
  args?: TextArgs,
  format?: (value: unknown) => string,
): string {
  let text = key;
  for (const lang of chain) {
    const dict = texts(lang);
    if (dict && Object.hasOwn(dict, key)) {
      text = dict[key] ?? key;
      break;
    }
  }
  return fill(text, args, format);
}
