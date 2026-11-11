namespace Codestead.GP.Course.Ide;

/// <summary>
/// What the app knows about the learner's project: whether the program was built after the last change to the code,
/// and run after that build (and after the last change to its shaders and other files it reads when it starts).
/// </summary>
public sealed record WatchStatus(
    bool FolderExists,
    string? Executable,
    DateTime? BuiltAt,
    DateTime? LastRunAt,
    bool Built,
    bool Ran,
    bool RanByHand,
    string Fingerprint)
{
    public static WatchStatus None { get; } = new(false, null, null, null, false, false, false, "");

    /// <summary>No executable was found anywhere under the folder.</summary>
    public bool NoExecutable => FolderExists && Executable is null;

    /// <summary>Built and run since the last change: the code can be checked.</summary>
    public bool Ready => Ran && (Built || (NoExecutable && RanByHand));

    /// <summary>How much earlier than the build or change a process may seem to have started (clock rounding).</summary>
    public static readonly TimeSpan StartTolerance = TimeSpan.FromSeconds(1);

    /// <summary>
    /// The status from a scan, the latest start seen of a process running the program, and the last "I ran it":
    /// built = the newest executable is at least as new as the newest compiled source (.cpp, .h …); ran = a run that
    /// started after that build and after the newest file the program reads when it runs (shaders, levels, images).
    /// "I ran it" counts only for a program built after the last change – or when no executable can be found at all.
    /// </summary>
    public static WatchStatus Evaluate(ProjectScan scan, DateTime? lastProcessStart, DateTime? ranByHandAt)
    {
        if (!scan.FolderExists) return None;
        var exe = scan.Newest;
        bool built = exe is not null && (scan.NewestCompiled is not { } compiled || exe.Modified >= compiled);
        DateTime? after = Latest(exe?.Modified, scan.NewestRuntime);
        if (exe is null) after = Latest(scan.NewestCompiled, scan.NewestRuntime);
        bool processRan = exe is not null && built && lastProcessStart is { } start && (after is not { } a || start >= a - StartTolerance);
        bool handRan = ranByHandAt is { } hand && (built || exe is null) && (after is not { } b || hand >= b);
        return new WatchStatus(true, exe?.Path, exe?.Modified, Latest(lastProcessStart, ranByHandAt), built, processRan || handRan, !processRan && handRan, scan.Fingerprint);
    }

    private static DateTime? Latest(DateTime? a, DateTime? b) => a is null ? b : b is null ? a : a > b ? a : b;
}
