namespace Codestead.Shell;

// Shell: other shells (zsh, fish) on top of bash, parsing in the current shell's syntax, prompt and welcome text.

public partial class Shell
{
    // ---------- Other shells (zsh, fish) ----------

    /// <summary>The shell interpreting the commands right now.</summary>
    public ShellMode ShellMode
    {
        get
        {
            if (modeOverride.Count > 0) return modeOverride[^1];
            var top = ShellStack.Count > 0 ? ShellStack[^1] : null;
            return top is not null && top.UserDepth == UserStack.Count ? top.Mode : "bash";
        }
    }

    /// <summary>True when commands are typed directly in the terminal (not in a script or $(...)).</summary>
    public bool Interactive => modeOverride.Count == 0 && substDepth == 0;

    /// <summary>Starts a new interactive shell (zsh, fish or bash) on top of the current one.</summary>
    public int StartShell(ShellMode mode, Sink io)
    {
        int pid = Proc.NextPid++;
        int ppid = ShellStack.Count > 0 ? ShellStack[^1].Pid : ProcsLib.ShellPid;
        var user = CurrentUser();
        Proc.Procs.Add(ShellmodeLib.ShellProc(pid, ppid, user.Name, mode));
        var saved = new ShellFrameSaved { Cwd = Cwd, Env = Js.Copy(Env), Aliases = Aliases, Functions = Functions };
        // `sudo zsh` gives a shell as root.
        bool pushedUser = user.Name != (UserStack.Count > 0 ? UserStack[^1] : null);
        if (pushedUser)
        {
            UserStack.Add(user.Name);
            Env["USER"] = user.Name;
            Env["HOME"] = user.Home;
        }
        ShellStack.Add(new ShellFrame { Mode = mode, Pid = pid, UserDepth = UserStack.Count, Options = Js.Obj<bool>(), Saved = saved, PushedUser = pushedUser });
        // Aliases and functions are not inherited by a new shell – environment variables are.
        Aliases = Js.Obj<string>();
        Functions = Js.Obj<Node>();
        ShellmodeLib.ShellStartup(this, mode, io);
        return 0;
    }

    /// <summary>Parses code with the current shell's syntax (fish is translated to bash first).</summary>
    private Node ParseCode(string text, ShellMode? mode = null)
    {
        mode ??= ShellMode;
        return ParserLib.Parse(mode == "fish" ? FishLib.TranslateFish(text, Lang) : text);
    }

    public string Prompt()
    {
        if (PendingQuestion is not null) return PendingQuestion.Question;
        if (partial is not null) return "> ";
        if (ShellMode != "bash") return ShellmodeLib.ShellPrompt(this, ShellMode);
        var u = CurrentUser();
        var p = Cwd;
        if (p == u.Home) p = "~";
        else if (p.StartsWith(u.Home + "/", StringComparison.Ordinal)) p = "~" + p[u.Home.Length..];
        var sym = u.Uid == 0 ? "#" : "$";
        var host = Distro.Hostname;
        return Distro.PromptStyle switch
        {
            "ubuntu" => u.Uid == 0
                ? $"{u.Name}@{host}:{p}{sym} "
                : $"\x1b[1;32m{u.Name}@{host}\x1b[0m:\x1b[1;34m{p}\x1b[0m{sym} ",
            "debian" => $"{u.Name}@{host}:{p}{sym} ",
            _ => $"[{u.Name}@{host} {(p == "~" || p == "/" ? p : VfsLib.Basename(p))}]{sym} ",
        };
    }

    public string Welcome()
    {
        var motd = Distro.Motd != "" ? Distro.Motd + "\n" : "";
        return motd + Dim +
            Msg("shell.welcome", ("distro", Distro.Name)) +
            $"{Reset}\n";
    }
}
