using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Shell: simple commands – assignments, aliases, functions, positional parameters, command lookup and "command not found".

public partial class Shell
{
    private static readonly Regex AssignRe = new("^([A-Za-z_][A-Za-z0-9_]*)=", RegexOptions.CultureInvariant);
    private static readonly HashSet<string> NoSplitCommands = new() { "export", "local", "readonly", "declare", "alias" };

    private int RunSimple(SimpleNode node, XIO io)
    {
        Tick();
        // Aliases: replace the first word if it is an alias.
        var words = node.Words;
        var first = words.Count > 0 ? words[0] : null;
        if (first is not null && first.Parts.Count == 1 && first.Parts[0].Quoted == "none" && Aliases.TryGetValue(first.Raw, out var aliasText))
        {
            var aliasWords = ParserLib.Tokenize(aliasText).OfType<WordTok>().Select(t => t.W);
            words = aliasWords.Concat(words.Skip(1)).ToList();
        }

        // Variable assignments first on the line: NAME=value (not split at spaces).
        var assignments = new List<(string Name, string Value)>();
        int k = 0;
        for (; k < words.Count; k++)
        {
            var firstPart = words[k].Parts.Count > 0 ? words[k].Parts[0] : null;
            var m = AssignRe.Match(firstPart?.Quoted == "none" ? firstPart.Text : "");
            if (!m.Success) break;
            var value = string.Concat(ExpandWord(words[k], io, split: false, glob: false));
            assignments.Add((m.Groups[1].Value, value[(m.Groups[1].Value.Length + 1)..]));
        }
        var cmdName = k < words.Count ? words[k].Raw : null;
        bool noSplit = NoSplitCommands.Contains(cmdName ?? "");
        // In [[ ... ]] there is no word splitting or filename expansion – patterns like *.txt are compared as text.
        bool literalArgs = cmdName == "[[";
        var argv = new List<string>();
        for (int idx = 0; idx < words.Count - k; idx++)
        {
            var w = words[k + idx];
            argv.AddRange(literalArgs
                ? ExpandWord(w, io, split: false, glob: false)
                : noSplit && idx > 0
                    ? ExpandWord(w, io, split: false)
                    : ExpandWord(w, io));
        }

        if (argv.Count == 0)
        {
            foreach (var (name, value) in assignments) SetVar(name, value);
            return WithRedirects(node.Redirects, io, _ => assignments.Count > 0 ? LastExit : 0);
        }

        var saved = assignments.Select(a => (a.Name, Value: Env.TryGetValue(a.Name, out var v) ? v : null)).ToList();
        foreach (var (name, value) in assignments) Env[name] = value;
        try
        {
            return WithRedirects(node.Redirects, io, rio =>
                Invoke(argv, new IO(rio.OutFn, rio.ErrFn, rio.Stdin is not null ? rio.Stdin.Data[Math.Min(rio.Stdin.Pos, rio.Stdin.Data.Length)..] : null, rio.Tty, rio.Stdin)));
        }
        finally
        {
            foreach (var (name, value) in saved)
            {
                if (value is null) Env.Remove(name);
                else Env[name] = value;
            }
        }
    }

    private static readonly HashSet<string> PkgManagers = new() { "apt", "apt-get", "pacman", "dnf", "dnf5" };

