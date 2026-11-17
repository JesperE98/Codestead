// A tool installed by the hub.

/**
 * A tool installed by the hub (a C# record: plain data, copied with spread instead of `with`). The window gets it over
 * IPC, so it has no methods; see {@link executablePath}.
 */
export interface InstalledTool {
  readonly id: string;
  readonly version: string;
  readonly executable: string;
  readonly previous: string | null;
  /** Set by ToolStore: the folder of the installed version. */
  readonly directory: string;
}

export function installedTool(id: string, version: string, executable: string, previous: string | null, directory = ""): InstalledTool {
  return { id, version, executable, previous, directory };
}

/**
 * Path.Combine(directory, executable): `executable` is relative (the catalog checks that), so this joins with the
 * platform's separator (Path.Combine("", x) is x).
 */
export function executablePath(t: InstalledTool, separator: string): string {
  if (t.directory === "") return t.executable;
  return t.directory.endsWith(separator) || t.directory.endsWith("/") ? t.directory + t.executable : t.directory + separator + t.executable;
}

/**
 * current.json as the C# hub writes it (JsonSerializer with Catalog.Json, `tool with { Directory = "" }`): the record's
 * properties in their order, the computed ExecutablePath too, nulls left out, indented. The C# hub and this one read
 * each other's installations.
 */
export function currentJson(t: InstalledTool): string {
  const saved: Record<string, string> = { id: t.id, version: t.version, executable: t.executable };
  if (t.previous !== null) saved.previous = t.previous;
  saved.directory = "";
  saved.executablePath = t.executable;
  return JSON.stringify(saved, null, 2);
}
