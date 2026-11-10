using Codestead.GP.Gpu;
using Codestead.Learning;

namespace Codestead.GP.Course;

/// <summary>
/// The Codestead GP course: learnopengl.com's structure, section by section, for OpenGL, Vulkan and DirectX 12.
/// Parts and lessons are listed here in course order; each part ends with a summary and an exam when their texts
/// exist (chapters/en/&lt;part&gt;-summary.md and -exam.md).
/// </summary>
public static class GpCourse
{
    public static IReadOnlyList<string> Parts { get; } = ["start", "getting-started", "lighting", "model-loading", "advanced-opengl", "advanced-lighting", "pbr", "in-practice"];

    /// <summary>The lessons in course order: (chapter id, part).</summary>
    private static readonly (string Id, string Part)[] LessonList =
    [
        ("introduction", "start"),
        ("api", "getting-started"),
        ("creating-a-window", "getting-started"),
        ("hello-window", "getting-started"),
        ("hello-triangle", "getting-started"),
        ("shaders", "getting-started"),
        ("textures", "getting-started"),
        ("transformations", "getting-started"),
        ("coordinate-systems", "getting-started"),
        ("camera", "getting-started"),
        ("colors", "lighting"),
        ("basic-lighting", "lighting"),
        ("materials", "lighting"),
        ("lighting-maps", "lighting"),
        ("light-casters", "lighting"),
        ("multiple-lights", "lighting"),
        ("assimp", "model-loading"),
        ("mesh", "model-loading"),
        ("model", "model-loading"),
        ("depth-testing", "advanced-opengl"),
        ("stencil-testing", "advanced-opengl"),
        ("blending", "advanced-opengl"),
        ("face-culling", "advanced-opengl"),
        ("framebuffers", "advanced-opengl"),
        ("cubemaps", "advanced-opengl"),
        ("advanced-data", "advanced-opengl"),
        ("advanced-glsl", "advanced-opengl"),
        ("geometry-shader", "advanced-opengl"),
        ("instancing", "advanced-opengl"),
        ("anti-aliasing", "advanced-opengl"),
        ("advanced-lighting", "advanced-lighting"),
        ("gamma-correction", "advanced-lighting"),
        ("shadow-mapping", "advanced-lighting"),
        ("point-shadows", "advanced-lighting"),
        ("normal-mapping", "advanced-lighting"),
        ("parallax-mapping", "advanced-lighting"),
        ("hdr", "advanced-lighting"),
        ("bloom", "advanced-lighting"),
        ("deferred-shading", "advanced-lighting"),
        ("ssao", "advanced-lighting"),
        ("pbr-theory", "pbr"),
        ("pbr-lighting", "pbr"),
        ("diffuse-irradiance", "pbr"),
        ("specular-ibl", "pbr"),
        ("debugging", "in-practice"),
        ("text-rendering", "in-practice"),
        ("game-intro", "in-practice"),
        ("game-setup", "in-practice"),
        ("rendering-sprites", "in-practice"),
        ("levels", "in-practice"),
        ("ball", "in-practice"),
        ("collision-detection", "in-practice"),
        ("collision-resolution", "in-practice"),
        ("particles", "in-practice"),
    ];

    public static IReadOnlyList<CourseChapter> Chapters { get; } = Build();

    private static List<CourseChapter> Build()
    {
        var list = new List<CourseChapter>();
        foreach (var part in Parts)
        {
            list.AddRange(LessonList.Where(l => l.Part == part).Select(l => new CourseChapter(l.Id, part, ChapterKinds.Lesson)));
            foreach (var kind in new[] { ChapterKinds.Summary, ChapterKinds.Exam })
                if (Resources.Read($"chapters/en/{part}-{kind}.md") is not null) list.Add(new CourseChapter($"{part}-{kind}", part, kind));
        }
        return list;
    }

    public static CourseChapter Chapter(string id) => Chapters.FirstOrDefault(c => c.Id == id) ?? Chapters[0];

    public static IReadOnlyList<CourseChapter> LessonsIn(string part) => Chapters.Where(c => c.Part == part && c.IsLesson).ToList();

