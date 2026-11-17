// Port of Commands/System/SystemCmd.cs (src/shell/commands/system.ts) – shell and system commands: sudo, su, man,
// help, which, type, export, alias, history, uname and more. This is the group's root file (helpers and the command
// list); the commands themselves are SystemCmd.<Name>.ts.

import type { Obj } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { withDef } from "../../Types/CommandDef.js";
import { alias } from "./SystemCmd.Alias.js";
import { basenameCmd } from "./SystemCmd.Basename.js";
import { bash } from "./SystemCmd.Bash.js";
import { clear } from "./SystemCmd.Clear.js";
import { date } from "./SystemCmd.Date.js";
import { dirnameCmd } from "./SystemCmd.Dirname.js";
import { envCmd } from "./SystemCmd.Env.js";
import { exitCmd, logout } from "./SystemCmd.Exit.js";
import { exportCmd } from "./SystemCmd.Export.js";
import { falseCmd } from "./SystemCmd.False.js";
import { groups } from "./SystemCmd.Groups.js";
import { help } from "./SystemCmd.Help.js";
import { history } from "./SystemCmd.History.js";
import { hostname } from "./SystemCmd.Hostname.js";
import { id } from "./SystemCmd.Id.js";
import { man } from "./SystemCmd.Man.js";
import { seq } from "./SystemCmd.Seq.js";
import { sleep } from "./SystemCmd.Sleep.js";
import { dot, source } from "./SystemCmd.Source.js";
import { su } from "./SystemCmd.Su.js";
import { sudo } from "./SystemCmd.Sudo.js";
import { trueCmd } from "./SystemCmd.True.js";
import { typeCmd } from "./SystemCmd.Type.js";
import { unalias } from "./SystemCmd.Unalias.js";
import { uname } from "./SystemCmd.Uname.js";
import { unset } from "./SystemCmd.Unset.js";
import { which } from "./SystemCmd.Which.js";
import { whoami } from "./SystemCmd.Whoami.js";

export * from "./SystemCmd.Alias.js";
export * from "./SystemCmd.Basename.js";
export * from "./SystemCmd.Bash.js";
export * from "./SystemCmd.Clear.js";
export * from "./SystemCmd.Date.js";
export * from "./SystemCmd.Dirname.js";
export * from "./SystemCmd.Env.js";
export * from "./SystemCmd.Exit.js";
export * from "./SystemCmd.Export.js";
export * from "./SystemCmd.False.js";
export * from "./SystemCmd.Groups.js";
export * from "./SystemCmd.Help.js";
export * from "./SystemCmd.History.js";
export * from "./SystemCmd.Hostname.js";
export * from "./SystemCmd.Id.js";
export * from "./SystemCmd.Man.js";
export * from "./SystemCmd.Seq.js";
export * from "./SystemCmd.Sleep.js";
export * from "./SystemCmd.Source.js";
export * from "./SystemCmd.Su.js";
export * from "./SystemCmd.Sudo.js";
export * from "./SystemCmd.True.js";
export * from "./SystemCmd.Type.js";
export * from "./SystemCmd.Unalias.js";
export * from "./SystemCmd.Uname.js";
export * from "./SystemCmd.Unset.js";
export * from "./SystemCmd.Which.js";
export * from "./SystemCmd.Whoami.js";

export function simple(name: string, summary: string, run: (ctx: CmdCtx) => number, man: string | null = null, builtin = false): CommandDef {
  return { name, summary, run, man, builtin };
}

/** Object.entries(obj).sort() in JavaScript: the pairs sorted as the strings "key,value" (ordinal). */
export function sortedEntries(obj: Obj<string>): [string, string][] {
  return [...obj].map(([k, v]) => ({ k, v, s: `${k},${v}` })).sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0)).map((e): [string, string] => [e.k, e.v]);
}

let list: CommandDef[] | null = null;

/** The group's commands, in the C# order (built on first use). */
export function all(): CommandDef[] {
  return (list ??= [
    whoami, id, groups, hostname, uname, date, envCmd("env"), envCmd("printenv"), exportCmd, unset, alias, unalias,
    history, typeCmd, which, man, help, clear, exitCmd, logout, sudo, su, bash, withDef(bash, { name: "sh" }), source, dot,
    trueCmd, falseCmd, sleep, seq, basenameCmd, dirnameCmd,
  ]);
}
