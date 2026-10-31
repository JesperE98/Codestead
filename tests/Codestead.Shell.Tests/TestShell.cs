using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

/// <summary>The result of one command line: the ExecResult plus <see cref="Out"/> without ANSI colours ({ ...r, out: stripAnsi(r.output) }).</summary>
public sealed class RunResult
{
    public required ExecResult Result { get; init; }
    public string Out => UtilCmd.StripAnsi(Result.Output);
    public string Output => Result.Output;
    public int ExitCode => Result.ExitCode;
    public bool Pending => Result.Pending;
    public bool Incomplete => Result.Incomplete;
    public bool Clear => Result.Clear;
    public string Line => Result.Line;
}

/// <summary>
/// The usual test helper from the TypeScript tests:
/// <code>const sh = Shell.create(distro); const run = (line) => ({ ...sh.execute(line), out: stripAnsi(...) })</code>
/// </summary>
public sealed class TestShell
{
    public Shell Sh { get; }

    /// <summary>A Swedish computer (the tests were written for it) unless <paramref name="world"/> says otherwise.</summary>
    public TestShell(string distro = "ubuntu", string? lang = null, string world = "sv")
    {
        Sh = Shell.Create(distro, world);
        if (lang is not null) Sh.Lang = lang;
    }

    public RunResult Run(string line) => new() { Result = Sh.Execute(line) };

    /// <summary>Runs several lines and returns the last result.</summary>
    public RunResult RunAll(params string[] lines)
    {
        RunResult? last = null;
        foreach (var l in lines) last = Run(l);
        return last!;
    }

    /// <summary>sh.vfs.tryLookup(path.replace(/^~/, '/home/elev'), sh.rootUser())</summary>
    public FsNode? Node(string path) =>
        Sh.Vfs.TryLookup(path.StartsWith('~') ? "/home/elev" + path[1..] : path, Sh.RootUser());

    /// <summary>Contents of a file (as root), or null if it does not exist.</summary>
    public string? Content(string path) => Node(path)?.Content;
}
