using System.Text.RegularExpressions;

namespace Codestead.Shell.Tests;

/// <summary>The student's computer in the student's language (World.cs) and switching language (WorldMigration.cs).</summary>
public class WorldTests
{
    public static TheoryData<string> Languages() => new(World.Languages.OrderBy(l => l, StringComparer.Ordinal));

    [Theory(DisplayName = "världen har samma nycklar som engelskan och namn som går att skriva")]
    [MemberData(nameof(Languages))]
    public void WorldsAreComplete(string lang)
    {
        var en = World.Get("en");
        var w = World.Get(lang);
        Assert.Equal(lang, w.Lang);
        Assert.Equal(en.Names.Keys.Order(StringComparer.Ordinal), w.Names.Keys.Order(StringComparer.Ordinal));
        Assert.Equal(en.Words.Keys.Order(StringComparer.Ordinal), w.Words.Keys.Order(StringComparer.Ordinal));
        Assert.Equal(en.Files.Keys.Order(StringComparer.Ordinal), w.Files.Keys.Order(StringComparer.Ordinal));
        Assert.Matches(@"^[a-z]{2}_[A-Z]{2}\.UTF-8$", w.Locale);
        // Names are typed on any keyboard: ASCII, no spaces or shell characters.
        foreach (var (key, name) in w.Names)
            Assert.True(Regex.IsMatch(name, @"^[A-Za-z0-9][A-Za-z0-9._-]*$"), $"{lang}: \"{key}\" = \"{name}\" is not a plain ASCII name");
        // User, group and variable names follow the stricter rules of real Linux and bash.
        foreach (var key in new[] { "user", "devGroup", "tempUser" })
            Assert.True(Regex.IsMatch(w[key], "^[a-z_][a-z0-9_-]*$"), $"{lang}: \"{key}\" = \"{w[key]}\" is not a valid user or group name");
        foreach (var key in new[] { "sumVar", "favVar", "linesVar", "doubleFn", "fruitVar", "nameVar", "lineVar" })
            Assert.True(Regex.IsMatch(w[key], "^[A-Za-z_][A-Za-z0-9_]*$"), $"{lang}: \"{key}\" = \"{w[key]}\" is not a valid variable name");
        // The names of one folder must differ, or one file would hide another.
        foreach (var group in new[] { new[] { "notes", "documents", "old", "pictures", "webProject", "downloads", "project", "etcFiles", "helloScript", "helloFile", "unpacked", "fromZip", "exampleHtml", "report" }, new[] { "grades", "fruits" }, new[] { "oldNotes", "backup", "archive" } })
            Assert.True(group.Select(k => w[k]).Distinct().Count() == group.Length, $"{lang}: two exercise files have the same name in {string.Join(", ", group)}");
        // The checks rely on these: ten fruits, the first one three times; eight grades with the same points.
        var fruits = w.File("fruits").Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(10, fruits.Length);
        Assert.Equal(3, fruits.Count(f => f == fruits[0]));
        Assert.Equal(fruits[0], w["fruitWord"]);
        Assert.Equal(
            "87,64,92,45,78,95,58,71",
            string.Join(",", w.File("grades").Split('\n', StringSplitOptions.RemoveEmptyEntries).Skip(1).Select(l => l.Split(',')[2])));
        Assert.Contains("Linux", w.File("notes"));
        Assert.StartsWith("%PDF", w.File("report"));
        Assert.Contains(w["siteTitle"], w.File("webIndex"));
        Assert.Contains(w["siteTitle"], w.File("webReadme"));
    }

    [Fact(DisplayName = "en ny dator på engelska har engelska namn och användaren student")]
    public void EnglishComputer()
    {
        var sh = Shell.Create("ubuntu", "en");
        var root = sh.RootUser();
        Assert.Equal("student", sh.CurrentUser().Name);
        Assert.Equal("/home/student", sh.Cwd);
        Assert.Equal("en_US.UTF-8", sh.Env["LANG"]);
        Assert.StartsWith("apple\nbanana\n", sh.Vfs.TryLookup("/home/student/documents/fruits.txt", root)?.Content);
        Assert.NotNull(sh.Vfs.TryLookup("/home/student/Downloads/Calculator.AppImage", root));
        Assert.Contains("student:x:1000:1000:Student,,,:/home/student:/bin/bash", sh.Vfs.TryLookup("/etc/passwd", root)?.Content);
        Assert.Contains("student", sh.Execute("whoami").Output);
        Assert.Contains("student", sh.Proc.Procs.Select(p => p.User));
        // sort follows $LANG.
        Assert.Equal("apple", sh.Execute("sort documents/fruits.txt | head -n 1").Output.Trim());
    }

