namespace Codestead.GP.YourProject;

/// <summary>Where a task stands in the "Your project" panel.</summary>
public enum TaskState
{
    /// <summary>The text comes first.</summary>
    Locked,
    /// <summary>Not done: the learner ticks it, or checks their code.</summary>
    Open,
    Checking,
    /// <summary>The last check of the code did not pass it.</summary>
    NotYet,
    Done,
}
