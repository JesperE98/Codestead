namespace Codestead.Learning.UI;

/// <summary>A variant group of a task counted per group: its label, the progress key and whether it is the current one.</summary>
public sealed record TaskChip(string Label, string Key, bool Current);
