using Codestead.Learning;
using Codestead.Learning.Game;

namespace Codestead.Content.Game;

/// <summary>The learning engine set up for the Linux course: its outline and its achievements.</summary>
public static class LinuxGame
{
    /// <summary>The parts, lessons and exams of the Linux course, for the engine.</summary>
    public static CourseOutline Outline { get; } = new(ChaptersLib.Parts
        .Select(p => new OutlinePart(p.Id, ChaptersLib.LessonsIn(p.Id).Select(l => l.Id).ToList(),
            ChaptersLib.Chapters.Any(c => c.Part == p.Id && c.Kind == ChapterKinds.Exam)))
        .ToList());

    public static GameRules Rules { get; } = new(Outline, AchievementsLib.All);

    /// <summary>The commands practised in a chapter: the ones in its tasks' solutions, in order.</summary>
    public static IReadOnlyList<string> ChapterCommands(Chapter ch, Distro d, World w)
    {
        var names = new List<string>();
        foreach (var task in ch.Tasks)
        {
            List<string> lines;
            try
            {
                lines = task.SolutionFor(d, w);
            }
            catch
            {
                continue;
            }
            foreach (var line in lines)
                foreach (var name in CommandInfo.Analyze(line, "", 0).Names)
                    if (!names.Contains(name)) names.Add(name);
        }
        return names;
    }
}