    public static CourseOutline Outline { get; } = new(Parts
        .Select(p => new OutlinePart(p, LessonsIn(p).Select(l => l.Id).ToList(), Chapters.Any(c => c.Part == p && c.Kind == ChapterKinds.Exam)))
        .ToList());

    /// <summary>The progress key of a task for an API: "hello-window/clear@vulkan".</summary>
    public static string TaskKey(string chapterId, string taskId, string api) => $"{chapterId}/{taskId}@{api}";

    /// <summary>The tasks of a chapter for an API (none for summaries and exams).</summary>
    public static IReadOnlyList<CourseTask> Tasks(string chapterId, string api)
    {
        lock (TaskCache)
        {
            var key = $"{api}/{chapterId}";
            if (!TaskCache.TryGetValue(key, out var tasks))
                TaskCache[key] = tasks = Resources.Read($"projects/{api}/{chapterId}/edits.txt") is { } text ? Edits.Parse(text) : [];
            return tasks;
        }
    }

    private static readonly Dictionary<string, List<CourseTask>> TaskCache = new(StringComparer.Ordinal);

    /// <summary>The project a chapter starts with for an API (a lesson without its own project uses the previous one's).</summary>
    public static GpuProject StartProject(string chapterId, string api)
    {
        var chapters = Chapters.ToList();
        for (int i = chapters.FindIndex(c => c.Id == chapterId); i >= 0; i--)
        {
            var prefix = $"projects/{api}/{chapters[i].Id}/start/";
            var files = Resources.List(prefix).ToList();
            if (files.Count == 0) continue;
            var text = files.Where(f => !IsAsset(f)).ToList();
            var project = new GpuProject(Order(text.Select(f => new KeyValuePair<string, string>(f[prefix.Length..], Resources.Read(f) ?? ""))));
            foreach (var f in files.Where(IsAsset)) project.Assets[f[prefix.Length..]] = Resources.ReadBytes(f) ?? [];
            return project;
        }
        return new GpuProject(new Dictionary<string, string> { ["main.cpp"] = "" });
    }

    /// <summary>Binary files of a project (images), loaded as assets rather than code.</summary>
    public static bool IsAsset(string path) =>
        new[] { ".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf" }.Any(e => path.EndsWith(e, StringComparison.OrdinalIgnoreCase));

    /// <summary>main.cpp first, then headers, then shaders – the order of the editor's tabs.</summary>
    private static IEnumerable<KeyValuePair<string, string>> Order(IEnumerable<KeyValuePair<string, string>> files) =>
        files.OrderBy(f => Path.GetFileName(f.Key) == "main.cpp" ? 0 : f.Key.EndsWith(".h", StringComparison.Ordinal) ? 1 : f.Key.Contains("vert", StringComparison.Ordinal) || f.Key.EndsWith(".vs", StringComparison.Ordinal) ? 2 : 3)
            .ThenBy(f => f.Key, StringComparer.Ordinal);

    /// <summary>The API functions a chapter's solutions use, in order (shown when the chapter is done).</summary>
    public static IReadOnlyList<string> Functions(string chapterId, string api)
    {
        var names = new List<string>();
        var re = new System.Text.RegularExpressions.Regex(api switch
        {
            Apis.Vulkan => @"\b(vk[A-Z]\w*|glfw[A-Z]\w*)\s*\(",
            Apis.D3D12 => @"(?:->|\b)(D3D12\w+|CreateDXGIFactory\w*|D3DCompileFromFile|Create\w+|Clear\w+|Draw\w+|IASet\w+|RSSet\w+|OMSet\w+|Present|ResourceBarrier|ExecuteCommandLists|Signal|SetGraphicsRoot\w+)\s*\(",
            _ => @"\b(gl[A-Z]\w*|glfw[A-Z]\w*|gladLoadGLLoader)\s*\(",
        });
        foreach (var task in Tasks(chapterId, api))
            foreach (var edit in task.Edits)
                foreach (System.Text.RegularExpressions.Match m in re.Matches(edit.Replace))
                    if (!names.Contains(m.Groups[1].Value) && !edit.Find.Contains(m.Groups[1].Value + "(", StringComparison.Ordinal)) names.Add(m.Groups[1].Value);
        return names;
    }
}
