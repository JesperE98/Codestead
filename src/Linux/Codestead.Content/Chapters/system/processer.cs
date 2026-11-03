namespace Codestead.Content;

// The chapter "processer" (part "system"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Processer() =>
        new()
        {
            Id = "processer",
            Part = "system",
            Title = "Processer och jobb",
            Tasks = new()
            {
                new()
                {
                    Id = "ps",
                    Text = "Visa processerna i din egen terminal med `ps`.",
                    Solution = Cmds("ps"),
                    Check = c => Ran(c, Re(@"^ps\s*$")),
                },
                new()
                {
                    Id = "ps-aux",
                    Text = "Lista **alla** processer på datorn.",
                    Hint = "`ps aux` (eller `ps -ef`).",
                    Solution = Cmds("ps aux"),
                    Check = c => Ran(c, Re(@"^ps\s+(-?aux|-ef|-e|-A)\b")) && c.Output.Contains("/sbin/init"),
                },
                new()
                {
                    Id = "hitta",
                    Text = "En process slukar nästan all CPU. Visa processerna sorterade efter CPU-användning så att du ser vad den heter.",
                    Hint = "`top`, `htop` eller `ps aux --sort=-%cpu`.",
                    Solution = Cmds("ps aux --sort=-%cpu"),
                    Check = c => Ran(c, Re(@"^(top|htop)\b|^ps\b.*--sort[= ]-?%?(cpu|pcpu)")) && c.Output.Contains(Js.Num(ProcsLib.RunawayPid)),
                },
                new()
                {
                    Id = "kill",
                    Text = $"Stoppa den skenande processen (PID {Js.Num(ProcsLib.RunawayPid)}) med `kill`.",
                    Solution = Cmds($"kill {Js.Num(ProcsLib.RunawayPid)}"),
                    Check = c => !c.Sh.Proc.Procs.Any(p => p.Pid == ProcsLib.RunawayPid),
                },
                new()
                {
                    Id = "bakgrund",
                    Text = "Starta `sleep 300` i bakgrunden.",
                    Hint = "Sätt `&` sist på raden.",
                    Solution = Cmds("sleep 300 &"),
                    Check = c => c.Sh.Proc.Jobs.Any(j => j.State == "Running" && Re(@"^sleep\s+300\b").IsMatch(j.Cmd)),
                },
                new()
                {
                    Id = "jobs",
                    Text = "Visa dina bakgrundsjobb.",
                    Solution = Cmds("jobs"),
                    Check = c => Ran(c, Re(@"^jobs\b")) && c.Output.Contains("sleep"),
                },
                new()
                {
                    Id = "kill-jobb",
                    Text = "Avsluta bakgrundsjobbet med `kill` och jobbnumret (`%1`) eller dess PID.",
                    Solution = Cmds("kill %1"),
                    Check = c => Ran(c, Re(@"^kill\b")) && Re("Terminated|Killed").IsMatch(c.Output),
                },
                new()
                {
                    Id = "nohup",
                    Text = "Starta `sleep 600` i bakgrunden med `nohup`, så att det skulle fortsätta även om du loggade ut.",
                    Hint = "`nohup sleep 600 &` – `nohup` först och `&` sist.",
                    Solution = Cmds("nohup sleep 600 &"),
                    Check = c => c.Sh.Proc.Jobs.Any(j => j.State == "Running" && Re(@"^nohup\s+sleep\s+600\b").IsMatch(j.Cmd)),
                },
                new()
                {
                    Id = "server",
                    Text = "Servern `myserver` körs som root. Stoppa den – med `pkill` eller `kill` och rätt behörighet.",
                    Hint = "Som vanlig användare får du \"Operation not permitted\". Sätt `sudo` framför.",
                    Solution = Cmds("sudo pkill myserver"),
                    Check = c => !c.Sh.Proc.Procs.Any(p => p.Pid == ProcsLib.ServerPid),
                },
            },
        };
}
