// Port of Commands/Repos/ReposCmd.Go.cs – the go command: the compiler for the Go programming language.

import type { CommandDef } from "../../Types/CommandDef.js";
import { dim } from "./ReposCmd.js";

export const go: CommandDef = {
  name: "go",
  summary: "Kompilatorn för programspråket Go",
  summaryEn: "The compiler for the Go programming language",
  man: `NAMN
       go - verktyg för programspråket Go

BESKRIVNING
       I simulatorn stöds bara "go version".`,
  manEn: `NAME
       go - tool for the Go programming language

DESCRIPTION
       Only "go version" is supported in the simulator.`,
  run: (ctx) => {
    if (ctx.args.length > 0 && ctx.args[0] === "version") {
      ctx.out("go version go1.25.3 linux/amd64\n");
      return 0;
    }
    if (ctx.args.length === 0) {
      ctx.out("Go is a tool for managing Go source code.\n\nUsage:\n\n\tgo <command> [arguments]\n");
      return 2;
    }
    ctx.out(dim(ctx.sh, "repos.goSubcommandUnsupported", { subcommand: ctx.args[0] }));
    return 1;
  },
};
