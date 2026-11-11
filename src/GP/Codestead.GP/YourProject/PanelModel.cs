using Codestead.GP.Course.Ide;

namespace Codestead.GP.YourProject;

/// <summary>Everything the "Your project" panel shows, already in the learner's language where it is text.</summary>
public sealed record PanelModel(
    string ChapterId,
    string Api,
    string ApiName,
    string? Folder,
    bool FolderMissing,
    string? Suggestion,
    bool HasOldCode,
    WatchStatus Status,
    bool Checking,
    string StatusLine,
    IReadOnlyList<TaskRow> Tasks,
    int SelectedTask);