    /// <summary>Runs a command with ready arguments. Also used by sudo.</summary>
    public int Invoke(List<string> argv, IO io, bool viaSudo = false)
    {
        var name = argv[0];
        var args = argv.Skip(1).ToList();
        var ctx = new CmdCtx(io, this, name, args);
        IndexCmd.Commands.TryGetValue(name, out var builtin);
        try
        {
            if (!viaSudo && Functions.ContainsKey(name)) return CallFunction(name, args, io);
            if (builtin?.Builtin == true && !viaSudo) return builtin.Run(ctx);
            // zsh with `setopt autocd`: a directory name as a command changes directory.
            if (args.Count == 0 && ShellMode == "zsh" && ShellStack.Count > 0 && ShellStack[^1].Options.TryGetValue("autocd", out var autocd) && autocd && !viaSudo)
            {
                if (Vfs.TryLookup(Resolve(name), CurrentUser())?.Type == "dir") return Invoke(new List<string> { "cd", name }, io);
            }

            var found = ResolveCommand(name);
            switch (found.Kind)
            {
                case "notfound":
                    if (viaSudo)
                    {
                        io.Err($"sudo: {name}: command not found\n");
                        NotFoundHint(name, io);
                    }
                    else CommandNotFound(name, io);
                    return viaSudo ? 1 : 127;
                case "error":
                    io.Err($"{(viaSudo ? "sudo" : "bash")}: {name}: {found.Message}\n");
                    return 126;
                case "script":
                    return RunScript(found.Content, name, args, io);
                default:
                {
                    if (!IndexCmd.Commands.TryGetValue(found.Impl, out var def))
                    {
                        io.Err($"bash: {name}: cannot execute binary file\n");
                        return 126;
                    }
                    if (args.Count > 0 && args[0] == "--help" && def.Man is not null && !PkgManagers.Contains(def.Name))
                    {
                        io.Out(UtilCmd.FormatMan(def.Name, ManEnCmd.ManFor(def, this)));
                        return 0;
                    }
                    return def.Run(ctx);
                }
            }
        }
        catch (ControlSignal)
        {
            throw;
        }
        catch (Exception e) when (e is not ControlSignal)
        {
            io.Err($"{name}: {Msg("shell.internalError")}: {e.Message}\n");
            return 1;
        }
    }

    private XIO ToXIO(IO io) => new(io.OutFn, io.ErrFn, io.Reader ?? (io.Stdin is not null ? new Reader(io.Stdin, 0) : null), io.IsTTY);

    private int CallFunction(string name, List<string> args, IO io)
    {
        if (FuncDepth >= 100)
        {
            io.Err($"bash: {name}: maximum function nesting level exceeded (100)\n");
            return 1;
        }
        var frame = new List<string> { positional.Count > 0 ? positional[^1][0] : "bash" };
        frame.AddRange(args);
        positional.Add(frame);
        locals.Add(new Dictionary<string, string?>());
        FuncDepth++;
        try
        {
            return Exec(Functions[name], ToXIO(io));
        }
        catch (ReturnSignal e)
        {
            return e.Code;
        }
        finally
        {
            FuncDepth--;
            positional.RemoveAt(positional.Count - 1);
            var top = locals[^1];
            locals.RemoveAt(locals.Count - 1);
            foreach (var (k, v) in top)
            {
                if (v is null) Env.Remove(k);
                else Env[k] = v;
            }
        }
    }

    /// <summary>`local NAME[=value]` in a function.</summary>
    public bool DeclareLocal(string name, string? value)
    {
        var frame = locals.Count > 0 ? locals[^1] : null;
        if (frame is null || FuncDepth == 0) return false;
        if (!frame.ContainsKey(name)) frame[name] = Env.TryGetValue(name, out var old) ? old : null;
        if (value is not null) Env[name] = value;
        else Env.Remove(name);
        return true;
    }

    /// <summary>Positional parameters ($1, $2 ...) for the current script/function.</summary>
    public List<string> Args => (positional.Count > 0 ? positional[^1] : new List<string> { "bash" }).Skip(1).ToList();

    public void SetArgs(List<string> args)
    {
        if (positional.Count > 0)
        {
            var top = positional[^1];
            top.RemoveRange(1, top.Count - 1);
            top.AddRange(args);
        }
        else
        {
            var frame = new List<string> { "bash" };
            frame.AddRange(args);
            positional.Add(frame);
        }
    }

    private static readonly Regex ElfImplRe = new("^\u007fELF[^(]*\\((?:simulated binary|simulerad binärfil): ([^)\\s]+)\\)", RegexOptions.CultureInvariant);

