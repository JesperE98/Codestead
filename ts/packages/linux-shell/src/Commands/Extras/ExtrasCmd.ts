// Port of Commands/Extras/ExtrasCmd.cs (src/shell/commands/extras.ts) – programs that are not preinstalled but
// installed with the package manager: tree, htop, fastfetch, cowsay, python3, vim, nano.
// (curl, wget and ssh live in NetCmd.ts and SshCmd.ts.) This is the group's root file (helpers and the command
// list); the commands themselves are ExtrasCmd.<Name>.ts.

import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { cowsay } from "./ExtrasCmd.Cowsay.js";
import { editor } from "./ExtrasCmd.Editor.js";
import { fastfetch } from "./ExtrasCmd.Fastfetch.js";
import { htop } from "./ExtrasCmd.Htop.js";
import { python3 } from "./ExtrasCmd.Python3.js";
import { tree } from "./ExtrasCmd.Tree.js";

export * from "./ExtrasCmd.Cowsay.js";
export * from "./ExtrasCmd.Editor.js";
export * from "./ExtrasCmd.Fastfetch.js";
export * from "./ExtrasCmd.Htop.js";
export * from "./ExtrasCmd.Python3.js";
export * from "./ExtrasCmd.Tree.js";

export function note(ctx: CmdCtx, text: string): void {
  ctx.out(`${UtilCmd.Color.dim}${text}${UtilCmd.Color.reset}\n`);
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [
    tree,
    htop,
    fastfetch,
    cowsay,
    python3,
    editor("vim", "Kraftfull texteditor", `NAMN
       vim - Vi IMproved, en kraftfull texteditor

BESKRIVNING
       vim har lägen: tryck i för att skriva, Esc för att gå tillbaka,
       :w för att spara och :q för att avsluta (:q! utan att spara).`),
    editor("vi", "Texteditor (oftast vim i ett enklare läge)", `NAMN
       vi - den klassiska texteditorn i Unix

BESKRIVNING
       I de flesta distributioner startar vi en enkel variant av vim. Samma
       knappar gäller: i för att skriva, Esc, :w för att spara och :q för att
       avsluta (:wq sparar och avslutar).`),
    editor("nano", "Enkel texteditor", `NAMN
       nano - en enkel texteditor

BESKRIVNING
       Kommandona visas längst ner: ^O betyder Ctrl+O (spara) och ^X
       betyder Ctrl+X (avsluta).`),
  ]);
}
