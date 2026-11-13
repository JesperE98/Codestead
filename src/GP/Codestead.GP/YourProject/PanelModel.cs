namespace Codestead.GP.YourProject;

/// <summary>Everything the "Your project" panel shows, already in the learner's language where it is text.</summary>
public sealed record PanelModel(
    string ChapterId,
    string Api,
    string ApiName,
    string? MainFile,
    bool FileMissing,
    bool HasOldCode,
    bool Checking,
    string? CheckSummary,
    IReadOnlyList<string> CheckMessages,
    bool AllPassed,
    IReadOnlyList<TaskRow> Tasks,
    int SelectedTask,
    string? LockNote = null,
    (int Done, int Total) Questions = default);
