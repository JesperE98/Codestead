using Codestead.Shell.Commands;

namespace Codestead.Content;

// The chapter "git" (part "verktyg"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Git() =>
        new()
        {
            Id = "git",
            Part = "verktyg",
            Title = "Git i terminalen",
            Tasks = new()
            {
                new()
                {
                    Id = "installera",
                    Text = "Installera paketet `git`.",
                    Hint = "Kör `sudo apt update` och sedan `sudo apt install git`.",
                    Solution = Cmds("sudo apt update", "sudo apt install git"),
                    Check = c => Installed(c, "git"),
                },
                new()
                {
                    Id = "identitet",
                    Text = "Berätta för git vem du är: ställ in ditt namn (`user.name`) och din e-postadress (`user.email`) med `git config --global`.",
                    Hint = "Två kommandon: `git config --global user.name \"Ditt Namn\"` och `git config --global user.email \"du@example.com\"`.",
                    Solution = Cmds("git config --global user.name \"{{gitName}}\"", "git config --global user.email \"{{user}}@example.com\""),
                    Check = c =>
                        !string.IsNullOrEmpty(GitCmd.GitGlobalConfig(c.Sh, Home(c), "user.name")) &&
                        !string.IsNullOrEmpty(GitCmd.GitGlobalConfig(c.Sh, Home(c), "user.email")),
                },
                new()
                {
                    Id = "init",
                    Text = "Gå till katalogen `~/{{webProject}}` och gör den till ett git-repo med `git init`.",
                    Hint = "`cd ~/{{webProject}}` och sedan `git init`. Titta gärna på den nya dolda katalogen med `ls -a`.",
                    Solution = Cmds("cd ~/{{webProject}}", "git init"),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+init\b")) && GitCmd.GitRepoState(c.Sh, Web(c)) is not null,
                },
                new()
                {
                    Id = "forsta-commit",
                    Text = "Lägg till alla tre filerna i indexet med `git add` och gör din första commit med ett beskrivande meddelande.",
                    Hint = "`git add .` lägger till allt i katalogen. Sedan `git commit -m \"{{commitFirst}}\"`. Kolla läget med `git status` före och efter!",
                    Solution = Cmds("cd ~/{{webProject}}", "git add .", "git commit -m \"{{commitFirst}}\""),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web(c));
                        return !string.IsNullOrEmpty(s?.Head) && new[] { "index.html", "style.css", "README.md" }.All(f => s.Files.Contains(f));
                    },
                },
                new()
                {
                    Id = "diff",
                    Text = "Lägg till en rad i slutet av `README.md` och titta på ändringen med `git diff`.",
                    Hint = "`echo '{{builtWith}}' >> README.md` och sedan `git diff`. Rader som börjar med `+` är nya.",
                    Solution = Cmds("cd ~/{{webProject}}", "echo '{{builtWith}}' >> README.md", "git diff"),
                    Check = c => Ran(c, Re(@"(^|[;&|]\s*)git\s+diff\b")) && OutLines(c).Any(l => Re(@"^\+(?!\+\+ )").IsMatch(l)),
                },
                new()
                {
                    Id = "commit-a",
                    Text = "Committa ändringen i `README.md`. Prova flaggan `-a`, som tar med alla ändrade filer som git redan följer.",
                    Hint = "`git commit -a -m \"{{commitDescribe}}\"` – eller kortare `git commit -am \"…\"`.",
                    Solution = Cmds("cd ~/{{webProject}}", "git commit -am \"{{commitDescribe}}\""),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+commit\b")) && (GitCmd.GitRepoState(c.Sh, Web(c))?.Commits ?? 0) >= 2,
                },
                new()
                {
                    Id = "gren",
                    Text = "Skapa grenen `{{newDesign}}` och byt till den. Ändra något i `style.css` och committa ändringen på den nya grenen.",
                    Hint = "`git switch -c {{newDesign}}` skapar grenen och byter till den. Ändra sedan t.ex. med `echo 'h1 { color: purple; }' >> style.css` och kör `git commit -am \"{{commitPurple}}\"`.",
                    Solution = Cmds("cd ~/{{webProject}}", "git switch -c {{newDesign}}", "echo 'h1 { color: purple; }' >> style.css", "git commit -am \"{{commitPurple}}\""),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web(c));
                        var design = s?.Branches.Get(W(c)["newDesign"]);
                        var main = s is null ? null : s.Branches.Get("main") ?? s.Branches.Get("master");
                        return !string.IsNullOrEmpty(design) && !string.IsNullOrEmpty(main) && !GitCmd.GitIsAncestor(c.Sh, Web(c), design, main);
                    },
                },
                new()
                {
                    Id = "merge",
                    Text = "Byt tillbaka till `main` och slå ihop grenen `{{newDesign}}` med `git merge`.",
                    Hint = "`git switch main` och sedan `git merge {{newDesign}}`. Eftersom `main` inte ändrats sedan du skapade grenen blir det en *fast-forward*.",
                    Solution = Cmds("cd ~/{{webProject}}", "git switch main", "git merge {{newDesign}}"),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web(c));
                        var design = s?.Branches.Get(W(c)["newDesign"]);
                        return
                            Ran(c, Re(@"(^|[;&]\s*)git\s+(merge|pull)\b")) &&
                            !string.IsNullOrEmpty(s?.Head) &&
                            (s.Branch == "main" || s.Branch == "master") &&
                            !string.IsNullOrEmpty(design) &&
                            GitCmd.GitIsAncestor(c.Sh, Web(c), design, s.Head);
                    },
                },
                new()
                {
                    Id = "logg",
                    Text = "Visa historiken med en rad per commit med `git log --oneline`.",
                    Hint = "Prova också `git log --oneline --graph --all` för att se grenarna.",
                    Solution = Cmds("cd ~/{{webProject}}", "git log --oneline"),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+log\b.*--oneline")) && OutLines(c).Count >= 3,
                },
            },
        };
}
