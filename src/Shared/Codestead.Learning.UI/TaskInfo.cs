namespace Codestead.Learning.UI;

/// <summary>A task as the window shows it, already in the learner's language and variant.</summary>
/// <param name="Key">The key its progress is saved under.</param>
/// <param name="Text">The task (markdown).</param>
/// <param name="Hint">The hint (markdown), or null.</param>
/// <param name="Solution">Commands that solve it (shown after a few attempts or the hint).</param>
/// <param name="Chips">For a task counted per variant group: one chip per group (e.g. Debian, Arch, Red Hat).</param>
public sealed record TaskInfo(string Key, string Text, string? Hint, IReadOnlyList<string> Solution, IReadOnlyList<TaskChip> Chips);
