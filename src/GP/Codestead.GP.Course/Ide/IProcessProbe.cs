namespace Codestead.GP.Course.Ide;

/// <summary>Finds running programs started from some executables (the tests use a fake one).</summary>
public interface IProcessProbe
{
    /// <summary>When each running process started from one of <paramref name="executables"/> was started (UTC).</summary>
    IReadOnlyList<DateTime> StartTimes(IReadOnlyList<ExecutableFile> executables);
}