    public ResolvedCommand ResolveCommand(string name)
    {
        var user = CurrentUser();
        ResolvedCommand Check(string path, FsNode node)
        {
            if (node.Type == "dir") return new ResolvedCommand { Kind = "error", Message = "Is a directory" };
            if (!VfsLib.HasPerm(node, user, 'x')) return new ResolvedCommand { Kind = "error", Message = "Permission denied" };
            var content = node.Content ?? "";
            // The binary says itself which program it is, so it works even when renamed
            // (e.g. ./Calculator.AppImage or /snap/bin/hello-world which points to snap).
            var m = ElfImplRe.Match(content);
            var impl = m.Success ? m.Groups[1].Value : VfsLib.Basename(path);
            if (content.StartsWith(VfsLib.Elf, StringComparison.Ordinal)) return new ResolvedCommand { Kind = "binary", Impl = impl, Path = path };
            if (!VfsLib.HasPerm(node, user, 'r')) return new ResolvedCommand { Kind = "error", Message = "Permission denied" };
            return new ResolvedCommand { Kind = "script", Content = content, Path = path };
        }
        if (name.Contains('/'))
        {
            var path = Resolve(name);
            try
            {
                return Check(path, Vfs.Lookup(path, user));
            }
            catch (FsError e)
            {
                return new ResolvedCommand { Kind = "error", Message = e.Message };
            }
        }
        foreach (var dir in (Env.TryGetValue("PATH", out var p) ? p : "").Split(':'))
        {
            if (dir == "") continue;
            var path = $"{dir}/{name}";
            var node = Vfs.TryLookup(path, user);
            if (node is not null && node.Type == "file" && VfsLib.HasPerm(node, user, 'x')) return Check(path, node);
        }
        return new ResolvedCommand { Kind = "notfound" };
    }

    private void CommandNotFound(string name, IO io)
    {
        var pkg = PackagesLib.PackageProviding(Distro.Family, name);
        var pkgName = pkg?.Names.Get(Distro.Family);
        if (pkg is not null && pkgName is not null && Distro.Id == "ubuntu" && ShellMode == "bash")
        {
            io.Err($"Command '{name}' not found, but can be installed with:\nsudo apt install {pkgName}\n");
            return;
        }
        var mode = ShellMode;
        io.Err(mode == "zsh" ? $"zsh: command not found: {name}\n" : mode == "fish" ? $"fish: Unknown command: {name}\n" : $"bash: {name}: command not found\n");
        NotFoundHint(name, io);
    }

    /// <summary>
    /// After the real "command not found": a dim line from the simulator, so the learner knows whether the
    /// mistake is theirs or the simulator's. A command in a package that is not installed → which package;
    /// a real Linux command that the simulator does not have → say so; otherwise a likely typo → "Did you mean".
    /// </summary>
    public void NotFoundHint(string name, IO io)
    {
        var pkgName = PackagesLib.PackageProviding(Distro.Family, name)?.Names.Get(Distro.Family);
        if (pkgName is not null)
        {
            io.Err($"{Dim}{Msg("shell.commandInPackage", ("pkg", pkgName))}{Reset}\n");
            return;
        }
        if (KnownCommands.NotInSimulator(name))
        {
            io.Err($"{Dim}{Msg("shell.notInSimulator", ("cmd", name))}{Reset}\n");
            return;
        }
        var similar = SimilarCommands(name);
        if (similar.Count > 0) io.Err($"{Dim}{Msg("shell.didYouMean", ("cmds", string.Join(", ", similar)))}{Reset}\n");
    }

    /// <summary>Up to three commands that can be run here and are one or two typos away from <paramref name="name"/>.</summary>
    public List<string> SimilarCommands(string name)
    {
        if (name.Length < 2 || name.Contains('/')) return new();
        int max = name.Length <= 3 ? 1 : 2;
        var runnable = IndexCmd.Commands
            .Where(kv => kv.Key == kv.Value.Name && !kv.Key.StartsWith("__", StringComparison.Ordinal)
                && (kv.Value.Builtin || ResolveCommand(kv.Key).Kind != "notfound"))
            .Select(kv => kv.Key)
            .Concat(Aliases.Keys)
            .Concat(Functions.Keys)
            .Distinct(StringComparer.Ordinal);
        return runnable
            .Select(c => (Cmd: c, D: UtilCmd.TypoDistance(name, c)))
            .Where(x => x.D > 0 && x.D <= max)
            .OrderBy(x => x.D).ThenBy(x => x.Cmd, StringComparer.Ordinal)
            .Take(3).Select(x => x.Cmd).ToList();
    }
}
