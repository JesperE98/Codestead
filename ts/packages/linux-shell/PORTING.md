# Porting the shell's commands (wave 2)

Wave 1 ported the core of `src/Linux/Codestead.Shell` (everything except `Commands/`) and the command
infrastructure. Wave 2 ports the commands: the 267 files in `src/Linux/Codestead.Shell/Commands/<Group>/`.
Read `BRIEF-ts-port.md` / `docs/TYPESCRIPT-MIGRATION.md` first; this file is only about the commands.

## Where things are

| C# | TypeScript |
|---|---|
| `Commands/<Group>/<Group>Cmd.cs` (group root: helpers + `All`) | `src/Commands/<Group>/<Group>Cmd.ts` |
| `Commands/<Group>/<Group>Cmd.<Name>.cs` (one command) | `src/Commands/<Group>/<Group>Cmd.<Name>.ts` |
| `tests/Linux/Codestead.Shell.Tests/<Class>.cs` | `test/<Class>.test.ts` |

Already there:

- `Commands/IndexCmd.ts` – the registry. It calls every group root's `all()` (and `SshCmd.transfer()`) in the C# order
  and builds `IndexCmd.commands(): Map<string, CommandDef>`. **You do not edit it**: register a command by adding it to
  its group root's `all()`.
- Group roots that are **stubs** (`all()` returns `[]`, the C# list is in the doc comment): Fs, Fileinfo, Run, System,
  Pkg, Extras, Script, Procs, Textproc, Archive, Git, Systemd, Shells, Users, Net, Ssh, Disks, Repos. Replace the stub
  with the port of the C# root file (keep `export function all()`).
- Group roots that are **ported** (the core needs them) with an empty `all()`: `Text/TextCmd.ts` (breToJs, collation,
  sortLines, catLike, toIndex, jsTrim ...), `Cron/CronCmd.ts` (tick, parse, due, allJobs ...), `Universal/UniversalCmd.ts`
  (appImageNode, simBinary, dim, windowNote ...). Port the command files and fill in `all()`.
- `Commands/Util/UtilCmd.ts` (+ `Input`, `OptSpec`, `Opts`), `Commands/RegexCmd.ts`, and the whole man page table
  `Commands/Man/ManEnCmd*.ts` (manFor, summaryFor, englishSummary, manEn()).
- No folder yet for `Awk/` (AwkCmd is used by Textproc, not by IndexCmd): create it.

## The pattern

```csharp
public static partial class FsCmd
{
    private static readonly CommandDef Pwd = new()
    {
        Name = "pwd", Builtin = true, Summary = "Skriver ut aktuell katalog", Man = """ ... """,
        Run = ctx => { ... ctx.Out(ctx.Sh.Cwd + "\n"); return 0; },
    };
}
```

becomes `src/Commands/Fs/FsCmd.Pwd.ts`:

```ts
// Port of Commands/Fs/FsCmd.Pwd.cs – the pwd command: prints the current directory.

import type { CommandDef } from "../../Types/CommandDef.js";
import { FsError } from "../../Vfs/FsError.js";

export const pwd: CommandDef = {
  name: "pwd",
  builtin: true,
  summary: "Skriver ut aktuell katalog",
  man: `NAMN
       pwd - ...`,
  run: (ctx) => {
    ...
    ctx.out(ctx.sh.cwd + "\n");
    return 0;
  },
};
```

and the group root:

```ts
export * from "./FsCmd.Pwd.js"; // re-export every part, so other groups can call FsCmd.applyMode(...) etc.
import { pwd } from "./FsCmd.Pwd.js";

export function all(): CommandDef[] {
  return [cd, pwd, ls, ...]; // exactly the C# order
}
```

- One TS file per C# file, same name. A C# `partial class` is a set of modules: the root re-exports its parts, and the
  parts import what they need from the root or from each other. Other code imports the root as a namespace:
  `import * as FsCmd from "../Fs/FsCmd.js"` → `FsCmd.applyMode(...)`, like the C#.
- Members become camelCase (`Pwd` → `pwd`, `TrueCmd` → `trueCmd`, `HeadTail("head")` → `headTail("head")`).
- **Helpers used at the top level of another file must be `function` declarations**, not `const f = () => …`: the
  group root imports its parts (for `all()`) and the parts import the root, and only function declarations exist
  before a module in such a cycle has run. Command objects are `export const` (they are only read inside `all()`).
- `def.With(name: "sh")` → `withDef(def, { name: "sh" })` (from `Types/CommandDef.ts`).
- Keep the comments (`/// <summary>` → `/** */`) and the text of every message and man page byte for byte.

### C# raw string literals (`"""`)

The content is the lines between the opening and the closing `"""`, with the closing line's indentation removed from
every line, without the last newline. Write it as a template literal (escape `` ` ``, `${` and `\`) or a JSON-style
string. `$$"""…{{Name}}…"""` inserts `Name`'s value (single braces are text). Check the result against the C# – the
i18n and command tests compare man pages and outputs exactly.

## C# → TypeScript, the shell API

| C# | TypeScript |
|---|---|
| `ctx.Out(s)`, `ctx.Err(s)`, `ctx.Args`, `ctx.Name`, `ctx.Sh`, `ctx.Stdin`, `ctx.Reader`, `ctx.IsTTY` | `ctx.out(s)`, `ctx.err(s)`, `ctx.args` (string[]), `ctx.name`, `ctx.sh`, `ctx.stdin`, `ctx.reader`, `ctx.isTTY` |
| `new IO(out, err, stdin, isTTY, reader)`, `new IO(io)`, `Sink.Null()` | the same constructors, `Sink.null()` |
| `sh.Vfs`, `sh.Cwd`, `sh.Env`, `sh.Flags`, `sh.Installed`, `sh.Aliases`, `sh.Functions` | `sh.vfs`, `sh.cwd`, Maps: `sh.env.get/set/has/delete` |
| `sh.CurrentUser()`, `sh.RootUser()`, `sh.GetUser(n)`, `sh.Resolve(p)`, `sh.Home` | `sh.currentUser()`, `sh.rootUser()`, `sh.getUser(n)`, `sh.resolve(p)`, `sh.home` |
| `sh.Msg("key", ("name", value))` | `sh.msg("key", { name: value })` (keep the key a string literal, see below) |
| `sh.ExpandWord(w, io, split: false, glob: false)` | `sh.expandWord(w, io, { split: false, glob: false })` |
| `sh.Invoke(argv, io, viaSudo: true)`, `sh.RunScript(c, n, args, io, true, mode)` | `sh.invoke(argv, io, true)`, `sh.runScript(c, n, args, io, true, mode)` |
| `sh.Ask(q, defaultYes, (yes, io) => …)`, `sh.AskText(p, (text, io) => …, secret)` | `sh.ask(...)`, `sh.askText(...)` |
| `sh.RunAs(user, () => …)`, `sh.Exit(code, io)`, `sh.ShellMode`, `sh.Args`, `sh.Interactive` | `sh.runAs(...)`, `sh.exit(...)`, `sh.shellMode`, `sh.args`, `sh.interactive` |
| `VfsLib.MakeFile(...)`, `vfs.Lookup(p, u, follow: false)`, `vfs.TryLookup(p, u)` | `VfsLib.makeFile(...)`, `vfs.lookup(p, u, false)`, `vfs.tryLookup(p, u)` (null when missing) |
| `node.Children` (OrderedDictionary) | `node.children` (a `Map` in insertion order – iterate with `for (const [name, child] of …)`) |
| `UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "la", Values = "n", Long = new() { ["all"] = "a" } })` | `UtilCmd.parseOpts(ctx.args, { flags: "la", values: "n", long: { all: "a" } })` |
| `o.Flags.Contains("a")`, `o.Values.TryGetValue("n", out var v)`, `o.Operands`, `o.Error is not null` | `o.flags.has("a")`, `o.values.get("n")`, `o.operands`, `o.error !== null` |
| `UtilCmd.Color.Dim`, `UtilCmd.BadOption(ctx, err)`, `UtilCmd.ReadInputs(ctx, ops)` → `(inputs, failed)` | `UtilCmd.Color.dim`, `UtilCmd.badOption(ctx, err)`, `const { inputs, failed } = UtilCmd.readInputs(ctx, ops)` |
| `catch (FsError e) { … }` | `catch (e) { if (!(e instanceof FsError)) throw e; … }` (never swallow other errors) |
| `Js.Oct(755)`, `Js.Now()`, `Js.Num(x)`, `Js.ToFixed(x, 1)`, `Js.ClockOverride = …` | `Js.oct(755)`, `Js.now()`, `Js.num(x)`, `Js.toFixed(x, 1)`, `Js.clockOverride = …` |
| `Js.Slice`, `At`, `CharAt`, `SortJs`, `StableSort`, `Split`, `Js.Clone` | native `slice`, `at`, `s[i] ?? ""`, `sort()`, `sort(cmp)` (stable), `split`, `Js.clone` |
| `RegexCmd.NewRegExp(src, flags)`, `JsSplit`, `TextCmd.JsRegex/JsTrim/SplitWords` | they exist (thin wrappers); in new code plain `new RegExp`, `split`, `trim` are the same |

Other translations:

- **Tuples and `out` parameters** → objects: `(List<Job> Jobs, string? Error)` → `{ jobs, error }`.
- **Integers**: C# `int`/`long` division truncates (`Math.trunc(a / b)`); `%` is the same; arithmetic that relies on
  64-bit overflow needs `BigInt` (see `Arith/ArithLib.ts`); `uint` hashes use `Math.imul(...) >>> 0`.
- **Strings**: `Replace(a, b)` replaces all → `replaceAll`; `string.Compare(a, b, InvariantCulture)` →
  `Js.localeCompare`; ordinal comparisons → `<`/`>` or `Js.ordinal`; `PadLeft/PadRight` → `padStart/padEnd`;
  `{x,-24}` → `padEnd(24)`, `{x,2}` → `padStart(2)`; `$"{d.Hour:00}"` → `Js.pad2(d.getHours())`.
- **Dates**: `Js.LocalDate(ms)` is a JS `Date`: `getMonth()` is 0-based, `getDay()` is DayOfWeek, `getDate()` is Day.
  `DateTime.ToString("HH:mm")` → `Js.hhmm(d)`.
- **Regexes**: C# `\z` → `$` (no `m` flag); C# `$` without Multiline also matches before a final `\n` → `(?=\n?$)`;
  `RegexOptions.Singleline` → `s`; `.` in .NET only excludes `\n` (JS also `\r`); .NET `\w`, `\d`, `\b` are Unicode –
  use `NetRegex` from `Js.ts` (with the `u` flag) where it matters; `re.Replace(s, x, 1)` → a non-global regex;
  global `Regex.Replace` → the `g` flag. `RegexOptions.ECMAScript` means plain JavaScript semantics.
- **LINQ**: `OrderBy` is stable like `Array.prototype.sort`; `First()` throws, `FirstOrDefault()` → `?? null`;
  `Distinct()` keeps the first occurrence.
- **Exceptions**: `ControlSignal`s (ExitSignal, ReturnSignal, LoopSignal, LimitError) must pass through untouched;
  `ParseError`, `ArithError`, `FsError`, `ExpansionError` are classes you can `instanceof`.
- **Message keys** for the simulator's own lines: keep the key as a string literal right in the call –
  `sh.msg("key")`, `ShellI18n.msg(lang, "key")`, or the group helpers `dim(…, "key")`, `note`, `tip`, `dimNote`,
  `unsupported`, `feature` – because `test/ShellI18nTests.test.ts` scans the sources for them.

## Tests

- Port the C# test class of your group to `test/<Class>.test.ts`, one `it` per `[Fact]` with the Swedish
  `DisplayName` as the name, `it.each` for `[Theory]`. Same cases, same expected values.
- `test/TestShell.ts` is `TestShell.cs`: `const t = new TestShell("arch", "en"); t.run("ls").out` (ANSI stripped),
  `t.runAll(...)`, `t.node("~/x")`, `t.content(path)`, plus `expectStartsWith/expectEndsWith` for
  `Assert.StartsWith/EndsWith`.
- Tests that need commands from another group that is not ported yet: `itNeeds(["git", "apt"], name, fn)` – a todo
  until the commands exist, then a normal test. `whenCommands([...], fn)` guards a part of a test.
- The C# test classes and the groups they mostly need: ServicesTests (Systemd), NetworkTests (Net, Ssh), DisksTests
  (Disks), UsersTests (Users), ReposTests (Repos, Universal, Pkg), GitTests (Git), ArchiveTests (Archive),
  TextprocTests (Textproc, Awk), ScriptTests (Script), ShellsTests (Shells), LinksCronTransferTests (Fileinfo, Cron,
  Ssh transfer).
- The core's tests (CoreTests, ShellTests, BaseTests, WorldTests, I18nTests, ShellI18nTests, NotFoundTests,
  TerminalTests) are already ported; many of them are todos waiting for commands (`itNeeds`). When your commands land,
  run the whole package (`npx vitest run packages/linux-shell`) – those todos turn into tests and must pass.
  Once every command is in, `ShellI18nTests` checks that the summaries in i18n/en.json and sv.json match the code.
- Tests that change the clock: `Js.clockOverride = () => ms` and reset it to `null` in `afterEach`.
- Verify with `npm run typecheck` and `npx vitest run packages/linux-shell` from `ts/`.
