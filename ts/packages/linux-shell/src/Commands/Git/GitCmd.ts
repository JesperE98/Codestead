// Port of Commands/Git/GitCmd.cs (src/shell/commands/git.ts) – this part: errors and output, help, the subcommand
// table and the command itself. Each subcommand is in GitCmd.<Subcommand>.ts; objects, refs, revisions, index,
// config, work tree, diff and status are in their own GitCmd.*.ts files. This is the group's root file: it
// re-exports every part (GitCmd.blobHash, GitCmd.gitRepoState ...) and lists the group's command.
//
// git – a small but real version control system working against the virtual file system.
// The repository is stored in .git/ as ordinary files: objects (blob, tree, commit, tag) under
// .git/objects/xx/…, branches under .git/refs/heads/, HEAD, index, config and a simple reflog
// in .git/logs/HEAD. Everything is text, so the repository is saved with the terminal as JSON.
// Objects are hashed with SHA-1 like real git – a blob gets the same id as on a real computer.
// Trees are stored simplified as a flat list of paths.

import { Js } from "../../Js.js";
import type { Shell } from "../../Shell/Shell.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";
import type { User } from "../../Vfs/User.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { cmdAdd } from "./GitCmd.Add.js";
import { cmdBranch } from "./GitCmd.Branch.js";
import { cmdCatFile } from "./GitCmd.CatFile.js";
import { cmdCheckout } from "./GitCmd.Checkout.js";
import { cmdClone } from "./GitCmd.Clone.js";
import { cmdCommit } from "./GitCmd.Commit.js";
import { cmdConfig, getConfig } from "./GitCmd.Config.js";
import { cmdDiff } from "./GitCmd.Diff.js";
import { cmdFetch } from "./GitCmd.Fetch.js";
import { discover, isDirAt } from "./GitCmd.Files.js";
import { cmdHashObject } from "./GitCmd.HashObject.js";
import { cmdInit } from "./GitCmd.Init.js";
import { cmdLog } from "./GitCmd.Log.js";
import { cmdLsFiles } from "./GitCmd.LsFiles.js";
import { cmdLsTree } from "./GitCmd.LsTree.js";
import { cmdMerge } from "./GitCmd.Merge.js";
import { cmdMv } from "./GitCmd.Mv.js";
import { cmdPull } from "./GitCmd.Pull.js";
import { cmdPush } from "./GitCmd.Push.js";
import { cmdReflog } from "./GitCmd.Reflog.js";
import { cmdRemote, expandTilde } from "./GitCmd.Remote.js";
import { cmdReset } from "./GitCmd.Reset.js";
import { cmdRestore } from "./GitCmd.Restore.js";
import { cmdRevParse } from "./GitCmd.RevParse.js";
import { cmdRm } from "./GitCmd.Rm.js";
import { cmdShow } from "./GitCmd.Show.js";
import { cmdStash } from "./GitCmd.Stash.js";
import { cmdStatus } from "./GitCmd.Status.js";
import { cmdSwitch } from "./GitCmd.Switch.js";
import { cmdTag } from "./GitCmd.Tag.js";

export * from "./GitCmd.Add.js";
export * from "./GitCmd.Args.js";
export * from "./GitCmd.Branch.js";
export * from "./GitCmd.CatFile.js";
export * from "./GitCmd.Checkout.js";
export * from "./GitCmd.Checks.js";
export * from "./GitCmd.Clone.js";
export * from "./GitCmd.Commit.js";
export * from "./GitCmd.Config.js";
export * from "./GitCmd.Diff.js";
export * from "./GitCmd.Fetch.js";
export * from "./GitCmd.Files.js";
export * from "./GitCmd.HashObject.js";
export * from "./GitCmd.Index.js";
export * from "./GitCmd.Init.js";
export * from "./GitCmd.Json.js";
export * from "./GitCmd.Log.js";
export * from "./GitCmd.LsFiles.js";
export * from "./GitCmd.LsTree.js";
export * from "./GitCmd.Merge.js";
export * from "./GitCmd.Mv.js";
export * from "./GitCmd.Objects.js";
export * from "./GitCmd.Pull.js";
export * from "./GitCmd.Push.js";
export * from "./GitCmd.Reflog.js";
export * from "./GitCmd.Refs.js";
export * from "./GitCmd.Remote.js";
export * from "./GitCmd.Reset.js";
export * from "./GitCmd.Restore.js";
export * from "./GitCmd.RevParse.js";
export * from "./GitCmd.Revisions.js";
export * from "./GitCmd.Rm.js";
export * from "./GitCmd.Show.js";
export * from "./GitCmd.Stash.js";
export * from "./GitCmd.Status.js";
export * from "./GitCmd.Subs.js";
export * from "./GitCmd.Switch.js";
export * from "./GitCmd.Tag.js";
export * from "./GitCmd.WorkTree.js";
export * from "./RepoState.js";

