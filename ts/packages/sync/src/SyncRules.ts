// Which of a tool's saved files are synced and how (the table "Vad synkas" in docs/PLAN-KONTON-OCH-SYNK.md). Files that
// belong to one computer – paths (folders, ide, mainfiles), "what's new", the hub's own settings – and the derived
// profile.json are not synced.

export type FileKind = "learning-state" | "whole-file";

/** The tools whose files are synced. */
export const SyncedTools: readonly string[] = ["codestead-linux", "codestead-gp"];

export function kindOf(tool: string, name: string): FileKind | null {
  if (!SyncedTools.includes(tool)) return null;
  if (name === "state") return "learning-state";
  // The code in Codestead GP's editor, per API and chapter.
  if (tool === "codestead-gp" && /^project\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(name)) return "whole-file";
  // The files in Codestead Linux's terminal, per distribution.
  if (tool === "codestead-linux" && /^shell\.[A-Za-z0-9_-]+$/.test(name)) return "whole-file";
  return null;
}
