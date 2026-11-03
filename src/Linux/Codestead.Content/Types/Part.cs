namespace Codestead.Content;

// A main chapter ("part") of the course.

/// <summary>A main chapter ("part"), e.g. "The basics". Its sub-chapters are the <see cref="Chapter"/>s with this part id.</summary>
public partial class Part
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    /// <summary>
    /// The only main chapter where the student picks a distribution. Everywhere else the terminal runs
    /// <see cref="ChaptersLib.DefaultDistro"/>, so the basics are learnt without distribution differences.
    /// </summary>
    public bool DistroChoice { get; set; }
}
