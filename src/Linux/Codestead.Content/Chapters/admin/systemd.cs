namespace Codestead.Content;

// The chapter "systemd" (part "admin"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Systemd() =>
        new()
        {
            Id = "systemd",
            Part = "admin",
            Title = "Tjänster och loggar med systemd",
            Tasks = new()
            {
                new()
                {
                    Id = "status-ssh",
                    Text = "Visa status för SSH-servern med `systemctl status`. Tänk på vad tjänsten heter i Ubuntu!",
                    Hint = "I Ubuntu heter tjänsten `ssh`: `systemctl status ssh`.",
                    Solution = Cmds("systemctl status ssh"),
                    Check = c =>
                        Re(@"\bsystemctl\b.*\bstatus\b").IsMatch(c.Line) && c.Output.Contains("ssh.service - "),
                },
                new()
                {
                    Id = "failed",
                    Text = "En tjänst verkar inte ha startat. Lista alla tjänster som har misslyckats (*failed*).",
                    Hint = "`systemctl --failed` (eller `systemctl list-units --state=failed`).",
                    Solution = Cmds("systemctl --failed"),
                    Check = c => Ran(c, Re(@"\bsystemctl\b.*(--failed|--state[= ]\S*failed)")) && c.Output.Contains("loaded units listed"),
                },
                new()
                {
                    Id = "journal-err",
                    Text = "Visa bara felmeddelandena (prioritet *err* och allvarligare) från den här uppstarten i journalen.",
                    Hint = "`-p err` väljer prioritet och `-b` den senaste uppstarten: `journalctl -p err -b`.",
                    Solution = Cmds("journalctl -p err -b"),
                    Check = c =>
                        Ran(c, Re(@"\bjournalctl\b")) &&
                        Re(@"(^|\s)(-\w*p\s*|--priority[= ])(err|error|3|0\.\.3|emerg\.\.err)(\s|$)").IsMatch(c.Line) &&
                        Re(@"(^|\s)(-\w*b\w*|--boot)\b").IsMatch(c.Line),
                },
                new()
                {
                    Id = "journal-u",
                    Text = "Läs loggen för den trasiga tjänsten `reportd` med `journalctl`. Varför startar den inte?",
                    Hint = "`-u` visar bara raderna från en tjänst: `journalctl -u reportd`. Med `-xe` hoppar du till slutet och får förklaringar.",
                    Solution = Cmds("journalctl -u reportd"),
                    Check = c => Ran(c, Re(@"\bjournalctl\b.*\breportd\b")) && c.Output.Contains("reportd.conf"),
                },
                new()
                {
                    Id = "fix",
                    Text = "Rätta felet som loggen berättar om och starta sedan om `reportd` med `systemctl`, så att den kör.",
                    Hint = "Konfigurationsfilen saknas, men det finns ett exempel: `sudo cp /etc/reportd.conf.example /etc/reportd.conf`. Starta sedan om med `sudo systemctl restart reportd`.",
                    Solution = Cmds("sudo cp /etc/reportd.conf.example /etc/reportd.conf", "sudo systemctl restart reportd"),
                    Check = c => Re(@"\bsystemctl\b.*\breportd\b").IsMatch(c.Line) && c.Sh.Services.Units.Get("reportd.service")?.Active == "active",
                },
                new()
                {
                    Id = "start-myserver",
                    Text = "Starta tjänsten `myserver` (om den inte redan kör) och visa sedan dess status. Vilket PID fick den?",
                    Hint = "`sudo systemctl start myserver` och sedan `systemctl status myserver`.",
                    Solution = Cmds("sudo systemctl start myserver", "systemctl status myserver"),
                    Check = c => Ran(c, Re(@"\bsystemctl\b.*\bstatus\b.*\bmyserver\b")) && c.Output.Contains("active (running)"),
                },
                new()
                {
                    Id = "stop",
                    Text = "Stoppa `myserver` med `systemctl`. Kontrollera gärna med `pgrep myserver` att processen är borta.",
                    Hint = "`sudo systemctl stop myserver`",
                    Solution = Cmds("sudo systemctl stop myserver", "pgrep myserver"),
                    Check = c =>
                        Ran(c, Re(@"\bsystemctl\b.*\bstop\b.*\bmyserver\b")) && !c.Sh.Proc.Procs.Any(p => p.Cmd.Contains("/myserver")),
                },
                new()
                {
                    Id = "enable",
                    Text = "Se till att `myserver` startar automatiskt varje gång datorn startar – och starta den nu också, med ett enda kommando.",
                    Hint = "`enable` gäller vid uppstart och `--now` startar den direkt: `sudo systemctl enable --now myserver`.",
                    Solution = Cmds("sudo systemctl enable --now myserver"),
                    Check = c =>
                        Re(@"\bsystemctl\b.*\benable\b").IsMatch(c.Line) &&
                        IsFile(c, "/etc/systemd/system/multi-user.target.wants/myserver.service") &&
                        c.Sh.Services.Units.Get("myserver.service")?.Active == "active",
                },
            },
        };
}
