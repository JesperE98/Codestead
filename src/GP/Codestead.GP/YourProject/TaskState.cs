namespace Codestead.GP.YourProject;

/// <summary>Where a task stands in the "Your project" panel.</summary>
public enum TaskState
{
    Locked,
    NeedsFolder,
    WaitingForBuild,
    WaitingForRun,
    Checking,
    NotYet,
    Done,
}
