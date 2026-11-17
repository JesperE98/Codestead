// ToolStore.IsSafeId, in a module of its own so that the catalog (which the window also reads) does not pull in the
// store's file system code.

/** Ids become folder names: lower-case letters, digits and dashes only. */
export function isSafeId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
}
