// Port of Commands/Script/ScriptCmd.Read.cs – the read command: reads a line of input into variables.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as TextCmd from "../Text/TextCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";

export const read: CommandDef = {
  name: "read",
  builtin: true,
  summary: "Läser en rad indata till variabler",
  man: `NAMN
       read - läs en rad från standard input till en eller flera variabler

SYNOPSIS
       read [-r] [-p FRÅGA] NAMN...

BESKRIVNING
       Läser en rad och lägger den i variabeln NAMN (eller REPLY). Med flera
       namn delas raden upp vid mellanslag; sista variabeln får resten.

FLAGGOR
       -p FRÅGA   visa FRÅGA innan raden läses
       -r         behandla \\ som ett vanligt tecken

EXEMPEL
       read -p "Vad heter du? " namn
       while read rad; do echo "> $rad"; done < fil.txt

I SIMULATORN
       Inne i skript kan read bara läsa från en pipe eller en fil (< fil),
       inte från tangentbordet.`,
  run: (ctx) => {
    const sh = ctx.sh;
    const names: string[] = [];
    let promptText = "";
    for (let i = 0; i < ctx.args.length; i++) {
      const a = ctx.args[i]!;
      if (a === "-p") promptText = ++i < ctx.args.length ? ctx.args[i]! : "";
      else if (a === "-r" || a === "-s" || a === "-e") continue;
      else names.push(a);
    }
    if (names.length === 0) names.push("REPLY");
    const assign = (line: string): void => {
      const fields = TextCmd.splitWords(TextCmd.jsTrim(line));
      for (let idx = 0; idx < names.length; idx++) {
        const n = names[idx]!;
        const value = idx === names.length - 1 ? fields.slice(idx).join(" ") : idx < fields.length ? fields[idx]! : "";
        sh.setVar(n, n === "REPLY" && names.length === 1 ? line : value);
      }
    };
    const reader = ctx.reader;
    if (reader !== null) {
      if (reader.pos >= reader.data.length) {
        for (const n of names) sh.setVar(n, "");
        return 1;
      }
      const nl = reader.data.indexOf("\n", reader.pos);
      const end = nl < 0 ? reader.data.length : nl;
      assign(reader.data.slice(reader.pos, end));
      reader.pos = nl < 0 ? reader.data.length : nl + 1;
      return 0;
    }
    if (sh.canAskInteractively()) {
      sh.askText(promptText, (text) => {
        assign(text);
        return 0;
      });
      return 0;
    }
    ctx.err(`bash: read: ${ctx.sh.msg("script.readNoInput")}\n${UtilCmd.Color.dim}${ctx.sh.msg("script.readInScripts")}${UtilCmd.Color.reset}\n`);
    return 1;
  },
};
