namespace Codestead.GP.YourProject;

/// <summary>A task in the panel's status list: its number, a short title, its state and why it is not done yet.</summary>
public sealed record TaskRow(int Index, string Title, TaskState State, IReadOnlyList<string> Messages);