// ---------- SHA-1 ----------

const encoder = new TextEncoder();

/** SHA-1 of the UTF-8 bytes of the text, as 40 lowercase hex digits (C# SHA1.HashData; synchronous, so written out). */
export function sha1(text: string): string {
  const bytes = encoder.encode(text);
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 4, (len * 8) >>> 0);
  view.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32));
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h[0]!;
    let b = h[1]!;
    let c = h[2]!;
    let d = h[3]!;
    let e = h[4]!;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = t;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** The same id as `git hash-object` gives for a file with the content `data`. */
export function blobHash(data: string): string {
  return sha1(`blob ${Js.utf8Length(data)}\0${data}`);
}

export const Zero = "0".repeat(40);

export function short(h: string): string {
  return h.slice(0, 7);
}

// ---------- Errors and output ----------

/** Aborts the git command with a text on stderr and an exit status. */
export class GitExit extends Error {
  constructor(
    readonly text: string,
    readonly code: number,
  ) {
    super(text);
  }
}

export function fatal(msg: string): GitExit {
  return new GitExit(`fatal: ${msg}\n`, 128);
}

export function fail(text: string, code = 1): GitExit {
  return new GitExit(text.endsWith("\n") || text === "" ? text : text + "\n", code);
}

/** `throw` as an expression (C# `x ?? throw Fatal(...)` → `x ?? raise(fatal(...))`). */
export function raise(e: Error): never {
  throw e;
}

