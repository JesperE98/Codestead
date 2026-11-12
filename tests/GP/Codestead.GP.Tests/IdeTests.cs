using Codestead.GP.Course;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu;

namespace Codestead.GP.Tests;

/// <summary>
/// "Your project": the watcher's build and run detection on a folder with fake files and times (and a fake process
/// list), the reader that finds the learner's files, and the checker that runs the course's checks on them.
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

    /// <summary>A fake program: an ELF executable header (with the x bit) or, on Windows, a PE file named .exe.</summary>
    private string Executable(string relative, DateTime time)
    {
        if (OperatingSystem.IsWindows()) relative += ".exe";
        var path = Path.Combine(dir, relative.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var bytes = new byte[128];
        if (OperatingSystem.IsWindows())
        {
            bytes[0] = (byte)'M';
            bytes[1] = (byte)'Z';
        }
        else
        {
            bytes[0] = 0x7F;
            bytes[1] = (byte)'E';
            bytes[2] = (byte)'L';
            bytes[3] = (byte)'F';
            bytes[5] = 1;
            bytes[16] = 3; // ET_DYN: a position-independent executable
        }
        File.WriteAllBytes(path, bytes);
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path, File.GetUnixFileMode(path) | UnixFileMode.UserExecute);
        File.SetLastWriteTimeUtc(path, time);
        return path;
    }

    private WatchStatus Status(DateTime? run = null, DateTime? byHand = null) => WatchStatus.Evaluate(ProjectScan.Of(dir), run, byHand);

    [Fact(DisplayName = "körbara filer känns igen på sina första byte")]
    public void ExecutableFormats()
    {
        byte[] Elf(byte type) => [0x7F, (byte)'E', (byte)'L', (byte)'F', 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, type, 0, 0, 0];
        Assert.True(ProjectFiles.Kind(Elf(2), false));
        Assert.True(ProjectFiles.Kind(Elf(3), false));
        Assert.False(ProjectFiles.Kind(Elf(1), false)); // an object file
        Assert.True(ProjectFiles.Kind("MZ\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"u8, true));
        Assert.False(ProjectFiles.Kind("MZ\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"u8, false));
        byte[] mach = [0xCF, 0xFA, 0xED, 0xFE, 7, 0, 0, 1, 3, 0, 0, 0, 2, 0, 0, 0];
        Assert.True(ProjectFiles.Kind(mach, false));
        mach[12] = 6; // a dylib
        Assert.False(ProjectFiles.Kind(mach, false));
        Assert.False(ProjectFiles.Kind("#!/bin/sh\necho hi\n\0\0"u8, false));
    }

    [Fact(DisplayName = "inget program: väntar på ett bygge")]
    public void NothingBuilt()
    {
        Write("main.cpp", "int main() {}", T0);
        var s = Status();
        Assert.True(s.FolderExists);
        Assert.True(s.NoExecutable);
        Assert.False(s.Built);
        Assert.False(s.Ready);
    }

    [Fact(DisplayName = "ett program nyare än koden är byggt, och kört när en process startade efter bygget")]
    public void BuiltThenRun()
    {
        Write("main.cpp", "int main() {}", T0);
        Write("shaders/shader.vert", "void main() {}", T0);
        var exe = Executable("build/Debug/app", T0.AddSeconds(10));
        var built = Status();
        Assert.Equal(exe, built.Executable);
        Assert.True(built.Built);
        Assert.False(built.Ran);
        // A process that started before the build does not count; one after it does.
        Assert.False(Status(run: T0.AddSeconds(5)).Ran);
        var ran = Status(run: T0.AddSeconds(12));
        Assert.True(ran.Ran);
        Assert.True(ran.Ready);
        Assert.False(ran.RanByHand);
    }

    [Fact(DisplayName = "ändrad C++-kod kräver ett nytt bygge")]
    public void ChangedCodeNeedsBuild()
    {
        Executable("cmake-build-debug/app", T0);
        Write("main.cpp", "int main() { return 1; }", T0.AddSeconds(30));
        var s = Status(run: T0.AddSeconds(5));
        Assert.False(s.Built);
        Assert.False(s.Ready);
    }

    [Fact(DisplayName = "en ändrad shader kräver bara en ny körning, inget bygge")]
    public void ChangedShaderNeedsRunOnly()
    {
        Write("main.cpp", "int main() {}", T0);
        Executable("out/build/x64-Debug/app", T0.AddSeconds(10));
        Write("shader.fs", "void main() {}", T0.AddSeconds(60));
        var before = Status(run: T0.AddSeconds(20));
        Assert.True(before.Built);
        Assert.False(before.Ran);
        Assert.True(Status(run: T0.AddSeconds(61)).Ready);
    }

    [Fact(DisplayName = "byggmappar och IDE-mappar räknas inte som källkod")]
    public void BuildFoldersAreNotSources()
    {
        Write("main.cpp", "int main() {}", T0);
        Executable("build/app", T0.AddSeconds(10));
        // CMake copies the shaders to the build folder after building; the IDE keeps its own files.
        Write("build/shader.vert", "copy", T0.AddSeconds(20));
        Write(".vs/cache.h", "x", T0.AddSeconds(30));
        Write("x64/Debug/generated.cpp", "x", T0.AddSeconds(30));
        // CMake's compiler checks build small programs: they are not the learner's.
        Executable("build/CMakeFiles/3.28.3/CompilerIdCXX/a.out", T0.AddSeconds(40));
        var s = Status(run: T0.AddSeconds(11));
        Assert.True(s.Built);
        Assert.True(s.Ready);
        Assert.EndsWith("app" + (OperatingSystem.IsWindows() ? ".exe" : ""), s.Executable);
    }

    [Fact(DisplayName = "en ändring av källkoden ger ett nytt fingeravtryck")]
    public void Fingerprint()
    {
        var main = Write("main.cpp", "int main() {}", T0);
        var a = ProjectScan.Of(dir).Fingerprint;
        Assert.Equal(a, ProjectScan.Of(dir).Fingerprint);
        File.SetLastWriteTimeUtc(main, T0.AddSeconds(1));
        Assert.NotEqual(a, ProjectScan.Of(dir).Fingerprint);
    }

    [Fact(DisplayName = "\"Jag har kört det\" kräver ett program nyare än koden – utom när inget program finns")]
    public void RanByHand()
    {
        Write("main.cpp", "int main() {}", T0);
        // No program anywhere (built in WSL, on another computer …): the learner's word counts.
        var none = Status(byHand: T0.AddSeconds(5));
        Assert.True(none.Ready);
        Assert.True(none.RanByHand);
        // An old program: build first.
        Executable("build/app", T0.AddSeconds(-60));
        Assert.False(Status(byHand: T0.AddSeconds(5)).Ready);
        Executable("build/app", T0.AddSeconds(10));
        Assert.False(Status(byHand: T0.AddSeconds(5)).Ready);
        Assert.True(Status(byHand: T0.AddSeconds(11)).Ready);
    }

    private sealed class FakeProbe : IProcessProbe
    {
        public DateTime? Start;
        public IReadOnlyList<DateTime> StartTimes(IReadOnlyList<ExecutableFile> executables) => Start is { } s && executables.Count > 0 ? [s] : [];
    }

    [Fact(DisplayName = "bevakaren ser bygget och körningen")]
    public async Task WatcherSeesBuildAndRun()
    {
        var probe = new FakeProbe();
        var now = DateTime.UtcNow;
        Write("main.cpp", "int main() {}", now.AddSeconds(-30));
        using var watcher = new ProjectWatcher(dir, probe, TimeSpan.FromMilliseconds(100), TimeSpan.FromMilliseconds(50));
        await Until(() => watcher.Status.FolderExists && watcher.Status.NoExecutable);
        Executable("build/app", now.AddSeconds(-20));
        await Until(() => watcher.Status is { Built: true, Ran: false });
        probe.Start = now.AddSeconds(-10);
        await Until(() => watcher.Status.Ready);
        Assert.False(watcher.Status.RanByHand);
        // A change to the code: build again.
        Write("main.cpp", "int main() { return 0; }", now);
        await Until(() => !watcher.Status.Built && !watcher.Status.Ready);
    }

    private static async Task Until(Func<bool> condition)
    {
        var until = DateTime.UtcNow.AddSeconds(15);
        while (!condition())
        {
            Assert.True(DateTime.UtcNow < until, "timed out");
            await Task.Delay(20);
        }
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
        var start = ProjectChecker.Check(dir, chapter, api, "a");
        Assert.Equal("a", start.Fingerprint);
        Assert.Equal(count, start.Tasks.Count);
        Assert.Contains(start.Tasks, t => !t.Passed);
        Assert.NotNull(start.Facts);
        StartFiles.Copy(dir, ExpectedResult.Project(chapter, api, count - 1));
        var solved = ProjectChecker.Check(dir, chapter, api, "b");
        Assert.All(solved.Tasks, t => Assert.True(t.Passed, t.TaskId));
        Assert.Empty(solved.Messages);
    }

    [Fact(DisplayName = "kontrollen säger vad som är fel när koden inte går att läsa")]
    public void CheckerExplainsFailures()
    {
        StartFiles.Copy(dir, GpCourse.StartProject("hello-triangle", Apis.OpenGL));
        var main = Path.Combine(dir, "main.cpp");
        File.WriteAllText(main, File.ReadAllText(main).Replace("glClear(", "glClaer("));
        var report = ProjectChecker.Check(dir, "hello-triangle", Apis.OpenGL, "x");
        Assert.All(report.Tasks, t => Assert.False(t.Passed));
        Assert.Contains(report.Messages, m => m.Key == "ide.buildFailed" && m.IsError);
        File.Delete(main);
        var missing = ProjectChecker.Check(dir, "hello-triangle", Apis.OpenGL, "y");
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
