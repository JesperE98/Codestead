namespace Codestead.Content;

// The chapter "filer" (part "grunder"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Filer() =>
        new()
        {
            Id = "filer",
            Part = "grunder",
            Title = "Filer och kataloger",
            Tasks = new()
            {
                new()
                {
                    Id = "mkdir",
                    Text = "Skapa katalogen `~/{{project}}/src` med **ett** kommando.",
                    Hint = "`mkdir` behöver flaggan `-p` för att skapa `{{project}}` och `src` på en gång.",
                    Solution = Cmds("mkdir -p ~/{{project}}/src"),
                    Check = c => IsDir(c, "~/{{project}}/src"),
                },
                new()
                {
                    Id = "touch",
                    Text = "Skapa en tom fil som heter `~/{{project}}/README.md`.",
                    Solution = Cmds("touch ~/{{project}}/README.md"),
                    Check = c => IsFile(c, "~/{{project}}/README.md"),
                },
                new()
                {
                    Id = "cp",
                    Text = "Kopiera `~/{{notes}}` till katalogen `~/{{project}}/`.",
                    Solution = Cmds("cp ~/{{notes}} ~/{{project}}/"),
                    Check = c => IsFile(c, "~/{{project}}/{{notes}}") && IsFile(c, "~/{{notes}}"),
                },
                new()
                {
                    Id = "mv",
                    Text = "Byt namn på `~/{{project}}/{{notes}}` till `~/{{project}}/{{todo}}`.",
                    Hint = "Att byta namn är samma sak som att flytta – använd `mv`.",
                    Solution = Cmds("mv ~/{{project}}/{{notes}} ~/{{project}}/{{todo}}"),
                    Check = c => IsFile(c, "~/{{project}}/{{todo}}") && !Exists(c, "~/{{project}}/{{notes}}"),
                },
                new()
                {
                    Id = "rm",
                    Text = "Ta bort katalogen `~/{{old}}` och allt som finns i den.",
                    Hint = "Katalogen är inte tom, så `rmdir` räcker inte. Använd `rm -r`.",
                    Solution = Cmds("rm -r ~/{{old}}"),
                    Check = c => !Exists(c, "~/{{old}}"),
                },
            },
        };
}
