namespace Codestead.GP.Course.Checks;

// The exercises' checks of in-practice, by chapter ("ex-…" ids; projects/<api>/<chapter>/exercises.txt). An exercise
// without a check here is ticked by the learner.
public static partial class TaskChecks
{
    private static Dictionary<string, Dictionary<string, TaskCheck>> ExercisesInPractice => new()
    {
    };
}