export const Col = {
  reset: "\x1b[m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  boldRed: "\x1b[1;31m",
  boldGreen: "\x1b[1;32m",
  boldYellow: "\x1b[1;33m",
  boldCyan: "\x1b[1;36m",
  blue: "\x1b[34m",
} as const;

export class G {
  ctx: CmdCtx;
  sh: Shell;
  user: User;
  cwd: string;
  tty: boolean;
  out: (s: string) => void;
  err: (s: string) => void;

  constructor(ctx: CmdCtx) {
    this.ctx = ctx;
    this.sh = ctx.sh;
    this.user = ctx.sh.currentUser();
    this.cwd = ctx.sh.cwd;
    this.tty = ctx.isTTY;
    this.out = (s) => ctx.out(s);
    this.err = (s) => ctx.err(s);
  }

  /** Colours the text if output goes to the terminal. */
  c(color: string, s: string): string {
    return this.tty && s !== "" ? `${color}${s}${Col.reset}` : s;
  }

  note(key: string, args?: MsgArgs): void {
    this.ctx.err(`${UtilCmd.Color.dim}${this.sh.msg(key, args)}${UtilCmd.Color.reset}\n`);
  }

  hint(text: string): void {
    this.ctx.err(
      text
        .split("\n")
        .map((l) => (this.tty ? `${Col.yellow}hint:${l !== "" ? " " + l : ""}${Col.reset}` : `hint:${l !== "" ? " " + l : ""}`))
        .join("\n") + "\n",
    );
  }
}

export function makeG(ctx: CmdCtx): G {
  return new G(ctx);
}

// help / version

const Common = `usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           <command> [<args>]

These are common Git commands used in various situations:

start a working area
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change
   add        Add file contents to the index
   mv         Move or rename a file, a directory, or a symlink
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index

examine the history and state
   diff       Show changes between commits, commit and working tree, etc
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   commit     Record changes to the repository
   merge      Join two or more development histories together
   reset      Reset current HEAD to the specified state
   switch     Switch branches
   tag        Create, list, delete or verify a tag object signed with GPG

collaborate
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.` + "\n";

type Sub = (g: G, args: string[]) => number;

let subsCache: Map<string, Sub> | null = null;

/** The subcommands (built on first use: the parts are only complete once every module has run). */
function subs(): Map<string, Sub> {
  subsCache ??= new Map<string, Sub>([
    ["init", cmdInit],
    ["config", cmdConfig],
    ["status", cmdStatus],
    ["add", cmdAdd],
    ["commit", cmdCommit],
    ["log", cmdLog],
    ["diff", cmdDiff],
    ["restore", cmdRestore],
    ["rm", cmdRm],
    ["mv", cmdMv],
    ["branch", cmdBranch],
    ["switch", cmdSwitch],
    ["checkout", cmdCheckout],
    ["merge", cmdMerge],
    ["reset", cmdReset],
    ["show", cmdShow],
    ["tag", cmdTag],
    ["clone", cmdClone],
    ["remote", cmdRemote],
    ["fetch", cmdFetch],
    ["pull", cmdPull],
    ["push", cmdPush],
    ["stash", cmdStash],
    ["reflog", cmdReflog],
    ["rev-parse", cmdRevParse],
    ["cat-file", cmdCatFile],
    ["hash-object", cmdHashObject],
    ["ls-files", cmdLsFiles],
    ["ls-tree", cmdLsTree],
  ]);
  return subsCache;
}

const whitespaceRunRe = /\s+/;

export function runGit(g: G, args: string[], depth = 0): number {
  // Global flags before the subcommand.
  while (args.length > 0 && args[0]!.startsWith("-")) {
    const a = args[0]!;
    if (a === "--version" || a === "-v") {
      g.out("git version 2.51.1\n");
      return 0;
    }
    if (a === "--help" || a === "-h") {
      g.out(Common);
      return 0;
    }
    if (a === "-C") {
      if (args.length < 2 || args[1] === "") throw fail("error: no directory given for '-C' option\n", 129);
      const dir = VfsLib.resolvePath(g.cwd, expandTilde(g, args[1]!));
      if (!isDirAt(g, dir)) throw fatal(`cannot change to '${args[1]}': No such file or directory`);
      g.cwd = dir;
      args = args.slice(2);
      continue;
    }
    if (a === "--no-pager" || a === "-P" || a === "--paginate" || a === "-p") {
      args = args.slice(1);
      continue;
    }
    if (a === "-c") {
      args = args.slice(2);
      continue;
    }
    throw fail(`unknown option: ${a}\n${Common.split("\n").slice(0, 2).join("\n")}`, 129);
  }
  const cmd = args.length > 0 ? args[0]! : null;
  const rest = args.slice(1);
  if (cmd === null || cmd === "") {
    g.out(Common);
    return 1;
  }
  if (cmd === "version") {
    g.out("git version 2.51.1\n");
    return 0;
  }
  if (cmd === "help") {
    if (rest.length > 0 && rest[0] !== "" && subs().has(rest[0]!)) {
      g.note("git.manGitHint");
      return 0;
    }
    g.out(Common);
    return 0;
  }
  if (rest.includes("-h") && subs().has(cmd)) {
    g.out(`usage: git ${cmd} [<options>]\n`);
    g.note("git.manGitOptions");
    return 129;
  }
  const sub = subs().get(cmd);
  if (sub !== undefined) return sub(g, rest);
  const r = discover(g, g.cwd);
  const alias = getConfig(g, r, `alias.${cmd}`);
  if (alias !== null && alias !== "" && depth < 5) {
    if (alias.startsWith("!")) {
      g.note("git.shellAliasUnsupported");
      return 1;
    }
    return runGit(
      g,
      [...alias.split(whitespaceRunRe).filter((x) => x !== ""), ...rest],
      depth + 1,
    );
  }
  g.err(`git: '${cmd}' is not a git command. See 'git --help'.\n`);
  const keys = [...subs().keys()];
  const prefixed = cmd.length >= 2 ? keys.filter((s) => s.startsWith(cmd)) : [];
  const dist = keys.map((s) => ({ s, d: UtilCmd.levenshtein(s, cmd) }));
  const best = Math.min(...dist.map((x) => x.d));
  const similar = prefixed.length > 0 ? prefixed : best <= 2 ? dist.filter((x) => x.d === best).map((x) => x.s) : [];
  if (similar.length > 0) g.err(`\nThe most similar command${similar.length > 1 ? "s are" : " is"}\n${similar.map((s) => `\t${s}\n`).join("")}`);
  return 1;
}

// ---------- The command ----------

const ManSv = `NAMN
       git - distribuerad versionshantering

SYNOPSIS
       git [-C KATALOG] KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       git sparar ögonblicksbilder (commits) av filerna i ett projekt så att
       du kan se vad som ändrats, gå tillbaka och arbeta i flera grenar.
       Repot ligger i den dolda katalogen .git i projektets rot.

       Arbetskatalogen är filerna du ser. Indexet (staging area) är det som
       ska med i nästa commit. En commit är en sparad version med meddelande,
       författare och tid.

       Simulatorn har en egen, förenklad git som sparar allt i .git som
       textfiler. Nätverk saknas, men clone, fetch, pull och push fungerar
       mot repon på samma dator.

KOMMANDON
       init [KATALOG]           skapa ett nytt repo (-b GREN, --bare)
       config                   inställningar, t.ex.
                                git config --global user.name "Namn"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         visa vad som ändrats (git status är kompassen!)
       add FIL... | . | -A      lägg ändringar i indexet (-u, -f, -n)
       commit -m MEDDELANDE     spara en commit (-a, --amend, --allow-empty)
       log                      historiken (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FIL)
       diff                     arbetskatalog mot index (--staged, --stat,
                                COMMIT, A B, -- FIL)
       show [COMMIT[:FIL]]      visa en commit eller en fil i en commit
       restore FIL              ångra ändringar i arbetskatalogen
                                (--staged för att plocka ur indexet,
                                --source=COMMIT, --ours, --theirs)
       rm [--cached] [-r] FIL   ta bort filer (ur indexet)
       mv KÄLLA MÅL             flytta eller byt namn
       branch [NAMN]            lista eller skapa grenar (-d, -D, -m, -v, -a)
       switch GREN              byt gren (-c NY för att skapa, -, --detach)
       checkout GREN | -- FIL   äldre kommando: byt gren eller återställ fil
                                (-b NY)
       merge GREN               slå ihop en gren (--no-ff, --ff-only,
                                --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FIL
                                flytta grenen eller plocka ur indexet
       stash [list|pop|apply|drop]
                                lägg undan ändringar tillfälligt
       tag [-a -m MEDD] NAMN    märk en commit (t.ex. v1.0)
       clone KÄLLA [MÅL]        kopiera ett repo (bara lokala i simulatorn)
       remote [-v] | remote add NAMN URL
       fetch, pull, push [-u] FJÄRR GREN
                                utbyt commits med ett annat repo
       reflog                   var HEAD har varit (bra för att rädda saker)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                titta in i maskineriet

FILER
       ~/.gitconfig             dina globala inställningar
       .git/                    repot: objects/, refs/heads/, HEAD, index ...
       .gitignore               filer som git ska strunta i

EXEMPEL
       git config --global user.name "Elev Elevsson"
       git init
       git add .
       git commit -m "Första versionen"
       git switch -c ny-design
       git log --oneline --graph --all`;

const ManEn = `NAME
       git - distributed version control

SYNOPSIS
       git [-C DIR] COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       git stores snapshots (commits) of the files in a project so you can
       see what changed, go back in time and work in several branches.
       The repository lives in the hidden directory .git in the project root.

       The working tree is the files you see. The index (staging area) is
       what will go into the next commit. A commit is a saved version with a
       message, an author and a time.

       The simulator has its own simplified git that stores everything in
       .git as text files. There is no network, but clone, fetch, pull and
       push work with repositories on the same computer.

COMMANDS
       init [DIR]               create a new repository (-b BRANCH, --bare)
       config                   settings, e.g.
                                git config --global user.name "Name"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         show what changed (git status is your compass!)
       add FILE... | . | -A     add changes to the index (-u, -f, -n)
       commit -m MESSAGE        record a commit (-a, --amend, --allow-empty)
       log                      history (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FILE)
       diff                     working tree vs index (--staged, --stat,
                                COMMIT, A B, -- FILE)
       show [COMMIT[:FILE]]     show a commit or a file in a commit
       restore FILE             discard changes in the working tree
                                (--staged to unstage, --source=COMMIT,
                                --ours, --theirs)
       rm [--cached] [-r] FILE  remove files (from the index)
       mv SOURCE DEST           move or rename
       branch [NAME]            list or create branches (-d, -D, -m, -v, -a)
       switch BRANCH            switch branches (-c NEW to create, -, --detach)
       checkout BRANCH | -- FILE
                                older command: switch branch or restore file
                                (-b NEW)
       merge BRANCH             join a branch (--no-ff, --ff-only, --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FILE
                                move the branch or unstage
       stash [list|pop|apply|drop]
                                put changes aside for a while
       tag [-a -m MSG] NAME     mark a commit (e.g. v1.0)
       clone SOURCE [DEST]      copy a repository (local only in the simulator)
       remote [-v] | remote add NAME URL
       fetch, pull, push [-u] REMOTE BRANCH
                                exchange commits with another repository
       reflog                   where HEAD has been (great for rescues)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                look inside the machinery

FILES
       ~/.gitconfig             your global settings
       .git/                    the repository: objects/, refs/heads/, HEAD, index ...
       .gitignore               files git should ignore

EXAMPLES
       git config --global user.name "Ada Lovelace"
       git init
       git add .
       git commit -m "First version"
       git switch -c new-design
       git log --oneline --graph --all`;

function runCommand(ctx: CmdCtx): number {
  const g = makeG(ctx);
  try {
    return runGit(g, [...ctx.args]);
  } catch (e) {
    if (e instanceof GitExit) {
      if (e.text !== "") g.err(e.text);
      return e.code;
    }
    if (e instanceof FsError) {
      g.err(`fatal: ${e.message}\n`);
      return 128;
    }
    throw e;
  }
}

/** The group's command. */
export function all(): CommandDef[] {
  return [
    {
      name: "git",
      summary: "Versionshantering",
      summaryEn: "Version control",
      man: ManSv,
      manEn: ManEn,
      run: runCommand,
    },
  ];
}
