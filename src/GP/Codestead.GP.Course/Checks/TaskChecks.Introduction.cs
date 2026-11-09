namespace Codestead.GP.Course.Checks;

// The introduction: run the finished triangle program, then change its colour (in every API).
public static partial class TaskChecks
{
    /// <summary>The orange of the course's first triangle: (1.0, 0.5, 0.2).</summary>
    private static bool Orange(CheckContext c, double x, double y) => c.PixelIs(x, y, 1.0, 0.5, 0.2);

    private static Dictionary<string, TaskCheck> Introduction => new()
    {
        ["build-run"] = c => c.Shows && c.Drew,
        ["color"] = c => c.DrawnAt(0.5, 0.55) && !Orange(c, 0.5, 0.55),
    };
}
