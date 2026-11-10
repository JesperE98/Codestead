using Codestead.GP.Gpu;

namespace Codestead.GP.Course;

/// <summary>
/// The tasks of a chapter, read from projects/&lt;api&gt;/&lt;chapter&gt;/edits.txt, and applying their edits. The format
/// (see src/GP/verify/apply_edits.py, which checks it against solution/):
/// <code>
/// === task: render-loop
/// --- file: main.cpp
/// --- find:
///     // TODO: the render loop
/// --- replace:
///     while (!glfwWindowShouldClose(window)) { … }
/// </code>
/// </summary>
public static class Edits
{
    public static List<CourseTask> Parse(string text)
    {
        var tasks = new List<(string Id, List<TaskEdit> Edits)>();
        string? file = null;
        List<string>? find = null, replace = null, current = null;
        void Flush()
        {
            if (file is not null && find is not null && replace is not null && tasks.Count > 0)
                tasks[^1].Edits.Add(new TaskEdit(file, Trim(find), Trim(replace)));
            file = null;
            find = replace = current = null;
        }
        foreach (var line in text.Replace("\r\n", "\n").Split('\n'))
        {
            if (line.StartsWith("=== task:", StringComparison.Ordinal))
            {
                Flush();
                tasks.Add((line[9..].Trim(), new List<TaskEdit>()));
            }
            else if (line.StartsWith("--- file:", StringComparison.Ordinal))
            {
                Flush();
                file = line[9..].Trim();
            }
            else if (line.Trim() == "--- find:") current = find = new List<string>();
            else if (line.Trim() == "--- replace:") current = replace = new List<string>();
            else current?.Add(line);
        }
        Flush();
        return tasks.Select(t => new CourseTask(t.Id, t.Edits)).ToList();
    }

    private static string Trim(List<string> lines)
    {
        int n = lines.Count;
        while (n > 0 && lines[n - 1] == "") n--;
        return string.Join("\n", lines.Take(n));
    }

    /// <summary>Where an edit stands in a project: done (the new code is there), can be applied (the old code is there), or neither.</summary>
    public static EditState StateOf(GpuProject project, TaskEdit edit)
    {
        if (!project.Files.TryGetValue(edit.File, out var text)) return EditState.NotApplicable;
        if (edit.Replace.Length > 0 && Normalize(text).Contains(Normalize(edit.Replace), StringComparison.Ordinal)) return EditState.Done;
        return text.Contains(edit.Find, StringComparison.Ordinal) ? EditState.Applicable : EditState.NotApplicable;
    }

    /// <summary>Applies an edit; returns the offset and length of the new code, or null when it could not be applied.</summary>
    public static (int Start, int Length)? Apply(GpuProject project, TaskEdit edit)
    {
        if (!project.Files.TryGetValue(edit.File, out var text)) return null;
        int at = text.IndexOf(edit.Find, StringComparison.Ordinal);
        if (at < 0 || edit.Find.Length == 0) return null;
        project.Files[edit.File] = text[..at] + edit.Replace + text[(at + edit.Find.Length)..];
        return (at, edit.Replace.Length);
    }

    /// <summary>Whitespace collapsed, for "is this code already there" comparisons.</summary>
    public static string Normalize(string s) => System.Text.RegularExpressions.Regex.Replace(s, @"\s+", " ").Trim();
}
