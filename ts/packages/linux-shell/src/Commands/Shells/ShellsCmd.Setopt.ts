// Port of Commands/Shells/ShellsCmd.Setopt.cs – zsh's setopt and unsetopt.

import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

const zshOptions = [
  "autocd",
  "autopushd",
  "correct",
  "extendedglob",
  "globdots",
  "histignorealldups",
  "histignoredups",
  "interactivecomments",
  "nomatch",
  "promptsubst",
  "sharehistory",
  "shwordsplit",
  "appendhistory",
  "notify",
];

function notFound(ctx: CmdCtx): number {
  const mode = ctx.sh.shellMode;
  ctx.err(mode === "fish" ? `fish: Unknown command: ${ctx.name}\n` : `${mode}: ${ctx.name}: command not found\n`);
  ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg("shells.zshOnly", { command: ctx.name })}${UtilCmd.Color.reset}\n`);
  return 127;
}

export function optCommand(name: string): CommandDef {
  return {
    name,
    builtin: true,
    summary: name === "setopt" ? "Slår på en inställning i zsh (t.ex. autocd)" : "Slår av en inställning i zsh",
    summaryEn: name === "setopt" ? "Turn on a zsh option (e.g. autocd)" : "Turn off a zsh option",
    man: `NAMN
       ${name} - ${name === "setopt" ? "slå på" : "slå av"} inställningar i zsh

SYNOPSIS
       ${name} [INSTÄLLNING]...

BESKRIVNING
       Finns bara i zsh. Utan argument listas inställningarna som är på.
       Lägg raden i ~/.zshrc för att den ska gälla varje gång.

       autocd       skriv ett katalognamn för att gå dit, utan cd
       shwordsplit  dela upp ociterade $variabler vid mellanslag, som bash
       correct      föreslå rättningar av felstavade kommandon

EXEMPEL
       setopt autocd
       dokument`,
    manEn: `NAME
       ${name} - turn zsh options ${name === "setopt" ? "on" : "off"}

SYNOPSIS
       ${name} [OPTION]...

DESCRIPTION
       Only exists in zsh. Without arguments the options that are on are
       listed. Put the line in ~/.zshrc to make it permanent.

       autocd       type a directory name to go there, without cd
       shwordsplit  split unquoted $variables on spaces, like bash
       correct      suggest corrections for misspelled commands

EXAMPLES
       setopt autocd
       dokument`,
    run: (ctx) => {
      const sh = ctx.sh;
      if (sh.shellMode !== "zsh") return notFound(ctx);
      const frame = sh.shellStack.length > 0 ? sh.shellStack.at(-1)! : null;
      const options = frame?.mode === "zsh" ? frame.options : Js.obj<boolean>();
      if (ctx.args.length === 0) {
        for (const o of [...options.keys()].filter((k) => options.get(k)).sort()) ctx.out(o + "\n");
        return 0;
      }
      let code = 0;
      for (const a of ctx.args) {
        let opt = a.toLowerCase().replaceAll("_", "");
        let on = name === "setopt";
        if (opt.startsWith("no") && zshOptions.includes(opt.slice(2))) {
          opt = opt.slice(2);
          on = !on;
        }
        if (!zshOptions.includes(opt)) {
          ctx.err(`${name}: no such option: ${a}\n`);
          code = 1;
          continue;
        }
        options.set(opt, on);
      }
      return code;
    },
  };
}
