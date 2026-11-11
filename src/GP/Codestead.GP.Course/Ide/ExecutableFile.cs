namespace Codestead.GP.Course.Ide;

/// <summary>An executable in the learner's folder: its full path, when it was written (UTC) and its size.</summary>
public sealed record ExecutableFile(string Path, DateTime Modified, long Size);
