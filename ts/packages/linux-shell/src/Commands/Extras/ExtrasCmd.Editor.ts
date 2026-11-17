// Port of Commands/Extras/ExtrasCmd.Editor.cs – the vim, vi and nano commands.

import type { CommandDef } from "../../Types/CommandDef.js";
import { note } from "./ExtrasCmd.js";

export function editor(name: string, summary: string, man: string): CommandDef {
  return {
    name,
    summary,
    man,
    run: (ctx) => {
      note(ctx, ctx.sh.msg("extras.editorUnsupported", { editor: name }));
      return 0;
    },
  };
}
