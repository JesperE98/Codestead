/**
 * The saved files' JSON rules, so the TypeScript and C# apps read each other's files: camelCase property names,
 * dictionary keys as they are, nulls left out (C#'s JsonDefaults). JSON.stringify leaves out undefined; this also
 * leaves out null.
 */
export function toSavedJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v === null ? undefined : v));
}
