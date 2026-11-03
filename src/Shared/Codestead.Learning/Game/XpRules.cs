namespace Codestead.Learning.Game;

// How much XP each kind of progress gives.

/// <summary>
/// XP rules. XP is computed from what has been done (never added up step by step), so nothing can be
/// paid twice. The whole course gives about 3 900 XP with one distribution family, more with hints
/// avoided, every family and perfect exams.
/// </summary>
public static class XpRules
{
    public const int Task = 10, Unaided = 5, Checkpoint = 2, Chapter = 25, Part = 50, ExamPass = 100, ExamPerfect = 50;

    public static int Total(GameState g, ProgressView p) =>
        Task * p.Tasks.Count + Unaided * g.Unaided.Count + Checkpoint * p.Checkpoints
        + Chapter * g.CompletedChapters.Count + Part * g.CompletedParts.Count
        + ExamPass * g.ExamsPassed.Count + ExamPerfect * g.ExamsPerfect.Count;
}
