// Port of Shell/ResolvedCommand.cs – the result of looking up a command name (see Shell.resolveCommand).

/** Result of looking up a command name: "notfound", "error", "binary" or "script". */
export interface ResolvedCommand {
  kind: "notfound" | "error" | "binary" | "script";
  message: string;
  impl: string;
  path: string;
  content: string;
}

/** new ResolvedCommand { ... } with the C# defaults for the fields not given. */
export function resolvedCommand(r: Partial<ResolvedCommand>): ResolvedCommand {
  return { kind: r.kind ?? "notfound", message: r.message ?? "", impl: r.impl ?? "", path: r.path ?? "", content: r.content ?? "" };
}
