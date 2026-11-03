namespace Codestead.Shell;

// Shell: running scripts (in a subshell or sourced) and `exit`.

public partial class Shell
{
    /// <summary>
    /// Runs a script. By default in a "subshell": cd, variables and functions do not affect the caller.
    /// With inCurrentShell (source) the changes stay.
    /// </summary>
    public int RunScript(string content, string name, List<string> args, IO io, bool inCurrentShell = false, ShellMode? mode = null)
    {
        if (ScriptDepth > 20)
        {
            io.Err($"bash: {name}: {Msg("shell.nestingTooDeep")}\n");
            return 1;
        }
        if (mode is null && !inCurrentShell)
        {
            // The #! line decides which shell runs the script, whatever shell you use yourself.
            var sb = ShellmodeLib.Shebang(content);
            if (sb is not null && sb.Value.Mode != "bash" && ResolveCommand(sb.Value.Mode).Kind != "binary")
            {
                io.Err($"{ShellMode}: {name}: {sb.Value.Interpreter}: bad interpreter: No such file or directory\n");
                return 126;
            }
            mode = sb?.Mode ?? "bash";
        }
        mode ??= ShellMode;
        Node ast;
        try
        {
            ast = ParseCode(content, mode);
        }
        catch (ParseError e)
        {
            io.Err($"{name}: {e.Message}\n");
            return 2;
        }
        var saved = (Cwd, Env: Js.Copy(Env), Functions: Js.Copy(Functions));
        ScriptDepth++;
        if (!inCurrentShell) modeOverride.Add(mode);
        var frame = new List<string> { name };
        frame.AddRange(args);
        positional.Add(frame);
        int savedLoopDepth = LoopDepth;
        LoopDepth = 0;
        int code = 0;
        try
        {
            code = Exec(ast, ToXIO(io));
        }
        catch (ExitSignal e)
        {
            code = e.Code;
        }
        catch (ReturnSignal e)
        {
            code = e.Code;
        }
        catch (LoopSignal)
        {
            code = 0;
        }
        finally
        {
            ScriptDepth--;
            if (!inCurrentShell) modeOverride.RemoveAt(modeOverride.Count - 1);
            positional.RemoveAt(positional.Count - 1);
            LoopDepth = savedLoopDepth;
            if (!inCurrentShell)
            {
                Cwd = saved.Cwd;
                Env = saved.Env;
                Functions = saved.Functions;
            }
        }
        LastExit = code;
        return code;
    }

    /// <summary>Called by `exit`.</summary>
    public int Exit(int code, IO io)
    {
        if (ScriptDepth > 0 || substDepth > 0) throw new ExitSignal(code);
        var top = ShellStack.Count > 0 ? ShellStack[^1] : null;
        if (top is not null && top.UserDepth == UserStack.Count)
        {
            // Back to the shell that started zsh/fish – with its variables, aliases and directory.
            ShellStack.RemoveAt(ShellStack.Count - 1);
            if (top.PushedUser == true) UserStack.RemoveAt(UserStack.Count - 1);
            Cwd = top.Saved.Cwd;
            Env = top.Saved.Env;
            Aliases = top.Saved.Aliases;
            Functions = top.Saved.Functions;
            Flags[$"left:{top.Mode}"] = true;
            Proc.Procs = Proc.Procs.Where(p => p.Pid != top.Pid).ToList();
            return code;
        }
        if (UserStack.Count > 1)
        {
            UserStack.RemoveAt(UserStack.Count - 1);
            var u = CurrentUser();
            Cwd = u.Home;
            Env["HOME"] = u.Home;
            Env["USER"] = u.Name;
            Env["LOGNAME"] = u.Name;
            io.Out("logout\n");
            return code;
        }
        io.Out($"{Dim}{Msg("shell.exitNoSession")}{Reset}\n");
        return 0;
    }
}
