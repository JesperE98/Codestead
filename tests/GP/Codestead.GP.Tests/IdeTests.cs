using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;

namespace Codestead.GP.Tests;

/// <summary>
/// "Your project": the reader that finds the learner's files from the main file they picked, in a structure of their
/// own, and the checker that runs the course's checks on them.
/// </summary>
public sealed class IdeTests : IDisposable
{
    private readonly string dir = Directory.CreateTempSubdirectory("codestead-gp-ide-").FullName;
    private static readonly DateTime T0 = new(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc);

    public void Dispose()
    {
        try
        {
            Directory.Delete(dir, true);
        }
        catch (IOException)
        {
        }
    }

    private string Write(string relative, string text, DateTime time)
    {
        var path = Path.Combine(dir, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, text);
        File.SetLastWriteTimeUtc(path, time);
        return path;
    }

    [Fact(DisplayName = "läsaren hittar kapitlets filer, även med annat namn på huvudfilen, och inte biblioteken")]
    public void ReaderFindsTheLearnersFiles()
    {
        var start = GpCourse.StartProject("hello-triangle", Apis.OpenGL);
        var main = start.MainFile;
        // Visual Studio names the main file after the project; GLAD's and stb's files are libraries.
        Write("src/HelloTriangle.cpp", start.Files[main], T0);
        Write("include/glad/glad.c", "int main() { }", T0);
        Write("build/main.cpp", "// a copy in the build folder", T0);
        foreach (var (path, text) in start.Files.Where(f => f.Key != main)) Write("src/" + path, text, T0);
        var read = ProjectReader.Read(dir, "hello-triangle", Apis.OpenGL);
        Assert.Empty(read.Missing);
        Assert.Equal(start.Files[main], read.Project.Files[main]);
        Assert.Equal(start.Files.Keys.Order(), read.Project.Files.Keys.Order());
    }

    [Fact(DisplayName = "från huvudfilen: filerna bredvid den, under den eller i mappen ovanför, i en egen mappstruktur")]
    public void ReaderStartsFromTheMainFile()
    {
        var start = GpCourse.StartProject("textures", Apis.OpenGL);
        var main = start.MainFile;
        Assert.True(start.Files.Count > 1, "textures has shaders");
        // The learner's own layout: one folder for the course, the chapter's code in src/04-textures.cpp, its shaders
        // in a folder beside src/; another chapter's main.cpp next to it is not read.
        var file = Write("course/src/04-textures.cpp", start.Files[main], T0);
        Write("course/src/main.cpp", "int main() { return 1; }", T0);
        foreach (var (path, text) in start.Files.Where(f => f.Key != main)) Write("course/" + path, text, T0);
        var read = ProjectReader.ReadFrom(file, "textures", Apis.OpenGL);
        Assert.Empty(read.Missing);
        Assert.Equal(start.Files[main], read.Project.Files[main]);
        Assert.Equal(start.Files.Keys.Order(), read.Project.Files.Keys.Order());
        // The check passes the same tasks as for the course's own layout.
        var report = ProjectChecker.Check(file, "textures", Apis.OpenGL);
        Assert.DoesNotContain(report.Messages, m => m.IsError);
    }

    [Fact(DisplayName = "startfilerna kopieras, och konflikter syns")]
    public void StartFilesCopy()
    {
        var start = GpCourse.StartProject("textures", Apis.OpenGL);
        Assert.Empty(StartFiles.Conflicts(dir, start));
        int n = StartFiles.Copy(dir, start);
        Assert.Equal(start.Files.Count + start.Assets.Count, n);
        Assert.Empty(StartFiles.Conflicts(dir, start));
        File.WriteAllText(Path.Combine(dir, start.MainFile), "// changed");
        Assert.Equal([start.MainFile], StartFiles.Conflicts(dir, start));
    }

    [Fact(DisplayName = "kontrollen: startprojektet löser inte alla uppgifter, lösningen löser alla")]
    public void CheckerRunsTheTaskChecks()
    {
        const string chapter = "hello-triangle";
        var api = Apis.OpenGL;
        int count = GpCourse.Tasks(chapter, api).Count;
        StartFiles.Copy(dir, GpCourse.StartProject(chapter, api));
        var main = Path.Combine(dir, GpCourse.StartProject(chapter, api).MainFile);
        var start = ProjectChecker.Check(main, chapter, api);
        Assert.Equal(count, start.Tasks.Count);
        Assert.Contains(start.Tasks, t => !t.Passed);
        Assert.NotNull(start.Facts);
        StartFiles.Copy(dir, ExpectedResult.Project(chapter, api, count - 1));
        var solved = ProjectChecker.Check(main, chapter, api);
        Assert.All(solved.Tasks, t => Assert.True(t.Passed, t.TaskId));
        Assert.Empty(solved.Messages);
    }

    [Fact(DisplayName = "kontrollen säger vad som är fel när koden inte går att läsa")]
    public void CheckerExplainsFailures()
    {
        StartFiles.Copy(dir, GpCourse.StartProject("hello-triangle", Apis.OpenGL));
        var main = Path.Combine(dir, "main.cpp");
        File.WriteAllText(main, File.ReadAllText(main).Replace("glClear(", "glClaer("));
        var report = ProjectChecker.Check(main, "hello-triangle", Apis.OpenGL);
        Assert.All(report.Tasks, t => Assert.False(t.Passed));
        Assert.Contains(report.Messages, m => m.Key == "ide.buildFailed" && m.IsError);
        File.Delete(main);
        var missing = ProjectChecker.Check(main, "hello-triangle", Apis.OpenGL);
        Assert.Contains(missing.Messages, m => m.Key == "ide.missing" && m.Args["files"].Contains("main.cpp"));
    }

    [Fact(DisplayName = "förväntat resultat: varje uppgifts lösning visar en bild")]
    public void ExpectedResultShows()
    {
        foreach (var api in Apis.All)
            for (int i = 0; i < GpCourse.Tasks("hello-triangle", api.Id).Count; i++)
                Assert.True(ExpectedResult.Scene("hello-triangle", api.Id, i) is { ShowsFrames: true }, $"{api.Id} task {i}");
    }
}
