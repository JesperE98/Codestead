# Porting the simulator from TypeScript to C#

The TypeScript simulator in `src/shell/**` is being ported 1:1 to C# in `src/Codestead.Shell/`.
The TypeScript code is the **specification**: the C# port must behave identically (same output,
same exit codes, same files created). Tests in `src/shell/*.test.ts` are ported to xUnit in
`tests/Codestead.Shell.Tests/` and must pass unchanged in meaning.

Already ported (read these first, they are the API you build on):

| TypeScript | C# |
|---|---|
| `src/shell/types.ts` | `src/Codestead.Shell/Types.cs` (`Sink`, `IO`, `Reader`, `CmdCtx`, `CommandDef`) |
| `src/shell/signals.ts` | `Signals.cs` (`ExitSignal`, `ReturnSignal`, `LoopSignal`, `LimitError`) |
| `src/shell/vfs.ts` | `Vfs.cs` (`FsNode`, `User`, `FsError`, `VFS`, `VfsLib`) |
| `src/shell/parser.ts` | `Parser.cs` (`Word`, `Part`, `Node` + subclasses, `ParserLib`) |
| `src/shell/arith.ts` | `Arith.cs` (`ArithLib.EvalArith`) |
| `src/shell/distros.ts` | `Distros.cs` (`Distro`, `DistrosLib`) |
| `src/shell/procs.ts` | `Procs.cs` (`Proc`, `Job`, `ProcState`, `ProcsLib`) |
| `src/shell/shell.ts` | `Shell.cs` (`Shell`, `ShellLib`) |
| `src/shell/commands/util.ts` | `Commands/UtilCmd.cs` (`UtilCmd`, `Opts`, `OptSpec`) |
| `src/shell/commands/index.ts` | `Commands/IndexCmd.cs` (`IndexCmd.Commands`) |
| types only | `Shellmode.cs` (`ShellFrame`), `Packages.cs` (`PackageDef`) – the functions are still to be ported |
| JS semantics | `Js.cs` – **use it** (see below) |

## Naming rules (follow exactly – other agents rely on them)

Several modules are ported at the same time by different people who cannot see each other's
work. Everyone must therefore derive C# names mechanically from the TypeScript names:

| TypeScript | C# |
|---|---|
| file `src/shell/foo.ts` | file `src/Codestead.Shell/Foo.cs`, namespace `Codestead.Shell` |
| file `src/shell/commands/foo.ts` | file `src/Codestead.Shell/Commands/FooCmd.cs`, namespace `Codestead.Shell.Commands` |
| exported functions/consts in `foo.ts` | `public static` members of `public static partial class FooLib` |
| exported functions/consts in `commands/foo.ts` | `public static` members of `public static partial class FooCmd` |
| file names with dashes: `man-en.ts`, `extrarepo.ts` | `ManEnCmd`, `ExtrarepoLib` (PascalCase of the file name, dashes removed) |
| `export const FOO_COMMANDS: CommandDef[]` | `public static List<CommandDef> All { get; }` on that module's class (exception: `index.ts` `COMMANDS` → `IndexCmd.Commands`) |
| function `camelCase` | method `PascalCase` |
| const `SCREAMING_CASE` / `camelCase` | `PascalCase` (`STUDENT` → `Student`, `SHELL_PID` → `ShellPid`, `ELF` → `Elf`) |
| exported `interface`/`class`/`type` with fields | top-level `public partial class` with the same name and PascalCase properties |
| object-literal enum like `COLOR = { reset: ... }` | nested static class: `UtilCmd.Color.Reset` |
| string-literal unions (`'debian' \| 'arch'`) | `string` (aliases `Family` and `ShellMode` exist in `GlobalUsings.cs`) |
| tagged unions (`{ type: 'a', ... } \| { type: 'b', ... }`) | abstract base class + one subclass per case (see `Node` in `Parser.cs`) |
| anonymous object return type `{ mode, interpreter } \| null` | named tuple: `(ShellMode Mode, string Interpreter)?` |
| non-exported helpers | `private static` (or `internal`) – name them as you like |

**Every class must be `partial`** (static helper classes `public static partial class`). That
lets temporary stubs and the real code coexist while modules are ported in parallel.