    [Fact(DisplayName = "byta språk översätter övningsfilerna och användaren på plats")]
    public void TranslateInPlace()
    {
        var sh = Shell.Create("ubuntu", "sv");
        var t = new Func<string, string>(line => Commands.UtilCmd.StripAnsi(sh.Execute(line).Output));
        t("echo mitt eget > dokument/egen.txt");
        t("echo ändrad >> anteckningar.txt");
        t("mkdir projekt && cp anteckningar.txt projekt/");
        t("cd dokument");
        WorldMigration.Translate(sh, "en");

        var root = sh.RootUser();
        Assert.Equal("en", sh.World.Lang);
        Assert.Equal("student", sh.CurrentUser().Name);
        Assert.Equal("/home/student/documents", sh.Cwd);
        Assert.Equal("/home/student", sh.Env["HOME"]);
        Assert.Equal("en_US.UTF-8", sh.Env["LANG"]);
        Assert.Null(sh.Vfs.TryLookup("/home/elev", root));
        // Exercise files: new names, and new text where it was untouched.
        Assert.StartsWith("apple\n", sh.Vfs.TryLookup("/home/student/documents/fruits.txt", root)?.Content);
        Assert.StartsWith("name,subject,points\n", sh.Vfs.TryLookup("/home/student/documents/grades.csv", root)?.Content);
        Assert.NotNull(sh.Vfs.TryLookup("/home/student/old/archive/log-2019.txt", root));
        Assert.NotNull(sh.Vfs.TryLookup("/home/student/Downloads/Calculator.AppImage", root));
        Assert.Contains("AppImage: Calculator", sh.Vfs.TryLookup("/home/student/Downloads/Calculator.AppImage", root)?.Content);
        // What the student wrote or changed stays as it is (the folder they made follows the new name).
        Assert.Equal("mitt eget\n", sh.Vfs.TryLookup("/home/student/documents/egen.txt", root)?.Content);
        Assert.EndsWith("ändrad\n", sh.Vfs.TryLookup("/home/student/notes.txt", root)?.Content);
        Assert.EndsWith("ändrad\n", sh.Vfs.TryLookup("/home/student/project/notes.txt", root)?.Content);
        // The account everywhere.
        Assert.Contains("student:x:1000:1000:Student,,,:/home/student:/bin/bash", sh.Vfs.TryLookup("/etc/passwd", root)?.Content);
        Assert.DoesNotContain("elev", sh.Vfs.TryLookup("/etc/group", root)?.Content);
        Assert.StartsWith("student:", sh.Vfs.TryLookup("/etc/shadow", root)?.Content?.Split('\n').Last(l => l != ""));
        Assert.Equal("student", sh.Vfs.TryLookup("/home/student/notes.txt", root)?.Owner);
        Assert.DoesNotContain(sh.Proc.Procs, p => p.User == "elev");
        Assert.DoesNotContain(sh.Services.Journal, e => System.Text.RegularExpressions.Regex.IsMatch(e.Msg, @"\belev\b"));
        Assert.Equal("student", t("whoami").Trim());
        Assert.Equal("root", t("sudo whoami").Split('\n', StringSplitOptions.RemoveEmptyEntries).Last());
        // And back: Swedish again.
        WorldMigration.Translate(sh, "sv");
        Assert.Equal("elev", sh.CurrentUser().Name);
        Assert.StartsWith("äpple\n", sh.Vfs.TryLookup("/home/elev/dokument/frukter.txt", root)?.Content);
        Assert.Equal("mitt eget\n", sh.Vfs.TryLookup("/home/elev/dokument/egen.txt", root)?.Content);
    }

    [Fact(DisplayName = "ett git-repo lämnas orört när språket byts")]
    public void GitRepoIsKept()
    {
        var sh = Shell.Create("ubuntu", "sv");
        sh.Execute("sudo apt update");
        sh.Execute("sudo apt install -y git");
        sh.Execute("git config --global user.name Elev && git config --global user.email elev@example.com");
        sh.Execute("cd projekt-webb && git init && git add . && git commit -qm första");
        WorldMigration.Translate(sh, "en");
        Assert.Equal("/home/student/web-project", sh.Cwd);
        Assert.Contains("Min webbplats", sh.Vfs.TryLookup("/home/student/web-project/README.md", sh.RootUser())?.Content);
        Assert.Equal("", Commands.UtilCmd.StripAnsi(sh.Execute("git status -s").Output));
    }

    [Fact(DisplayName = "en terminal sparad före världen blir svensk med nya programnamn")]
    public void LegacyTerminal()
    {
        // As saved by version 0.5.0: no "world", the old program names and Swedish system texts.
        var json = Shell.Create("ubuntu", "sv").SnapshotJson()
            .Replace("\"world\":\"sv\",", "", StringComparison.Ordinal)
            .Replace("myserver", "minserver", StringComparison.Ordinal)
            .Replace("reportd", "rapportd", StringComparison.Ordinal)
            .Replace(System.Text.Json.JsonSerializer.Serialize(InitfsLib.Bashrc)[1..^1], System.Text.Json.JsonSerializer.Serialize("# ~/.bashrc: körs av bash för interaktiva skal.\n# Här brukar man lägga alias och egna inställningar.\n\n# Exempel:\n# alias ll='ls -la'\n# export EDITOR=nano\n")[1..^1], StringComparison.Ordinal);
        Assert.DoesNotContain("\"world\"", json);
        Assert.Contains("minserver", json);
        var sh = Shell.RestoreJson(json)!;
        Assert.Equal("sv", sh.World.Lang);
        Assert.Equal("elev", sh.CurrentUser().Name);
        Assert.DoesNotContain("minserver", sh.SnapshotJson());
        Assert.DoesNotContain("rapportd", sh.SnapshotJson());
        Assert.NotNull(sh.Vfs.TryLookup("/usr/local/bin/myserver", sh.RootUser()));
        Assert.Equal(InitfsLib.Bashrc, sh.Vfs.TryLookup("/home/elev/.bashrc", sh.RootUser())?.Content);
        Assert.Equal(0, sh.Execute("systemctl status myserver").ExitCode);
    }
}
