namespace Codestead.Content;

// The chapter "distributioner" (part "distro"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Distributioner() =>
        new()
        {
            Id = "distributioner",
            Part = "distro",
            Title = "Distributioner och familjer",
            Tasks = new()
            {
                new()
                {
                    Id = "os-release",
                    PerFamily = true,
                    Text = "Ta reda på namnet och versionen på distributionen du kör.",
                    Solution = Cmds("cat /etc/os-release"),
                    Check = c => Ran(c, Re(@"\/etc\/os-release")),
                },
                new()
                {
                    Id = "kernel",
                    PerFamily = true,
                    Text = "Visa vilken version av Linuxkärnan som körs.",
                    Solution = Cmds("uname -r"),
                    Check = c => Ran(c, Re(@"^uname\s+-\w*[ra]")),
                },
                new()
                {
                    Id = "pm-config",
                    PerFamily = true,
                    Text = ByFamily(
                        debian: "Titta på vilka förråd apt använder i `/etc/apt/sources.list.d/`.",
                        arch: "Titta på pacmans inställningar i `/etc/pacman.conf`.",
                        redhat: "Titta på vilka förråd dnf använder i `/etc/yum.repos.d/`."),
                    Solution = ByFamily(
                        debian: Cmds("ls /etc/apt/sources.list.d"),
                        arch: Cmds("cat /etc/pacman.conf"),
                        redhat: Cmds("ls /etc/yum.repos.d")),
                    Check = c =>
                    {
                        var re = c.Distro.Family switch
                        {
                            "debian" => Re(@"\/etc\/apt\b"),
                            "arch" => Re(@"\/etc\/pacman"),
                            "redhat" => Re(@"\/etc\/(yum\.repos\.d|dnf)\b"),
                            _ => null,
                        };
                        return Ran(c, Re(@"^(ls|cat|less|head|tail|tree|find)\b")) && re!.IsMatch(c.Line);
                    },
                },
            },
        };
}
