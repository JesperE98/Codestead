namespace Codestead.Content.Game;

// The learner's course progress as the gamification sees it.

/// <summary>The learner's progress as the app sees it (built by the app; tests build it directly).</summary>
/// <param name="Tasks">Done task keys, every family.</param>
/// <param name="Checkpoints">Questions answered in the lessons.</param>
/// <param name="Exams">Best percentage per main chapter.</param>
/// <param name="CompleteLessons">Lessons that are complete (all tasks done and the chapter unlocked).</param>
/// <param name="TasksDone">Tasks done as the progress meter counts them.</param>
/// <param name="TasksTotal">All tasks as the progress meter counts them.</param>
public sealed record ProgressView(
    IReadOnlyCollection<string> Tasks,
    int Checkpoints,
    IReadOnlyDictionary<string, int> Exams,
    IReadOnlySet<string> CompleteLessons,
    int TasksDone,
    int TasksTotal);
