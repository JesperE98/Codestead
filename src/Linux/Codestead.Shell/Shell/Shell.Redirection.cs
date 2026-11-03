namespace Codestead.Shell;

// Shell: redirections (> >> < 2> 2>&1 &> here-documents) around a command.

public partial class Shell
{
    /// <summary>Applies redirections (&gt; &gt;&gt; &lt; 2&gt; 2&gt;&amp;1 &amp;&gt;) around fn.</summary>
    private int WithRedirects(List<Redirect> redirects, XIO io, Func<XIO, int> fn)
    {
        if (redirects.Count == 0) return fn(io);
        var user = CurrentUser();
        var stdin = io.Stdin;
        string? stdoutTarget = null;
        string? stderrTarget = null; // a path or "stdout" (the special marker below)
        bool stderrToStdout = false;
        bool stdoutToStderr = false;
        foreach (var r in redirects)
        {
            if (r.Op == "2>&1")
            {
                stderrToStdout = true;
                stderrTarget = null;
                continue;
            }
            if (r.Op == ">&2")
            {
                stdoutToStderr = true;
                continue;
            }
            if (r.Op == "<<" || r.Op == "<<-")
            {
                stdin = new Reader(r.Expand == true ? ExpandString(r.Body ?? "", io) : r.Body ?? "", 0);
                continue;
            }
            if (r.Op == "<<<")
            {
                stdin = new Reader(string.Join(" ", ExpandWord(r.Target!, io, split: false, glob: false)) + "\n", 0);
                continue;
            }
            var targets = ExpandWord(r.Target!, io);
            if (targets.Count != 1)
            {
                io.Err($"bash: {r.Target!.Raw}: ambiguous redirect\n");
                return 1;
            }
            var path = Resolve(targets[0]);
            try
            {
                if (r.Op == "<")
                {
                    stdin = new Reader(Vfs.ReadFile(path, user), 0);
                }
                else if (r.Op == ">" || r.Op == "&>" || r.Op == ">>")
                {
                    // The file is created/emptied before the command runs – just like in bash.
                    Vfs.WriteFile(path, "", user, r.Op == ">>");
                    stdoutTarget = path;
                    if (r.Op == "&>")
                    {
                        stderrToStdout = true;
                        stderrTarget = null;
                    }
                }
                else
                {
                    Vfs.WriteFile(path, "", user, r.Op == "2>>");
                    stderrTarget = path;
                    stderrToStdout = false;
                }
            }
            catch (FsError e)
            {
                io.Err($"bash: {targets[0]}: {e.Message}\n");
                return 1;
            }
        }
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        Action<string> @out = stdoutTarget is not null ? s => stdout.Append(s) : stdoutToStderr ? io.ErrFn : io.OutFn;
        var rio = new XIO(
            @out,
            stderrToStdout ? @out : stderrTarget is not null ? s => stderr.Append(s) : io.ErrFn,
            stdin,
            io.Tty && stdoutTarget is null);
        try
        {
            return fn(rio);
        }
        finally
        {
            try
            {
                if (stdoutTarget is not null) Vfs.WriteFile(stdoutTarget, stdout.ToString(), user, true);
                if (stderrTarget is not null && !stderrToStdout) Vfs.WriteFile(stderrTarget, stderr.ToString(), user, true);
            }
            catch (FsError e)
            {
                io.Err($"bash: {e.Message}\n");
            }
        }
    }
}