Shell members are PascalCase versions of the TypeScript ones: `sh.vfs` → `sh.Vfs`,
`sh.currentUser()` → `sh.CurrentUser()`, `sh.resolve()` → `sh.Resolve()`, `sh.env` → `sh.Env`,
`sh.flags` → `sh.Flags`, `sh.installed` → `sh.Installed`, `sh.distro.family` → `sh.Distro.Family`,
`sh.msg({ sv, en })` → `sh.Msg(sv, en)`, `sh.ask(...)` → `sh.Ask(...)`, `sh.askText` → `sh.AskText`,
`sh.invoke(argv, io, { viaSudo: true })` → `sh.Invoke(argv, io, viaSudo: true)`,
`sh.expandWord(w, io, { split: false })` → `sh.ExpandWord(w, io, split: false)`.
Exceptions: `sh.pending` → `sh.PendingQuestion`. Read `Shell.cs` for the full list.

## Type mapping

| TypeScript | C# |
|---|---|
| `string \| undefined`, `string \| null` | `string?` (both become `null`) |
| `number` used for exit codes, pids, uids, modes, counts, indices | `int` |
| `number` used for timestamps (ms) or byte sizes | `long` |
| `number` with fractions (percentages, averages) | `double` |
| `T[]` | `List<T>` |
| `Record<string, T>` / `Partial<Record<Family, T>>` | `OrderedDictionary<string, T>` (keeps insertion order like JS objects; create with `Js.Obj<T>()`) |
| `Set<T>` / `Map<K, V>` | `HashSet<T>` / `Dictionary<K, V>` (or `OrderedDictionary` if iteration order matters – JS Maps iterate in insertion order) |
| `obj[key]` that may be missing | `dict.Get(key)` (returns null) or `TryGetValue` – indexing a missing key throws in C# |
| `key in obj` | `dict.ContainsKey(key)` |
| `delete obj[key]` | `dict.Remove(key)` |
| `{ ...obj }` | `Js.Copy(obj)` |
| `JSON.parse(JSON.stringify(x))` | `Js.Clone(x)` |
| `new Error(...)` thrown and caught by type | a `partial class FooError : Exception` |
| callbacks `(s: string) => void` | `Action<string>`; `(x) => number` → `Func<..., int>` |
| `Msg = (t: { sv; en }) => string` | `Func<string, string, string>` taking `(sv, en)` |

Snapshot state (anything stored on the `Shell` and saved, e.g. services, disks) must be plain
classes with public get/set properties so `System.Text.Json` can save and load it
(`Js.JsonOptions`, camelCase). Do not store delegates or `Regex` objects in saved state.

## JavaScript semantics you must keep

Use `Js.cs`:

- `s.slice(a, b)` → `s.Slice(a, b)` (negative indices!). `arr.slice` → `list.Slice(a, b)`. `arr.at(-1)` → `list.At(-1)` or `list[^1]`.
- `s[i]` when `i` may be out of range → `s.CharAt(i)` (returns `""`).
- `'x'.repeat(n)` → `"x".Repeat(n)`; `padStart/padEnd` → `PadLeft/PadRight`.
- `String(n)` for a JS number → `Js.Num(n)`; `n.toFixed(d)` → `Js.ToFixed(n, d)`. Never rely on the current culture: use `CultureInfo.InvariantCulture` for every number format/parse.
- `Number(s)` → `Js.Number(s)` (NaN on failure); `parseInt` → `Js.ParseInt`; `parseFloat` → `Js.ParseFloat`.
- `arr.sort()` on strings → `list.SortJs()` (ordinal), `a.localeCompare(b)` → `Js.LocaleCompare(a, b)`. JS sort is stable: use `list.StableSort(cmp)` or LINQ `OrderBy` (stable), not `List.Sort` with a comparison.
- `Date.now()` → `Js.Now()`; `new Date(ms)` (local) → `Js.LocalDate(ms)`; `new Date()` → `Js.LocalNow()`.
- `0o755` → `Js.Oct(755)` (C# has no octal literals).
- `new TextEncoder().encode(s).length` → `Js.Utf8Length(s)`; `[...s].length` → `Js.CodePointLength(s)`.
- `Math.random()` → `Js.Random()`.
- Truthiness: `if (x)` on a string means "not null and not empty" (`!string.IsNullOrEmpty(x)`); on a number it means "not 0 and not NaN".
- `x ?? y`, `x?.y` work the same in C#. `x || y` on strings means "x if non-empty else y".
- Template literals → interpolated strings `$"..."`; multi-line template literals (man pages) → raw strings `"""` ... `"""` (keep the exact text and indentation).

### Regular expressions

Port each regex to `System.Text.RegularExpressions.Regex`, as a `private static readonly Regex` field
(compiled once). Watch out for these differences:

- **`$` in .NET also matches before a final `\n`.** If the JS regex has no `m` flag and `$` must mean "end of string", write `\z`.
- JS `\d`, `\w`, `\s` are ASCII-only (except `\s`); in .NET they match Unicode digits/letters. Use `[0-9]` and `[A-Za-z0-9_]` when non-ASCII input could appear (Swedish file names contain å/ä/ö).
- Flags: `i` → `RegexOptions.IgnoreCase`, `m` → `RegexOptions.Multiline`, `s` → `RegexOptions.Singleline`, `g` → use `Matches`/`Replace` (replace-all is the default in .NET). Always add `RegexOptions.CultureInvariant`.
- `str.replace(/x/, ...)` without `g` replaces only the **first** match: use `regex.Replace(s, repl, 1)`.
- `str.replace('a', 'b')` with a **string** pattern replaces only the first occurrence in JS – do not use `string.Replace` (which replaces all) unless that is what you want.
- `re.exec(s)?.[1]` → `var m = re.Match(s); m.Success ? m.Groups[1].Value : null`. An unmatched optional group is `undefined` in JS but `""` in .NET – check `m.Groups[n].Success`.
- `[^]` (any char incl. newline) → `[\s\S]`.
- Replacement strings: `$&` → `$0`; `$1` works the same.
- Sticky `y` and lookbehind work in .NET; named groups `(?<name>)` too.

## Writing commands

```csharp
public static partial class FooCmd
{
    private static readonly CommandDef Ls = new()
    {
        Name = "ls",
        Summary = "Listar filer",            // Swedish, unchanged
        SummaryEn = "List files",             // if present in the TS
        Man = """
            NAMN
                   ls - lista innehållet i en katalog
            """,                              // exact text from the TS template literal
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "la" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            ctx.Out("...\n");
            return 0;
        },
    };

    public static List<CommandDef> All { get; } = new() { Ls, /* ... */ };
}
```

- Keep every user-visible string (Swedish and English output, error messages, man pages) **byte for byte** identical to the TypeScript.
- Comments may be translated to English; keep them short.
- `try { ... } catch (e) { msg = fsMessage(e) }` → `catch (FsError e) { msg = e.Message; }`.
- Helper objects created with `{ out: ..., err: ... }` → `new Sink(s => buf.Append(s), ctx.ErrFn)`; with stdin → `new IO(...)`.

## Temporary stubs

`src/Codestead.Shell/_Stubs/` holds stubs so that everything compiles while modules are being
ported. The rules:

1. When you port a module, **delete its stub file(s)** in `_Stubs/Core/` (e.g. porting `users.ts`
   and `commands/users.ts` → delete `users.stub.cs` and `users-cmd.stub.cs`).
2. If your code needs a function from a module someone else is porting and it does not exist
   yet, add a stub with the exact conventional name and the signature you expect to
   `_Stubs/<your-module>/<other-module>.stub.cs` (a `partial` class with `throw new NotImplementedException()`).
   Never edit someone else's module or stub file.
3. The whole `_Stubs` folder is deleted when every module has been ported.

## Tests

- Port each `src/shell/<x>.test.ts` to `tests/Codestead.Shell.Tests/<X>Tests.cs` – one test
  class per file, one `[Fact]` per `test(...)`, with the Swedish test name as `DisplayName`:
  `[Fact(DisplayName = "jokertecken")]`. Keep every assertion; do not weaken or skip any.
- Use `TestShell` (`tests/Codestead.Shell.Tests/TestShell.cs`) for the usual
  `shell()`/`run()` helpers: `var t = new TestShell("ubuntu"); Assert.Equal("x\n", t.Run("echo x").Out);`
- `expect(a).toBe(b)` → `Assert.Equal(b, a)`; `toContain` → `Assert.Contains`; `toMatch(/re/)` →
  `Assert.Matches(@"re", a)` (mind the regex differences above); `toEqual([...])` →
  `Assert.Equal(new[] { ... }, list)`; `toBeNull()`/`toBeUndefined()` → `Assert.Null`.
- Run tests with `dotnet test` from the repository root.

## Workflow for porting agents

1. Make sure the C# solution exists: `ls Codestead.sln src/Codestead.Shell/Shell.cs`. If not, run
   `git merge --ff-only claude/tender-faraday-94yswi` (the branch exists locally).
2. Port your module(s) and their tests. Compile often: `dotnet build src/Codestead.Shell`.
3. Run `dotnet test`. Tests may fail only because other modules are still stubs – note which
   ones in your report. Everything you own must compile and your logic must be a faithful port.
4. Commit in your worktree (do not push) and report: files, deviations from the TypeScript,
   stubs you added, and test results.
