using Codestead.Shell.Commands;

namespace Codestead.Content;

// The chapter definitions from src/content/chapters.ts (CHAPTERS), in the same order as the TypeScript.
// Texts, hints and solutions are kept byte for byte.

public static partial class ChaptersLib
{
    private static List<Chapter> DefineChapters() => new()
    {
        new()
        {
            Id = "valkommen",
            Part = "start",
            Title = "Välkommen till Linux-shell",
            Tasks = new()
            {
                new()
                {
                    Id = "echo",
                    Text = "Skriv ut texten `Hej världen` med `echo`.",
                    Solution = Cmds("echo Hej världen"),
                    Check = c => Ran(c, Re(@"^echo\b")) && Re(@"hej,?\s+världen", "i").IsMatch(c.Output),
                },
                new()
                {
                    Id = "whoami",
                    Text = "Ta reda på vilken användare du är inloggad som, med `whoami`.",
                    Solution = Cmds("whoami"),
                    Check = c => Ran(c, Re(@"^whoami\s*$")),
                },
                new()
                {
                    Id = "os-release",
                    Text = "Visa vilken distribution du kör med `cat /etc/os-release`.",
                    Solution = Cmds("cat /etc/os-release"),
                    Check = c => Ran(c, Re(@"^cat\s+\/etc\/os-release\s*$")),
                },
                new()
                {
                    Id = "help",
                    Text = "Lista alla kommandon som finns i simulatorn med `help`.",
                    Solution = Cmds("help"),
                    Check = c => Ran(c, Re(@"^help\b")),
                },
            },
        },
        new()
        {
            Id = "navigera",
            Part = "grunder",
            Title = "Navigera i filsystemet",
            Tasks = new()
            {
                new()
                {
                    Id = "etc",
                    Text = "Gå till katalogen `/etc` och lista vad som finns där.",
                    Hint = "Två kommandon: först `cd`, sedan `ls`. Du kan också skriva dem på samma rad: `cd /etc && ls`.",
                    Solution = Cmds("cd /etc", "ls"),
                    Check = c => Ran(c, Re(@"(^|[;&|]\s*)ls(\s|$)")) && c.Sh.Cwd == "/etc",
                },
                new()
                {
                    Id = "hidden",
                    Text = "Visa de dolda filerna i din hemkatalog.",
                    Hint = "Flaggan `-a` visar filer som börjar med punkt. Din hemkatalog är `~`.",
                    Solution = Cmds("ls -a ~"),
                    Check = c => Ran(c, Re(@"^ls\b.*\s-\w*[aA]")) && (c.Sh.Cwd == Home || Re(@"\s(~\/?|\/home\/elev\/?)(\s|$)").IsMatch(c.Line)),
                },
                new()
                {
                    Id = "relative",
                    Text = "Ställ dig i roten (`/`) och gå sedan till `/var/log` med en **relativ** sökväg.",
                    Hint = "En relativ sökväg börjar inte med `/`. Står du i `/` räcker `cd var/log`.",
                    Solution = Cmds("cd /", "cd var/log"),
                    Check = c => c.Sh.Cwd == "/var/log" && Re(@"(^|[;&]\s*)cd\s+(\.\/)?var\/log\/?\s*$").IsMatch(c.Line),
                },
                new()
                {
                    Id = "up",
                    Text = "Gå upp en nivå med `cd ..`.",
                    Solution = Cmds("cd .."),
                    Check = c => Ran(c, Re(@"^cd\s+\.\.\/?\s*$")),
                },
                new()
                {
                    Id = "home",
                    Text = "Gå tillbaka till din hemkatalog med bara `cd`, utan argument.",
                    Solution = Cmds("cd"),
                    Check = c => c.Line == "cd" && c.Sh.Cwd == Home,
                },
            },
        },
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
                    Text = "Skapa katalogen `~/projekt/src` med **ett** kommando.",
                    Hint = "`mkdir` behöver flaggan `-p` för att skapa `projekt` och `src` på en gång.",
                    Solution = Cmds("mkdir -p ~/projekt/src"),
                    Check = c => IsDir(c, "~/projekt/src"),
                },
                new()
                {
                    Id = "touch",
                    Text = "Skapa en tom fil som heter `~/projekt/README.md`.",
                    Solution = Cmds("touch ~/projekt/README.md"),
                    Check = c => IsFile(c, "~/projekt/README.md"),
                },
                new()
                {
                    Id = "cp",
                    Text = "Kopiera `~/anteckningar.txt` till katalogen `~/projekt/`.",
                    Solution = Cmds("cp ~/anteckningar.txt ~/projekt/"),
                    Check = c => IsFile(c, "~/projekt/anteckningar.txt") && IsFile(c, "~/anteckningar.txt"),
                },
                new()
                {
                    Id = "mv",
                    Text = "Byt namn på `~/projekt/anteckningar.txt` till `~/projekt/att-gora.txt`.",
                    Hint = "Att byta namn är samma sak som att flytta – använd `mv`.",
                    Solution = Cmds("mv ~/projekt/anteckningar.txt ~/projekt/att-gora.txt"),
                    Check = c => IsFile(c, "~/projekt/att-gora.txt") && !Exists(c, "~/projekt/anteckningar.txt"),
                },
                new()
                {
                    Id = "rm",
                    Text = "Ta bort katalogen `~/gammalt` och allt som finns i den.",
                    Hint = "Katalogen är inte tom, så `rmdir` räcker inte. Använd `rm -r`.",
                    Solution = Cmds("rm -r ~/gammalt"),
                    Check = c => !Exists(c, "~/gammalt"),
                },
            },
        },
        new()
        {
            Id = "lasa-text",
            Part = "grunder",
            Title = "Läsa och söka i text",
            Tasks = new()
            {
                new()
                {
                    Id = "head",
                    Text = "Visa de **3 första** raderna i `~/dokument/server.log`.",
                    Solution = Cmds("head -n 3 ~/dokument/server.log"),
                    Check = c => Ran(c, Re(@"^head\b")) && OutLines(c).Count == 3 && c.Output.Contains("Servern startar"),
                },
                new()
                {
                    Id = "tail",
                    Text = "Visa de **2 sista** raderna i `~/dokument/server.log`.",
                    Solution = Cmds("tail -n 2 ~/dokument/server.log"),
                    Check = c => Ran(c, Re(@"^tail\b")) && OutLines(c).Count == 2 && c.Output.Contains("roteras"),
                },
                new()
                {
                    Id = "grep",
                    Text = "Visa alla rader som innehåller `ERROR` i `~/dokument/server.log`.",
                    Solution = Cmds("grep ERROR ~/dokument/server.log"),
                    Check = c => Ran(c, Re(@"^grep\b")) && OutLines(c).Count == 3 && OutLines(c).All(l => l.Contains("ERROR")),
                },
                new()
                {
                    Id = "grep-i",
                    Text = "Sök efter `warn` i server.log **utan** att bry dig om stora eller små bokstäver.",
                    Hint = "Flaggan `-i` gör sökningen skiftlägesokänslig. Det ska bli 3 träffar.",
                    Solution = Cmds("grep -i warn ~/dokument/server.log"),
                    Check = c => Ran(c, Re(@"^grep\b.*\s-\w*i")) && Re("warn", "i").IsMatch(c.Line) && (OutLines(c).Count == 3 || c.Output.Trim() == "3"),
                },
                new()
                {
                    Id = "wc",
                    Text = "Räkna hur många rader `~/dokument/frukter.txt` har.",
                    Solution = Cmds("wc -l ~/dokument/frukter.txt"),
                    Check = c => Ran(c, Re(@"\bwc\b.*-\w*l")) && Re(@"\b10\b").IsMatch(c.Output),
                },
                new()
                {
                    Id = "sort",
                    Text = "Visa frukterna i `~/dokument/frukter.txt` i bokstavsordning.",
                    Solution = Cmds("sort ~/dokument/frukter.txt"),
                    Check = c => Ran(c, Re(@"\bsort\b")) && Re("frukter").IsMatch(c.Line) && OutLines(c).At(0) == "apelsin",
                },
            },
        },
        new()
        {
            Id = "pipes",
            Part = "grunder",
            Title = "Omdirigering och pipes",
            Tasks = new()
            {
                new()
                {
                    Id = "redirect",
                    Text = "Skriv texten `Hej från shell` till filen `~/hej.txt` med `echo` och `>`.",
                    Solution = Cmds("echo \"Hej från shell\" > ~/hej.txt"),
                    Check = c => Content(c, "~/hej.txt").Contains("Hej från shell"),
                },
                new()
                {
                    Id = "append",
                    Text = "Lägg till en rad till i `~/hej.txt` – utan att skriva över den första.",
                    Hint = "Använd `>>` i stället för `>`.",
                    Solution = Cmds("echo \"En rad till\" >> ~/hej.txt"),
                    Check = c =>
                    {
                        var lines = Content(c, "~/hej.txt").Split('\n').Where(l => l != "").ToList();
                        return lines.Count >= 2 && lines[0].Contains("Hej från shell");
                    },
                },
                new()
                {
                    Id = "count-errors",
                    Text = "Räkna antalet rader med `ERROR` i server.log genom att skicka `grep` vidare till `wc -l` med en pipe.",
                    Solution = Cmds("grep ERROR ~/dokument/server.log | wc -l"),
                    Check = c => Ran(c, Re(@"grep.*\|\s*wc\s+-l")) && c.Output.Trim() == "3",
                },
                new()
                {
                    Id = "uniq",
                    Text = "Visa hur många gånger varje frukt förekommer i `frukter.txt`, med `sort` och `uniq -c`.",
                    Solution = Cmds("sort ~/dokument/frukter.txt | uniq -c"),
                    Check = c => Ran(c, Re(@"sort.*\|\s*uniq\s+-c")) && Re("3 äpple").IsMatch(c.Output),
                },
                new()
                {
                    Id = "save-ls",
                    Text = "Spara en lista över filerna i `/etc` i filen `~/etc-filer.txt`.",
                    Solution = Cmds("ls /etc > ~/etc-filer.txt"),
                    Check = c => Content(c, "~/etc-filer.txt").Contains("os-release"),
                },
                new()
                {
                    Id = "devnull",
                    Text = "Kör `ls /finnsinte`, men skicka felmeddelandet till `/dev/null` så att inget syns.",
                    Solution = Cmds("ls /finnsinte 2> /dev/null"),
                    Check = c => Re(@"^ls\s+\/finnsinte\b.*2>\s*\/dev\/null").IsMatch(c.Line) && c.Output.Trim() == "",
                },
            },
        },
        new()
        {
            Id = "textbearbetning",
            Part = "grunder",
            Title = "Textbearbetning med sed, tr och awk",
            Tasks = new()
            {
                new()
                {
                    Id = "sed-s",
                    Text = "Visa `~/dokument/server.log` med ordet `ERROR` utbytt mot `FEL` på alla rader, med `sed`.",
                    Hint = "Kommandot `s/gammalt/nytt/` byter ut text: `sed 's/ERROR/FEL/' fil`",
                    Solution = Cmds("sed 's/ERROR/FEL/' ~/dokument/server.log"),
                    Check = c =>
                        Ran(c, Re(@"^sed\b")) && OutLines(c).Count == 15 && Re("FEL Kunde inte ansluta").IsMatch(c.Output) && !c.Output.Contains("ERROR"),
                },
                new()
                {
                    Id = "sed-d",
                    Text = "Visa server.log **utan** alla rader som innehåller `INFO`, med `sed`.",
                    Hint = "Adressen `/INFO/` väljer raderna och kommandot `d` tar bort dem: `sed '/INFO/d' fil`",
                    Solution = Cmds("sed '/INFO/d' ~/dokument/server.log"),
                    Check = c => Ran(c, Re(@"^sed\b")) && OutLines(c).Count == 6 && !c.Output.Contains("INFO"),
                },
                new()
                {
                    Id = "tr-upper",
                    Text = "Skriv ut alla användarnamn i `/etc/passwd` med **versaler**: plocka ut fält 1 med `cut` och skicka vidare till `tr`.",
                    Hint = "`cut -d: -f1 /etc/passwd` ger användarnamnen. Lägg till `| tr a-z A-Z`.",
                    Solution = Cmds("cut -d: -f1 /etc/passwd | tr a-z A-Z"),
                    Check = c => Ran(c, Re(@"\|\s*tr\b")) && OutLines(c).Contains("ROOT") && OutLines(c).Contains("ELEV"),
                },
                new()
                {
                    Id = "tr-path",
                    Text = "Visa katalogerna i `$PATH` på **varsin rad** genom att byta `:` mot radbrytning med `tr`.",
                    Hint = "Radbrytning skrivs `\\n`: `echo $PATH | tr ':' '\\n'`",
                    Solution = Cmds("echo $PATH | tr ':' '\\n'"),
                    Check = c => Ran(c, Re(@"\btr\b")) && OutLines(c).Count >= 2 && OutLines(c).Contains("/usr/bin"),
                },
                new()
                {
                    Id = "awk-print",
                    Text = "Skriv ut användarnamn och skal (fält 1 och 7) ur `/etc/passwd` med `awk`.",
                    Hint = "Fälten skiljs åt av kolon, så använd `-F:`. Programmet blir `'{print $1, $7}'`.",
                    Solution = Cmds("awk -F: '{print $1, $7}' /etc/passwd"),
                    Check = c =>
                        Ran(c, Re(@"^awk\b")) && OutLines(c).Any(l => Re(@"^elev\b.*\/bin\/bash$").IsMatch(l) && !l.Contains("1000")),
                },
                new()
                {
                    Id = "awk-sum",
                    Text = "Räkna ut **summan** av poängen (kolumn 3) i `~/dokument/betyg.csv` med `awk`.",
                    Hint = "Hoppa över rubrikraden med `NR > 1`, lägg ihop med `summa += $3` och skriv ut i `END { }`. Avgränsaren är komma: `-F,`.",
                    Solution = Cmds("awk -F, 'NR > 1 {summa += $3} END {print summa}' ~/dokument/betyg.csv"),
                    Check = c => Ran(c, Re(@"\bawk\b")) && Re(@"(^|\D)590(\D|$)").IsMatch(c.Output),
                },
                new()
                {
                    Id = "sed-i",
                    Text = "Byt ut `Linux` mot `GNU/Linux` **direkt i filen** `~/anteckningar.txt`.",
                    Hint = "Använd `sed -i`. Eftersom ersättningen innehåller `/` är det enklast att byta avgränsare: `s|Linux|GNU/Linux|`.",
                    Solution = Cmds("sed -i 's|Linux|GNU/Linux|' ~/anteckningar.txt"),
                    Check = c =>
                        c.ExitCode == 0 && Re(@"^sed\b.*\s-\w*i").IsMatch(Unsudo(c.Line)) && Content(c, "~/anteckningar.txt").Contains("GNU/Linux"),
                },
            },
        },
        new()
        {
            Id = "miljo",
            Part = "system",
            Title = "Variabler, PATH och alias",
            Tasks = new()
            {
                new()
                {
                    Id = "path",
                    Text = "Visa innehållet i variabeln `PATH`.",
                    Solution = Cmds("echo $PATH"),
                    Check = c => Ran(c, Re(@"^(echo|printenv)\b.*PATH")) && c.Output.Contains("/usr/bin"),
                },
                new()
                {
                    Id = "export",
                    Text = "Skapa miljövariabeln `FAVORIT` med värdet `linux`.",
                    Hint = "Inga mellanslag runt likhetstecknet: `export NAMN=värde`.",
                    Solution = Cmds("export FAVORIT=linux"),
                    Check = c => Env(c, "FAVORIT") == "linux",
                },
                new()
                {
                    Id = "which",
                    Text = "Ta reda på i vilken katalog programmet `ls` ligger.",
                    Solution = Cmds("which ls"),
                    Check = c => Ran(c, Re(@"^(which|type)\s+ls\b")) && c.Output.Contains("/usr/bin/ls"),
                },
                new()
                {
                    Id = "alias",
                    Text = "Skapa aliaset `ll` som kör `ls -la`.",
                    Solution = Cmds("alias ll='ls -la'"),
                    Check = c => Re(@"^ls\s+-(la|al)$").IsMatch(c.Sh.Aliases.Get("ll") ?? ""),
                },
                new()
                {
                    Id = "exitcode",
                    Text = "Kör ett kommando som misslyckas, och visa sedan dess slutkod med `echo $?`.",
                    Hint = "Prova `ls /finnsinte` följt av `echo $?`. Slutkoden ska inte vara 0.",
                    Solution = Cmds("ls /finnsinte", "echo $?"),
                    Check = c => Re(@"(^|[;&]\s*)echo\s+""?\$\?""?\s*$").IsMatch(c.Line) && Re(@"^[1-9]\d*$").IsMatch(c.Output.Trim()),
                },
            },
        },
        new()
        {
            Id = "rattigheter",
            Part = "system",
            Title = "Användare, rättigheter och sudo",
            Tasks = new()
            {
                new()
                {
                    Id = "groups",
                    Text = "Ta reda på vilka grupper du tillhör.",
                    Solution = Cmds("groups"),
                    Check = c => Ran(c, Re(@"^(groups|id)\b")),
                },
                new()
                {
                    Id = "shadow",
                    Text = "Försök läsa `/etc/shadow` med `cat` – och gör det sedan med `sudo`.",
                    Solution = Cmds("cat /etc/shadow", "sudo cat /etc/shadow"),
                    Check = c => Ran(c, Re(@"^sudo\s+(cat|less|head|tail)\s+\/etc\/shadow\s*$")),
                },
                new()
                {
                    Id = "script",
                    Text = "Skapa skriptet `~/hej.sh` som innehåller raden `echo Hej från mitt skript`.",
                    Hint = "Använd enkla citattecken: `echo 'echo Hej från mitt skript' > ~/hej.sh`",
                    Solution = Cmds("echo 'echo Hej från mitt skript' > ~/hej.sh"),
                    Check = c => Re(@"echo\s+.*Hej från mitt skript").IsMatch(Content(c, "~/hej.sh")),
                },
                new()
                {
                    Id = "chmod-x",
                    Text = "Gör `~/hej.sh` körbart.",
                    Solution = Cmds("chmod +x ~/hej.sh"),
                    Check = c => (Mode(c, "~/hej.sh") & Js.Oct(100)) != 0,
                },
                new()
                {
                    Id = "run-script",
                    Text = "Kör skriptet med `./hej.sh` (stå i hemkatalogen).",
                    Solution = Cmds("cd ~", "./hej.sh"),
                    Check = c => Ran(c, Re(@"(\.\/|~\/|\/home\/elev\/)hej\.sh\s*$")) && c.Output.Contains("Hej från mitt skript"),
                },
                new()
                {
                    Id = "chmod-600",
                    Text = "Gör `~/anteckningar.txt` läsbar och skrivbar **bara** för dig (`rw-------`).",
                    Hint = "r = 4, w = 2, x = 1. Ägaren ska ha 4 + 2 och övriga 0.",
                    Solution = Cmds("chmod 600 ~/anteckningar.txt"),
                    Check = c => (Mode(c, "~/anteckningar.txt") & Js.Oct(777)) == Js.Oct(600),
                },
            },
        },
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
                    Id = "server",
                    Text = "Servern `minserver` körs som root. Stoppa den – med `pkill` eller `kill` och rätt behörighet.",
                    Hint = "Som vanlig användare får du \"Operation not permitted\". Sätt `sudo` framför.",
                    Solution = Cmds("sudo pkill minserver"),
                    Check = c => !c.Sh.Proc.Procs.Any(p => p.Pid == ProcsLib.ServerPid),
                },
            },
        },
        new()
        {
            Id = "arkiv",
            Part = "system",
            Title = "Arkiv och komprimering",
            Tasks = new()
            {
                new()
                {
                    Id = "tar-czf",
                    Text = "Packa ihop katalogen `~/dokument` till det komprimerade arkivet `~/dokument.tar.gz`.",
                    Hint = "Stå i hemkatalogen och använd *create zipped verbose file*: `tar -czvf dokument.tar.gz dokument`.",
                    Solution = Cmds("cd ~", "tar -czvf dokument.tar.gz dokument"),
                    Check = c => ArchiveHas(c, "~/dokument.tar.gz", "tar.gz", "dokument/frukter.txt"),
                },
                new()
                {
                    Id = "tar-t",
                    Text = "Lista innehållet i `~/dokument.tar.gz` – utan att packa upp det.",
                    Hint = "`t` betyder lista: `tar -tzvf ~/dokument.tar.gz`.",
                    Solution = Cmds("tar -tzvf ~/dokument.tar.gz"),
                    Check = c => Ran(c, Re(@"\btar\b")) && TarOps(c.Line) == "t" && c.Output.Contains("dokument/server.log"),
                },
                new()
                {
                    Id = "tar-x",
                    Text = "Skapa katalogen `~/uppackat` och packa upp `~/dokument.tar.gz` i den.",
                    Hint = "Med `-C` väljer du var tar packar upp: `tar -xzvf ~/dokument.tar.gz -C ~/uppackat`.",
                    Solution = Cmds("mkdir ~/uppackat", "tar -xzvf ~/dokument.tar.gz -C ~/uppackat"),
                    Check = c => TarOps(c.Line).Contains('x') && IsFile(c, "~/uppackat/dokument/frukter.txt"),
                },
                new()
                {
                    Id = "gzip",
                    Text = "Kopiera `~/dokument/server.log` till din hemkatalog och komprimera kopian med `gzip`, så att du får `~/server.log.gz`.",
                    Hint = "Först `cp ~/dokument/server.log ~`, sedan `gzip ~/server.log`.",
                    Solution = Cmds("cp ~/dokument/server.log ~", "gzip -v ~/server.log"),
                    Check = c => ArchiveCmd.GunzipString(Content(c, "~/server.log.gz"))?.D.Contains("Servern startar") ?? false,
                },
                new()
                {
                    Id = "zcat",
                    Text = "Visa raderna med `ERROR` i `~/server.log.gz` – utan att packa upp filen.",
                    Hint = "`zcat` skriver ut innehållet i en .gz-fil. Skicka det vidare till `grep` med en pipe.",
                    Solution = Cmds("zcat ~/server.log.gz | grep ERROR"),
                    Check = c =>
                        Ran(c, Re(@"\bzcat\b|\bgunzip\s+-\w*c|\bgzip\s+-\w*(d\w*c|c\w*d)")) &&
                        IsFile(c, "~/server.log.gz") &&
                        ((OutLines(c).Count == 3 && OutLines(c).All(l => l.Contains("ERROR"))) || c.Output.Trim() == "3"),
                },
                new()
                {
                    Id = "zip",
                    Text = "Installera paketen `zip` och `unzip`, och packa sedan ihop `~/dokument` till `~/dokument.zip`.",
                    Hint = "Kör `sudo apt update` och `sudo apt install zip unzip`. Glöm inte `-r` till zip: `zip -r dokument.zip dokument`.",
                    Solution = Cmds("sudo apt update", "sudo apt install zip unzip", "cd ~", "zip -r dokument.zip dokument"),
                    Check = c => ArchiveHas(c, "~/dokument.zip", "zip", "dokument/frukter.txt"),
                },
                new()
                {
                    Id = "unzip",
                    Text = "Packa upp `~/dokument.zip` i den nya katalogen `~/fran-zip` med `unzip`.",
                    Hint = "`-d` väljer katalog och skapar den om den saknas: `unzip ~/dokument.zip -d ~/fran-zip`.",
                    Solution = Cmds("unzip ~/dokument.zip -d ~/fran-zip"),
                    Check = c =>
                        Re(@"\bunzip\b").IsMatch(c.Line) &&
                        (IsFile(c, "~/fran-zip/dokument/frukter.txt") || IsFile(c, "~/fran-zip/home/elev/dokument/frukter.txt")),
                },
            },
        },
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
                    Text = "Läs loggen för den trasiga tjänsten `rapportd` med `journalctl`. Varför startar den inte?",
                    Hint = "`-u` visar bara raderna från en tjänst: `journalctl -u rapportd`. Med `-xe` hoppar du till slutet och får förklaringar.",
                    Solution = Cmds("journalctl -u rapportd"),
                    Check = c => Ran(c, Re(@"\bjournalctl\b.*\brapportd\b")) && c.Output.Contains("rapportd.conf"),
                },
                new()
                {
                    Id = "fix",
                    Text = "Rätta felet som loggen berättar om och starta sedan om `rapportd` med `systemctl`, så att den kör.",
                    Hint = "Konfigurationsfilen saknas, men det finns ett exempel: `sudo cp /etc/rapportd.conf.example /etc/rapportd.conf`. Starta sedan om med `sudo systemctl restart rapportd`.",
                    Solution = Cmds("sudo cp /etc/rapportd.conf.example /etc/rapportd.conf", "sudo systemctl restart rapportd"),
                    Check = c => Re(@"\bsystemctl\b.*\brapportd\b").IsMatch(c.Line) && c.Sh.Services.Units.Get("rapportd.service")?.Active == "active",
                },
                new()
                {
                    Id = "start-minserver",
                    Text = "Starta tjänsten `minserver` (om den inte redan kör) och visa sedan dess status. Vilket PID fick den?",
                    Hint = "`sudo systemctl start minserver` och sedan `systemctl status minserver`.",
                    Solution = Cmds("sudo systemctl start minserver", "systemctl status minserver"),
                    Check = c => Ran(c, Re(@"\bsystemctl\b.*\bstatus\b.*\bminserver\b")) && c.Output.Contains("active (running)"),
                },
                new()
                {
                    Id = "stop",
                    Text = "Stoppa `minserver` med `systemctl`. Kontrollera gärna med `pgrep minserver` att processen är borta.",
                    Hint = "`sudo systemctl stop minserver`",
                    Solution = Cmds("sudo systemctl stop minserver", "pgrep minserver"),
                    Check = c =>
                        Ran(c, Re(@"\bsystemctl\b.*\bstop\b.*\bminserver\b")) && !c.Sh.Proc.Procs.Any(p => p.Cmd.Contains("/minserver")),
                },
                new()
                {
                    Id = "enable",
                    Text = "Se till att `minserver` startar automatiskt varje gång datorn startar – och starta den nu också, med ett enda kommando.",
                    Hint = "`enable` gäller vid uppstart och `--now` startar den direkt: `sudo systemctl enable --now minserver`.",
                    Solution = Cmds("sudo systemctl enable --now minserver"),
                    Check = c =>
                        Re(@"\bsystemctl\b.*\benable\b").IsMatch(c.Line) &&
                        IsFile(c, "/etc/systemd/system/multi-user.target.wants/minserver.service") &&
                        c.Sh.Services.Units.Get("minserver.service")?.Active == "active",
                },
            },
        },
        new()
        {
            Id = "natverk",
            Part = "natverk",
            Title = "Nätverk",
            Tasks = new()
            {
                new()
                {
                    Id = "ip-addr",
                    Text = "Visa datorns IP-adresser med `ip`.",
                    Hint = "`ip addr` – eller kortare `ip a`.",
                    Solution = Cmds("ip a"),
                    Check = c =>
                        (Ran(c, Re(@"^ip\s+(-\S+\s+)*a(d(d(r(e(s(s)?)?)?)?)?)?(\s|$)")) || Ran(c, Re(@"^hostname\s+-I\b"))) && c.Output.Contains("192.168.1.42"),
                },
                new()
                {
                    Id = "ping-gw",
                    Text = "Pinga gatewayen `192.168.1.1` exakt 3 gånger.",
                    Hint = "`ping -c 3 192.168.1.1` – `-c` står för *count*.",
                    Solution = Cmds("ping -c 3 192.168.1.1"),
                    Check = c => Ran(c, Re(@"^ping\b")) && c.Output.Contains("(192.168.1.1)") && Re(@"\b3 packets transmitted, 3 received").IsMatch(c.Output),
                },
                new()
                {
                    Id = "dig",
                    Text = "Installera paketet `dnsutils` och slå upp IP-adressen för `example.com` med `dig`.",
                    Hint = "`sudo apt update`, `sudo apt install dnsutils` och sedan `dig +short example.com`.",
                    Solution = Cmds("sudo apt update", "sudo apt install dnsutils", "dig +short example.com"),
                    Check = c => Ran(c, Re(@"^(dig|host|nslookup)\b.*\bexample\.com\b")) && c.Output.Contains("203.0.113.10"),
                },
                new()
                {
                    Id = "ss",
                    Text = "Ta reda på vilka portar som lyssnar på datorn med `ss`.",
                    Hint = "`ss -tulpn` – **t**cp, **u**dp, **l**yssnande, **p**rocess, **n**umeriskt.",
                    Solution = Cmds("ss -tulpn"),
                    Check = c => c.ExitCode == 0 && Re(@"^ss\s+(-\w+\s+)*-\w*l").IsMatch(Unsudo(c.Line)) && Re(@":(22|ssh)\b").IsMatch(c.Output),
                },
                new()
                {
                    Id = "curl-localhost",
                    Text = "Hämta startsidan från övningsservern på din egen dator, `http://localhost:8080`, med `curl`.",
                    Hint = "I Ubuntu måste curl installeras: `sudo apt install curl`. Får du *Couldn't connect to server* är minserver stoppad – starta den med `minserver`.",
                    Solution = Cmds("sudo apt update", "sudo apt install curl", "minserver", "curl http://localhost:8080"),
                    Check = c => Ran(c, Re(@"^curl\b.*\b(localhost|127\.0\.0\.1|192\.168\.1\.42):8080\b")) && c.Output.Contains("Hello from minserver"),
                },
                new()
                {
                    Id = "spara",
                    Text = "Spara webbsidan `https://example.com` som filen `~/exempel.html`.",
                    Hint = "Stå i hemkatalogen och använd `curl -o exempel.html https://example.com` eller `wget -O exempel.html https://example.com`.",
                    Solution = Cmds("cd ~", "wget -O exempel.html https://example.com"),
                    Check = c => Content(c, "~/exempel.html").Contains("Example Domain"),
                },
                new()
                {
                    Id = "hosts",
                    Text = "Servern `192.168.1.10` ska heta `server.lan`, men namnet finns inte i DNS. Lägg till det i `/etc/hosts` och pinga sedan `server.lan`.",
                    Hint = "Filen ägs av root: `echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts` och sedan `ping -c 3 server.lan`.",
                    Solution = Cmds("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts", "ping -c 3 server.lan"),
                    Check = c => Ran(c, Re(@"^ping\b.*\bserver\.lan\b")) && c.Output.Contains("from server.lan (192.168.1.10)"),
                },
                new()
                {
                    Id = "ssh",
                    Text = "Kör kommandot `hostname` på servern `server.lan` med `ssh` som användaren `elev`.",
                    Hint = "`ssh elev@server.lan hostname` – och svara `yes` på frågan om värdnyckeln.",
                    Solution = Cmds("ssh elev@server.lan hostname", "yes"),
                    Check = c => Ran(c, Re(@"^ssh\b.*(server\.lan|192\.168\.1\.10)")) && OutLines(c).Any(l => l.Trim() == "server"),
                },
            },
        },
        new()
        {
            Id = "diskar",
            Part = "admin",
            Title = "Diskar och filsystem",
            Tasks = new()
            {
                new()
                {
                    Id = "df",
                    Text = "Visa hur mycket plats som är använd och ledig på de monterade filsystemen – med läsbara storlekar (G, M).",
                    Hint = "`df` visar filsystemen, flaggan `-h` gör storlekarna läsbara: `df -h`.",
                    Solution = Cmds("df -h"),
                    Check = c => Ran(c, Re(@"^df\b")) && Re(@"\s-\w*h|--human").IsMatch(c.Line) && c.Output.Contains("Mounted on"),
                },
                new()
                {
                    Id = "lsblk-f",
                    Text = "Visa alla diskar och partitioner tillsammans med filsystemens typ, etikett och UUID.",
                    Hint = "`lsblk` visar diskarna som ett träd. Med `-f` kommer filsystemen med: `lsblk -f`.",
                    Solution = Cmds("lsblk -f"),
                    Check = c => Ran(c, Re(@"^lsblk\b")) && c.Output.Contains("FSTYPE") && c.Output.Contains("USBMINNE"),
                },
                new()
                {
                    Id = "fstab",
                    Text = "Visa filen `/etc/fstab`, som talar om vad som ska monteras när datorn startar.",
                    Solution = Cmds("cat /etc/fstab"),
                    Check = c => Ran(c, Re(@"\/etc\/fstab")) && c.Output.Contains("UUID="),
                },
                new()
                {
                    Id = "uuid",
                    Text = "Ta reda på UUID för filsystemet som är monterat på `/` – och bara det.",
                    Hint = "`lsblk -f` visar att `/` ligger på `/dev/sda2`. Fråga sedan `blkid /dev/sda2` – eller låt `findmnt -n -o UUID /` göra allt på en gång.",
                    Solution = Cmds("blkid /dev/sda2"),
                    Check = c => c.ExitCode == 0 && OutLines(c).Count <= 2 && c.Output.Contains(DisksLib.RootUuid(c.Distro)),
                },
                new()
                {
                    Id = "montera",
                    Text = "Skapa monteringspunkten `/mnt/usb` och montera USB-stickan (`/dev/sdb1`) där.",
                    Hint = "Både att skapa kataloger i `/mnt` och att montera kräver root: `sudo mkdir -p /mnt/usb` och sedan `sudo mount /dev/sdb1 /mnt/usb`.",
                    Solution = Cmds("sudo mkdir -p /mnt/usb", "sudo mount /dev/sdb1 /mnt/usb"),
                    Check = c => c.Sh.Disks.Mounts.Any(m => m.Dev == DisksLib.UsbPart && m.Target == "/mnt/usb"),
                },
                new()
                {
                    Id = "fran-usb",
                    Text = "Kopiera `rapport.pdf` från USB-stickan till din hemkatalog.",
                    Hint = "Stickans filer finns nu i `/mnt/usb`: `cp /mnt/usb/rapport.pdf ~`.",
                    Solution = Cmds("cp /mnt/usb/rapport.pdf ~"),
                    Check = c => Content(c, "~/rapport.pdf").StartsWith("%PDF", StringComparison.Ordinal),
                },
                new()
                {
                    Id = "till-usb",
                    Text = "Spara en kopia av `~/dokument/frukter.txt` på USB-stickan.",
                    Hint = "Filerna på stickan ägs av root – FAT har inga Linux-rättigheter – så du behöver `sudo`: `sudo cp ~/dokument/frukter.txt /mnt/usb/`.",
                    Solution = Cmds("sudo cp ~/dokument/frukter.txt /mnt/usb/"),
                    Check = c => DisksLib.PartitionRoot(c.Sh.Vfs, c.Sh.Disks, DisksLib.UsbPart, c.Sh.RootUser())?.Children?.Get("frukter.txt") is not null,
                },
                new()
                {
                    Id = "avmontera",
                    Text = "Avmontera USB-stickan, så att den är säker att dra ut.",
                    Hint = "`sudo umount /mnt/usb` – utan n! Får du *target is busy* står ditt skal i katalogen: gå därifrån med `cd ~` först.",
                    Solution = Cmds("cd ~", "sudo umount /mnt/usb"),
                    Check = c => Ran(c, Re(@"\bumount\b")) && !c.Sh.Disks.Mounts.Any(m => m.Dev == DisksLib.UsbPart),
                },
            },
        },
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
        },
        new()
        {
            Id = "familj-debian",
            Part = "distro",
            Family = "debian",
            Title = "Debian-familjen: apt och PPA",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Hämta de senaste paketlistorna med `apt update`.",
                    Hint = "Kommandot ändrar systemet och kräver root: `sudo apt update`.",
                    Solution = Cmds("sudo apt update"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`apt search htop`",
                    Solution = Cmds("apt search htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^apt(-cache)?\s+search\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo apt install tree`",
                    Solution = Cmds("sudo apt install tree"),
                    Check = c => Installed(c, "tree"),
                },
                new()
                {
                    Id = "run-tree",
                    Text = "Kör `tree` i din hemkatalog.",
                    Solution = Cmds("cd ~", "tree"),
                    Check = c => Ran(c, Re(@"^tree\b")) && Installed(c, "tree"),
                },
                new()
                {
                    Id = "remove",
                    Text = "Ta bort paketet `tree` igen.",
                    Hint = "`sudo apt remove tree`",
                    Solution = Cmds("sudo apt remove tree", "y"),
                    Check = c => Re(@"^apt(-get)?\s+(remove|purge)\b.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "Efter `sudo apt update` kör du `sudo apt upgrade`.",
                    Solution = Cmds("sudo apt update", "sudo apt upgrade", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Se till att du har kommandot `add-apt-repository`. Det finns i paketet `software-properties-common` – förinstallerat i Ubuntu, men inte i Debian.",
                    Hint = "`sudo apt update` och sedan `sudo apt install software-properties-common`.",
                    Solution = Cmds("sudo apt update", "sudo apt install software-properties-common"),
                    Check = c =>
                        Installed(c, "software-properties-common") &&
                        Ran(c, Re(@"\badd-apt-repository\b|\bapt(-get)?\s+install\b.*\bsoftware-properties-common\b")),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Lägg till PPA:t `ppa:lunatool/moonphase`.",
                    Hint = "`sudo add-apt-repository ppa:lunatool/moonphase` – och tryck Enter när den frågar.",
                    Solution = Cmds("sudo add-apt-repository -y ppa:lunatool/moonphase"),
                    Check = c =>
                        Re(@"\badd-apt-repository\b").IsMatch(c.Line) && IsFile(c, PpaFile) && ExtrarepoLib.ExtraRepoEnabled(c.Sh, "ppa:lunatool/moonphase"),
                },
                new()
                {
                    Id = "granska",
                    Text = "Titta i filen som `add-apt-repository` skapade i `/etc/apt/sources.list.d/`.",
                    Hint = "`ls /etc/apt/sources.list.d` och sedan `cat` på filen vars namn börjar med `lunatool`.",
                    // The PPA file name is computed when the solution is shown (TS: `cat ${PPA_FILE}`).
                    Solution = new PerDistro<List<string>>(_ => Cmds("ls /etc/apt/sources.list.d", $"cat {PpaFile}")),
                    Check = c => Ran(c, Re(@"^(cat|less|more|head|tail|grep)\b")) && c.Output.Contains("ppa.launchpadcontent.net/lunatool/moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Installera paketet `moonphase` från PPA:t.",
                    Hint = "`add-apt-repository` körde redan `apt update` åt dig, så `sudo apt install moonphase` räcker.",
                    Solution = Cmds("sudo apt install moonphase"),
                    Check = c => Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "kor",
                    Text = "Kör programmet `moonphase`.",
                    Solution = Cmds("moonphase"),
                    Check = c => Ran(c, Re(@"^moonphase\b")) && Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "ursprung",
                    Text = "Ta reda på varifrån `moonphase` kommer.",
                    Hint = "`apt policy moonphase`",
                    Solution = Cmds("apt policy moonphase"),
                    Check = c => Ran(c, Re(@"^apt\s+policy\b.*\bmoonphase\b")) && c.Output.Contains("ppa.launchpadcontent.net"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Ta bort PPA:t igen. Programmet blir kvar, men får inga fler uppdateringar.",
                    Hint = "`sudo add-apt-repository --remove ppa:lunatool/moonphase`",
                    Solution = Cmds("sudo add-apt-repository -y --remove ppa:lunatool/moonphase"),
                    Check = c => Re(@"\badd-apt-repository\b.*\s(-\w*r|--remove)\b|^rm\b").IsMatch(Unsudo(c.Line)) && !IsFile(c, PpaFile),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim.",
                    Hint = "Sök med `apt search vim`. Paketet heter `vim`.",
                    Solution = Cmds("sudo apt update", "sudo apt install vim"),
                    Check = c => Installed(c, "vim"),
                },
            },
        },
        new()
        {
            Id = "familj-arch",
            Part = "distro",
            Family = "arch",
            Title = "Arch-familjen: pacman och AUR",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Synkronisera paketdatabasen och uppgradera systemet med `pacman -Syu`.",
                    Hint = "Kommandot ändrar systemet och kräver root: `sudo pacman -Syu`.",
                    Solution = Cmds("sudo pacman -Syu", "y"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`pacman -Ss htop`",
                    Solution = Cmds("pacman -Ss htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^pacman\s+-Ss\w*\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo pacman -S tree` och svara ja på frågan.",
                    Solution = Cmds("sudo pacman -S tree", "y"),
                    Check = c => Installed(c, "tree"),
                },
                new()
                {
                    Id = "run-tree",
                    Text = "Kör `tree` i din hemkatalog.",
                    Solution = Cmds("cd ~", "tree"),
                    Check = c => Ran(c, Re(@"^tree\b")) && Installed(c, "tree"),
                },
                new()
                {
                    Id = "remove",
                    Text = "Ta bort paketet `tree` igen.",
                    Hint = "`sudo pacman -R tree`",
                    Solution = Cmds("sudo pacman -R tree", "y"),
                    Check = c => Re(@"^pacman\s+-R\w*\s+.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "`sudo pacman -Syu` gör allt på en gång.",
                    Solution = Cmds("sudo pacman -Syu", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Installera det som behövs för att bygga paket från AUR: `git` och `base-devel`.",
                    Hint = "`sudo pacman -S --needed git base-devel`",
                    Solution = Cmds("sudo pacman -S --needed git base-devel", "y"),
                    Check = c => Installed(c, "git") && Installed(c, "base-devel"),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Hämta byggreceptet för AUR-paketet `moonphase` till din hemkatalog med `git clone`. Adressen är `https://aur.archlinux.org/moonphase.git`.",
                    Hint = "`cd ~` och sedan `git clone https://aur.archlinux.org/moonphase.git`",
                    Solution = Cmds("cd ~", "git clone https://aur.archlinux.org/moonphase.git"),
                    Check = c => Ran(c, Re(@"\bgit\s+clone\s+.*aur\.archlinux\.org\/moonphase(\.git)?\b")),
                },
                new()
                {
                    Id = "granska",
                    Text = "Läs byggreceptet `PKGBUILD` innan du bygger något!",
                    Hint = "`cd ~/moonphase` och sedan `less PKGBUILD` (eller `cat PKGBUILD`).",
                    Solution = Cmds("cd ~/moonphase", "less PKGBUILD"),
                    Check = c => Ran(c, Re(@"^(cat|less|more|head|tail)\b.*PKGBUILD")) && c.Output.Contains("pkgname=moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Bygg och installera `moonphase` med `makepkg`.",
                    Hint = "Stå i katalogen `~/moonphase` och kör `makepkg -si` – utan sudo!",
                    Solution = Cmds("cd ~/moonphase", "makepkg -si", "y"),
                    Check = c => Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "kor",
                    Text = "Kör programmet `moonphase`.",
                    Solution = Cmds("moonphase"),
                    Check = c => Ran(c, Re(@"^moonphase\b")) && Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "ursprung",
                    Text = "Lista alla installerade paket som inte kommer från Archs egna förråd.",
                    Hint = "Sådana paket kallas *foreign*: `pacman -Qm`",
                    Solution = Cmds("pacman -Qm"),
                    Check = c => Ran(c, Re(@"^(pacman|yay)\s+-Q\w*m")) && c.Output.Contains("moonphase"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Bonus: installera AUR-hjälparen `yay` (AUR-paketet `yay-bin`) och använd den för att installera AUR-paketet `snowfall`.",
                    Hint = "Som förut: `cd ~`, `git clone https://aur.archlinux.org/yay-bin.git`, `cd yay-bin` och `makepkg -si`. Sedan `yay -S snowfall` – utan sudo.",
                    Solution = Cmds("cd ~", "git clone https://aur.archlinux.org/yay-bin.git", "cd yay-bin", "makepkg -si", "y", "yay -S snowfall", "y"),
                    Check = c => Installed(c, "snowfall"),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim.",
                    Hint = "Sök med `pacman -Ss vim`. Paketet heter `vim`.",
                    Solution = Cmds("sudo pacman -S vim", "y"),
                    Check = c => Installed(c, "vim"),
                },
            },
        },
        new()
        {
            Id = "familj-redhat",
            Part = "distro",
            Family = "redhat",
            Title = "Red Hat-familjen: dnf och COPR",
            Tasks = new()
            {
                new()
                {
                    Id = "sync",
                    Text = "Hämta ny paketinformation och se om det finns uppdateringar med `dnf check-update`.",
                    Hint = "`dnf check-update` behöver inte root.",
                    Solution = Cmds("dnf check-update"),
                    Check = c => Flag(c, "repoSynced"),
                },
                new()
                {
                    Id = "search",
                    Text = "Sök efter paketet `htop`.",
                    Hint = "`dnf search htop`",
                    Solution = Cmds("dnf search htop"),
                    Check = c => c.ExitCode == 0 && Re(@"^dnf5?\s+search\s+.*htop").IsMatch(Unsudo(c.Line)),
                },
                new()
                {
                    Id = "install",
                    Text = "Installera paketet `tree`.",
                    Hint = "`sudo dnf install tree` – och svara `y`, eftersom Nej är standard!",
                    Solution = Cmds("sudo dnf install tree", "y"),
                    Check = c => Installed(c, "tree"),
                },
                new()
                {
                    Id = "run-tree",
                    Text = "Kör `tree` i din hemkatalog.",
                    Solution = Cmds("cd ~", "tree"),
                    Check = c => Ran(c, Re(@"^tree\b")) && Installed(c, "tree"),
                },
                new()
                {
                    Id = "remove",
                    Text = "Ta bort paketet `tree` igen.",
                    Hint = "`sudo dnf remove tree`",
                    Solution = Cmds("sudo dnf remove tree", "y"),
                    Check = c => Re(@"^dnf5?\s+(remove|rm|erase)\b.*\btree\b").IsMatch(Unsudo(c.Line)) && !Installed(c, "tree"),
                },
                new()
                {
                    Id = "upgrade",
                    Text = "Uppgradera alla installerade paket.",
                    Hint = "`sudo dnf upgrade`",
                    Solution = Cmds("sudo dnf upgrade", "y"),
                    Check = c => Flag(c, "upgraded"),
                },
                new()
                {
                    Id = "forbered",
                    Text = "Visa vilka förråd dnf använder just nu.",
                    Hint = "`dnf repolist`",
                    Solution = Cmds("dnf repolist"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+repolist\b")),
                },
                new()
                {
                    Id = "lagg-till",
                    Text = "Aktivera COPR-förrådet `lunatool/moonphase`.",
                    Hint = "`sudo dnf copr enable lunatool/moonphase` – och svara `y`, Nej är standard.",
                    Solution = Cmds("sudo dnf copr enable lunatool/moonphase", "y"),
                    Check = c => Re(@"\bcopr\s+enable\b").IsMatch(c.Line) && ExtrarepoLib.ExtraRepoEnabled(c.Sh, "copr:lunatool/moonphase"),
                },
                new()
                {
                    Id = "granska",
                    Text = "Lista vilka COPR-förråd som är tillagda.",
                    Hint = "`dnf copr list`",
                    Solution = Cmds("dnf copr list"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+copr\s+list\b")) && c.Output.Contains("lunatool/moonphase"),
                },
                new()
                {
                    Id = "installera",
                    Text = "Installera paketet `moonphase` från COPR-förrådet.",
                    Hint = "`sudo dnf install moonphase`",
                    Solution = Cmds("sudo dnf install moonphase", "y"),
                    Check = c => Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "kor",
                    Text = "Kör programmet `moonphase`.",
                    Solution = Cmds("moonphase"),
                    Check = c => Ran(c, Re(@"^moonphase\b")) && Installed(c, "moonphase"),
                },
                new()
                {
                    Id = "ursprung",
                    Text = "Ta reda på från vilket förråd `moonphase` installerades.",
                    Hint = "`dnf info moonphase` – titta på raden `From repository`.",
                    Solution = Cmds("dnf info moonphase"),
                    Check = c => Ran(c, Re(@"^dnf5?\s+info\b.*\bmoonphase\b")) && c.Output.Contains("copr:"),
                },
                new()
                {
                    Id = "efterat",
                    Text = "Stäng av COPR-förrådet igen. Programmet blir kvar, men får inga fler uppdateringar.",
                    Hint = "`sudo dnf copr disable lunatool/moonphase`",
                    Solution = Cmds("sudo dnf copr disable lunatool/moonphase"),
                    Check = c => Re(@"\bcopr\s+(disable|remove)\b").IsMatch(c.Line) && !ExtrarepoLib.ExtraRepoEnabled(c.Sh, "copr:lunatool/moonphase"),
                },
                new()
                {
                    Id = "vim",
                    Text = "Bonus: installera texteditorn Vim. Tips: paketet heter inte `vim` i Red Hat-familjen!",
                    Hint = "Sök med `dnf search vim`. Paketet heter `vim-enhanced`.",
                    Solution = Cmds("sudo dnf install vim-enhanced", "y"),
                    Check = c => Installed(c, "vim"),
                },
            },
        },
        new()
        {
            Id = "universella-paket",
            Part = "distro",
            Title = "Flatpak, Snap och AppImage",
            Tasks = new()
            {
                new()
                {
                    Id = "flatpak",
                    PerFamily = true,
                    Text = ByFamily(
                        debian: "Installera Flatpak (paketet `flatpak`).",
                        arch: "Installera Flatpak (paketet `flatpak`).",
                        redhat: "Flatpak finns redan i Fedora Workstation. Kontrollera vilken version du har."),
                    Hint = ByFamily(
                        debian: "`sudo apt update` och sedan `sudo apt install flatpak`.",
                        arch: "`sudo pacman -S flatpak`",
                        redhat: "`flatpak --version`"),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install flatpak"),
                        arch: Cmds("sudo pacman -S flatpak", "y"),
                        redhat: Cmds("flatpak --version")),
                    Check = c => Ran(c, Re(@"\bflatpak\b")) && Installed(c, "flatpak"),
                },
                new()
                {
                    Id = "flathub",
                    PerFamily = true,
                    Text = "Lägg till Flathub som källa (*remote*) för Flatpak.",
                    Hint = "`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`",
                    Solution = Cmds("flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo"),
                    Check = c =>
                        Ran(c, Re(@"^flatpak\s+remote-add\b")) &&
                        new[] { Content(c, "/var/lib/flatpak/repo/config"), Content(c, "~/.local/share/flatpak/repo/config") }
                            .Any(t => t.Contains("[remote \"flathub\"]")),
                },
                new()
                {
                    Id = "gimp",
                    PerFamily = true,
                    Text = "Installera bildredigeringsprogrammet GIMP (`org.gimp.GIMP`) från Flathub.",
                    Hint = "`flatpak install flathub org.gimp.GIMP` – och svara ja.",
                    Solution = Cmds("flatpak install flathub org.gimp.GIMP", "y"),
                    Check = c => IsDir(c, "/var/lib/flatpak/app/org.gimp.GIMP") || IsDir(c, "~/.local/share/flatpak/app/org.gimp.GIMP"),
                },
                new()
                {
                    Id = "flatpak-run",
                    PerFamily = true,
                    Text = "Starta GIMP med `flatpak run`.",
                    Hint = "Program startas med sitt fullständiga id: `flatpak run org.gimp.GIMP`",
                    Solution = Cmds("flatpak run org.gimp.GIMP"),
                    Check = c => Ran(c, Re(@"^flatpak\s+run\s+(\S+\s+)*org\.gimp\.GIMP\b")),
                },
                new()
                {
                    Id = "snap",
                    PerFamily = true,
                    Text = ByFamily(
                        debian: "Installera snap-paketet `hello-world` och kör det. I Ubuntu finns Snap redan; i Debian installerar du paketet `snapd` först.",
                        arch: "Snap finns inte i Archs förråd, bara i AUR. Bygg och installera `snapd` från AUR, installera sedan snap-paketet `hello-world` och kör det.",
                        redhat: "Installera Snap (paketet `snapd`), installera sedan snap-paketet `hello-world` och kör det."),
                    Hint = ByFamily(
                        debian: "`sudo apt install snapd` (behövs bara i Debian), `sudo snap install hello-world` och sedan `hello-world`.",
                        arch: "`git clone https://aur.archlinux.org/snapd.git`, `cd snapd`, `makepkg -si`. Sedan `sudo snap install hello-world` och `hello-world`.",
                        redhat: "`sudo dnf install snapd`, `sudo snap install hello-world` och sedan `hello-world`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install snapd", "sudo snap install hello-world", "hello-world"),
                        arch: Cmds(
                            "sudo pacman -S --needed git base-devel",
                            "y",
                            "cd ~",
                            "git clone https://aur.archlinux.org/snapd.git",
                            "cd snapd",
                            "makepkg -si",
                            "y",
                            "y",
                            "sudo snap install hello-world",
                            "hello-world"),
                        redhat: Cmds("sudo dnf install snapd", "y", "sudo snap install hello-world", "hello-world")),
                    Check = c => Ran(c, Re(@"\bhello-world\b")) && c.Output.Contains("Hello World!"),
                },
                new()
                {
                    Id = "appimage-chmod",
                    Text = "I `~/Nedladdningar` ligger en nedladdad AppImage. Gör filen `Kalkylator.AppImage` körbar.",
                    Hint = "`chmod +x ~/Nedladdningar/Kalkylator.AppImage`",
                    Solution = Cmds("chmod +x ~/Nedladdningar/Kalkylator.AppImage"),
                    Check = c => Ran(c, Re(@"^chmod\b")) && (Mode(c, "~/Nedladdningar/Kalkylator.AppImage") & Js.Oct(100)) != 0,
                },
                new()
                {
                    Id = "appimage-run",
                    PerFamily = true,
                    Text = "Starta Kalkylator. Klagar den på FUSE? Installera biblioteket som saknas och försök igen.",
                    Hint = ByFamily(
                        debian: "Biblioteket finns i paketet `libfuse2t64`. Starta sedan med `~/Nedladdningar/Kalkylator.AppImage`.",
                        arch: "Biblioteket finns i paketet `fuse2`. Starta sedan med `~/Nedladdningar/Kalkylator.AppImage`.",
                        redhat: "Biblioteket finns i paketet `fuse-libs`. Starta sedan med `~/Nedladdningar/Kalkylator.AppImage`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install libfuse2t64", "~/Nedladdningar/Kalkylator.AppImage"),
                        arch: Cmds("sudo pacman -S fuse2", "y", "~/Nedladdningar/Kalkylator.AppImage"),
                        redhat: Cmds("sudo dnf install fuse-libs", "y", "~/Nedladdningar/Kalkylator.AppImage")),
                    Check = c => Ran(c, Re(@"Kalkylator\.AppImage|\bAppRun\b")) && !Re(@"--appimage-extract(\s|$)").IsMatch(c.Line),
                },
            },
        },
        new()
        {
            Id = "skript",
            Part = "skript",
            Title = "Shell-skript",
            Tasks = new()
            {
                new()
                {
                    Id = "variabel",
                    Text = "Skapa variabeln `namn` med ditt namn, och skriv sedan ut `Hej` följt av namnet med `echo`.",
                    Hint = "Inga mellanslag runt `=`: `namn=Kim`. Använd sedan `echo \"Hej $namn\"`.",
                    Solution = Cmds("namn=Kim", "echo \"Hej $namn\""),
                    Check = c => Ran(c, Re(@"^echo\b.*\$\{?namn\b")) && !string.IsNullOrEmpty(Env(c, "namn")) && c.Output.Trim() == $"Hej {Env(c, "namn")}",
                },
                new()
                {
                    Id = "rakna",
                    Text = "Räkna ut 17 × 23 med `$(( ))`.",
                    Solution = Cmds("echo $(( 17 * 23 ))"),
                    Check = c => Ran(c, Re(@"\$\(\(")) && c.Output.Trim() == "391",
                },
                new()
                {
                    Id = "substitution",
                    Text = "Spara antalet rader i `~/dokument/server.log` i variabeln `rader`, med `$(...)` och `wc -l`.",
                    Hint = "`wc -l < fil` skriver bara ut antalet, utan filnamnet: `rader=$(wc -l < ~/dokument/server.log)`",
                    Solution = Cmds("rader=$(wc -l < ~/dokument/server.log)"),
                    Check = c => (Env(c, "rader") ?? "").Trim() == "15",
                },
                new()
                {
                    Id = "if",
                    Text = "Skriv ett `if`-villkor som skriver ut `finns` om filen `~/.bashrc` finns.",
                    Hint = "`if [ -f ~/.bashrc ]; then echo finns; fi` – glöm inte mellanslagen innanför hakparenteserna.",
                    Solution = Cmds("if [ -f ~/.bashrc ]; then echo finns; fi"),
                    Check = c => Ran(c, Re(@"^if\b")) && Re(@"\[|\btest\b").IsMatch(c.Line) && c.Output.Trim() == "finns",
                },
                new()
                {
                    Id = "for",
                    Text = "Skriv ut talen 1 till 5, ett per rad, med en `for`-loop.",
                    Hint = "Antingen `for i in 1 2 3 4 5; do ...; done` eller `for i in $(seq 1 5); do ...; done`.",
                    Solution = Cmds("for i in 1 2 3 4 5; do echo $i; done"),
                    Check = c => Ran(c, Re(@"^for\b")) && string.Join(",", OutLines(c)) == "1,2,3,4,5",
                },
                new()
                {
                    Id = "while-read",
                    Text = "Läs `~/dokument/frukter.txt` rad för rad med `while read` och skriv ut `Frukt: ` framför varje rad.",
                    Hint = "`while read rad; do echo \"Frukt: $rad\"; done < ~/dokument/frukter.txt`",
                    Solution = Cmds("while read rad; do echo \"Frukt: $rad\"; done < ~/dokument/frukter.txt"),
                    Check = c => Ran(c, Re(@"\bwhile\s+read\b")) && OutLines(c).Count == 10 && OutLines(c).At(0) == "Frukt: äpple",
                },
                new()
                {
                    Id = "funktion",
                    Text = "Skapa funktionen `dubbla` som skriver ut sitt första argument gånger två. Testa med `dubbla 21`.",
                    Hint = "`dubbla() { echo $(( $1 * 2 )); }` – och sedan `dubbla 21`.",
                    Solution = Cmds("dubbla() { echo $(( $1 * 2 )); }", "dubbla 21"),
                    Check = c => Ran(c, Re(@"^dubbla\s+21\s*$")) && c.Sh.Functions.ContainsKey("dubbla") && c.Output.Trim() == "42",
                },
                new()
                {
                    Id = "backup",
                    Text = "Skriv skriptet `~/backup.sh` som kopierar filen i första argumentet till samma namn med `.bak` på slutet. Gör det körbart och kör `./backup.sh anteckningar.txt` i hemkatalogen.",
                    Hint = "Skapa filen med `cat > ~/backup.sh << 'SLUT'`, skriv `#!/bin/bash` och `cp \"$1\" \"$1.bak\"` på varsin rad och avsluta med `SLUT`.",
                    Solution = Cmds("cat > ~/backup.sh << 'SLUT'", "#!/bin/bash", "cp \"$1\" \"$1.bak\"", "SLUT", "chmod +x ~/backup.sh", "cd ~", "./backup.sh anteckningar.txt"),
                    Check = c =>
                        Ran(c, Re(@"backup\.sh\s+anteckningar\.txt\s*$")) && Content(c, "~/backup.sh").Contains("$1") && IsFile(c, "~/anteckningar.txt.bak"),
                },
            },
        },
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
                    PerFamily = true,
                    Text = "Installera paketet `git`.",
                    Hint = ByFamily(
                        debian: "Kör `sudo apt update` och sedan `sudo apt install git`.",
                        arch: "`sudo pacman -S git` – och svara ja på frågan.",
                        redhat: "`sudo dnf install git` – och svara `y`, eftersom Nej är standard."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install git"),
                        arch: Cmds("sudo pacman -S git", "y"),
                        redhat: Cmds("sudo dnf install git", "y")),
                    Check = c => Installed(c, "git"),
                },
                new()
                {
                    Id = "identitet",
                    Text = "Berätta för git vem du är: ställ in ditt namn (`user.name`) och din e-postadress (`user.email`) med `git config --global`.",
                    Hint = "Två kommandon: `git config --global user.name \"Ditt Namn\"` och `git config --global user.email \"du@example.com\"`.",
                    Solution = Cmds("git config --global user.name \"Elev Elevsson\"", "git config --global user.email \"elev@example.com\""),
                    Check = c =>
                        !string.IsNullOrEmpty(GitCmd.GitGlobalConfig(c.Sh, Home, "user.name")) &&
                        !string.IsNullOrEmpty(GitCmd.GitGlobalConfig(c.Sh, Home, "user.email")),
                },
                new()
                {
                    Id = "init",
                    Text = "Gå till katalogen `~/projekt-webb` och gör den till ett git-repo med `git init`.",
                    Hint = "`cd ~/projekt-webb` och sedan `git init`. Titta gärna på den nya dolda katalogen med `ls -a`.",
                    Solution = Cmds("cd ~/projekt-webb", "git init"),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+init\b")) && GitCmd.GitRepoState(c.Sh, Web) is not null,
                },
                new()
                {
                    Id = "forsta-commit",
                    Text = "Lägg till alla tre filerna i indexet med `git add` och gör din första commit med ett beskrivande meddelande.",
                    Hint = "`git add .` lägger till allt i katalogen. Sedan `git commit -m \"Första versionen av webbplatsen\"`. Kolla läget med `git status` före och efter!",
                    Solution = Cmds("cd ~/projekt-webb", "git add .", "git commit -m \"Första versionen av webbplatsen\""),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web);
                        return !string.IsNullOrEmpty(s?.Head) && new[] { "index.html", "style.css", "README.md" }.All(f => s.Files.Contains(f));
                    },
                },
                new()
                {
                    Id = "diff",
                    Text = "Lägg till en rad i slutet av `README.md` och titta på ändringen med `git diff`.",
                    Hint = "`echo 'Sidan är byggd med HTML och CSS.' >> README.md` och sedan `git diff`. Rader som börjar med `+` är nya.",
                    Solution = Cmds("cd ~/projekt-webb", "echo 'Sidan är byggd med HTML och CSS.' >> README.md", "git diff"),
                    Check = c => Ran(c, Re(@"(^|[;&|]\s*)git\s+diff\b")) && OutLines(c).Any(l => Re(@"^\+(?!\+\+ )").IsMatch(l)),
                },
                new()
                {
                    Id = "commit-a",
                    Text = "Committa ändringen i `README.md`. Prova flaggan `-a`, som tar med alla ändrade filer som git redan följer.",
                    Hint = "`git commit -a -m \"Beskriv hur sidan är byggd\"` – eller kortare `git commit -am \"…\"`.",
                    Solution = Cmds("cd ~/projekt-webb", "git commit -am \"Beskriv hur sidan är byggd\""),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+commit\b")) && (GitCmd.GitRepoState(c.Sh, Web)?.Commits ?? 0) >= 2,
                },
                new()
                {
                    Id = "gren",
                    Text = "Skapa grenen `ny-design` och byt till den. Ändra något i `style.css` och committa ändringen på den nya grenen.",
                    Hint = "`git switch -c ny-design` skapar grenen och byter till den. Ändra sedan t.ex. med `echo 'h1 { color: purple; }' >> style.css` och kör `git commit -am \"Lila rubriker\"`.",
                    Solution = Cmds("cd ~/projekt-webb", "git switch -c ny-design", "echo 'h1 { color: purple; }' >> style.css", "git commit -am \"Lila rubriker\""),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web);
                        var design = s?.Branches.Get("ny-design");
                        var main = s is null ? null : s.Branches.Get("main") ?? s.Branches.Get("master");
                        return !string.IsNullOrEmpty(design) && !string.IsNullOrEmpty(main) && !GitCmd.GitIsAncestor(c.Sh, Web, design, main);
                    },
                },
                new()
                {
                    Id = "merge",
                    Text = "Byt tillbaka till `main` och slå ihop grenen `ny-design` med `git merge`.",
                    Hint = "`git switch main` och sedan `git merge ny-design`. Eftersom `main` inte ändrats sedan du skapade grenen blir det en *fast-forward*.",
                    Solution = Cmds("cd ~/projekt-webb", "git switch main", "git merge ny-design"),
                    Check = c =>
                    {
                        var s = GitCmd.GitRepoState(c.Sh, Web);
                        var design = s?.Branches.Get("ny-design");
                        return
                            Ran(c, Re(@"(^|[;&]\s*)git\s+(merge|pull)\b")) &&
                            !string.IsNullOrEmpty(s?.Head) &&
                            (s.Branch == "main" || s.Branch == "master") &&
                            !string.IsNullOrEmpty(design) &&
                            GitCmd.GitIsAncestor(c.Sh, Web, design, s.Head);
                    },
                },
                new()
                {
                    Id = "logg",
                    Text = "Visa historiken med en rad per commit med `git log --oneline`.",
                    Hint = "Prova också `git log --oneline --graph --all` för att se grenarna.",
                    Solution = Cmds("cd ~/projekt-webb", "git log --oneline"),
                    Check = c => Ran(c, Re(@"(^|[;&]\s*)git\s+log\b.*--oneline")) && OutLines(c).Count >= 3,
                },
            },
        },
        new()
        {
            Id = "skal",
            Part = "verktyg",
            Title = "Andra skal: zsh och fish",
            Tasks = new()
            {
                new()
                {
                    Id = "installera-zsh",
                    PerFamily = true,
                    Text = "Installera skalet `zsh`.",
                    Hint = ByFamily(
                        debian: "`sudo apt update` och sedan `sudo apt install zsh`.",
                        arch: "`sudo pacman -S zsh` och svara ja.",
                        redhat: "`sudo dnf install zsh` – och svara `y`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install zsh"),
                        arch: Cmds("sudo pacman -S zsh", "y"),
                        redhat: Cmds("sudo dnf install zsh", "y")),
                    Check = c => Installed(c, "zsh"),
                },
                new()
                {
                    Id = "starta-zsh",
                    Text = "Starta `zsh`. Första gången frågar *zsh-newuser-install* vad du vill göra – svara `2`. Visa sedan vilket skal du kör med `echo $0`.",
                    Hint = "Skriv `zsh`, svara `2` och skriv sedan `echo $0`. Det ska stå `zsh`.",
                    Solution = Cmds("zsh", "2", "echo $0"),
                    Check = c => c.Sh.ShellMode == "zsh" && Ran(c, Re(@"^echo\s+[""']?\$\{?0\}?[""']?\s*$")) && c.Output.Trim() == "zsh",
                },
                new()
                {
                    Id = "globstar",
                    Text = "Använd zsh:s `**` för att lista alla `.txt`-filer i hemkatalogen **och alla underkataloger** med ett enda `ls`.",
                    Hint = "`ls ~/**/*.txt` – `**` betyder \"alla kataloger, på alla nivåer\".",
                    Solution = Cmds("ls ~/**/*.txt"),
                    Check = c => c.Sh.ShellMode == "zsh" && Ran(c, Re(@"\*\*\/")) && c.Output.Contains("dokument/frukter.txt"),
                },
                new()
                {
                    Id = "tillbaka",
                    Text = "Lämna zsh och gå tillbaka till bash.",
                    Hint = "Skriv `exit`. Kontrollera gärna med `echo $0` eller `ps`.",
                    Solution = Cmds("exit"),
                    Check = c => Flag(c, "left:zsh") && c.Sh.ShellMode == "bash",
                },
                new()
                {
                    Id = "installera-fish",
                    PerFamily = true,
                    Text = "Installera skalet `fish`.",
                    Hint = ByFamily(
                        debian: "`sudo apt update` och sedan `sudo apt install fish`.",
                        arch: "`sudo pacman -S fish` och svara ja.",
                        redhat: "`sudo dnf install fish` – och svara `y`."),
                    Solution = ByFamily(
                        debian: Cmds("sudo apt update", "sudo apt install fish"),
                        arch: Cmds("sudo pacman -S fish", "y"),
                        redhat: Cmds("sudo dnf install fish", "y")),
                    Check = c => Installed(c, "fish"),
                },
                new()
                {
                    Id = "fish-set",
                    Text = "Starta `fish`. Skapa variabeln `frukt` med värdet `äpple` på fish-sättet och skriv ut den med `echo`.",
                    Hint = "`frukt=äpple` fungerar inte i fish. Skriv `set frukt äpple` och sedan `echo $frukt`.",
                    Solution = Cmds("fish", "set frukt äpple", "echo $frukt"),
                    Check = c => c.Sh.ShellMode == "fish" && Ran(c, Re(@"^echo\b.*\$frukt\b")) && Env(c, "frukt") == "äpple" && c.Output.Trim() == "äpple",
                },
                new()
                {
                    Id = "fish-for",
                    Text = "Skriv en `for`-loop med fish-syntax som skriver ut talen 1, 2 och 3, ett per rad. Gå sedan tillbaka till bash med `exit`.",
                    Hint = "I fish finns inget `do` och `done` – blocket avslutas med `end`: `for i in 1 2 3; echo $i; end`",
                    Solution = Cmds("for i in 1 2 3; echo $i; end", "exit"),
                    Check = c => c.Sh.ShellMode == "fish" && Ran(c, Re(@"^for\b.*\bend\s*$")) && string.Join(",", OutLines(c)) == "1,2,3",
                },
                new()
                {
                    Id = "chsh",
                    Text = "Se efter i `/etc/shells` vilka skal som är installerade. Gör sedan zsh till ditt inloggningsskal med `chsh`.",
                    Hint = "`cat /etc/shells` och sedan `chsh -s /usr/bin/zsh`. Kontrollera resultatet med `grep elev /etc/passwd`.",
                    Solution = Cmds("cat /etc/shells", "chsh -s /usr/bin/zsh"),
                    Check = c => Re(@"^elev:.*:\/(usr\/)?bin\/zsh$", "m").IsMatch(Content(c, "/etc/passwd")),
                },
            },
        },
        new()
        {
            Id = "anvandare",
            Part = "admin",
            Title = "Användare och grupper",
            Tasks = new()
            {
                new()
                {
                    Id = "useradd",
                    Text = "Skapa användaren `kim` med en hemkatalog och `/bin/bash` som skal.",
                    Hint = "`sudo useradd -m -s /bin/bash kim` – `-m` skapar hemkatalogen och `-s` väljer skalet.",
                    Solution = Cmds("sudo useradd -m -s /bin/bash kim"),
                    Check = c =>
                    {
                        var kim = UsersLib.FindUser(c.Sh, "kim");
                        return kim is not null && Re(@"\/bash$").IsMatch(kim.Shell) && IsDir(c, kim.Home);
                    },
                },
                new()
                {
                    Id = "passwd-rad",
                    Text = "Visa kims rad i `/etc/passwd`.",
                    Hint = "`grep kim /etc/passwd` – eller `getent passwd kim`.",
                    Solution = Cmds("grep kim /etc/passwd"),
                    Check = c => c.ExitCode == 0 && Re("passwd").IsMatch(c.Line) && OutLines(c).Any(l => l.StartsWith("kim:x:", StringComparison.Ordinal)),
                },
                new()
                {
                    Id = "losenord",
                    Text = "Ge `kim` ett lösenord med `passwd`.",
                    Hint = "Bara root får sätta lösenord åt andra: `sudo passwd kim`. Skriv samma lösenord två gånger – det syns inte när du skriver.",
                    Solution = Cmds("sudo passwd kim", "hemligt123", "hemligt123"),
                    Check = c => (UsersLib.ShadowHash(c.Sh, "kim") ?? "").StartsWith('$'),
                },
                new()
                {
                    Id = "grupp",
                    Text = "Skapa gruppen `utvecklare` och lägg till `kim` i den.",
                    Hint = "Först `sudo groupadd utvecklare`, sedan `sudo usermod -aG utvecklare kim`.",
                    Solution = Cmds("sudo groupadd utvecklare", "sudo usermod -aG utvecklare kim"),
                    Check = c => UsersLib.FindGroup(c.Sh, "utvecklare")?.Members.Contains("kim") == true,
                },
                new()
                {
                    Id = "sudo-ratt",
                    Text = "Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `sudo`.",
                    Hint = "`sudo usermod -aG sudo kim` – glöm inte `-a`!",
                    Solution = Cmds("sudo usermod -aG sudo kim"),
                    Check = c => UsersLib.FindGroup(c.Sh, "sudo")?.Members.Contains("kim") == true,
                },
                new()
                {
                    Id = "sudo-u",
                    Text = "Kör `whoami` som `kim` med `sudo -u`.",
                    Hint = "`sudo -u kim whoami`",
                    Solution = Cmds("sudo -u kim whoami"),
                    Check = c => Ran(c, Re(@"^sudo\s+(-\S+\s+)*-u\s*kim\s+whoami\s*$")) && OutLines(c).At(-1) == "kim",
                },
                new()
                {
                    Id = "su",
                    Text = "Logga in som `kim` med `su -` och kör `id`. Gå sedan tillbaka till `elev` med `exit`.",
                    Hint = "Skriv `su - kim` och sedan kims lösenord – det du valde med `passwd`. Prompten visar att du är kim.",
                    Solution = Cmds("su - kim", "hemligt123", "id", "exit"),
                    Check = c => Ran(c, Re(@"^id\s*$")) && c.Sh.CurrentUser().Name == "kim",
                },
                new()
                {
                    Id = "userdel",
                    Text = "Skapa en tillfällig användare `vikarie` med hemkatalog – och ta sedan bort den igen, **inklusive** hemkatalogen.",
                    Hint = "`sudo useradd -m vikarie` och sedan `sudo userdel -r vikarie`.",
                    Solution = Cmds("sudo useradd -m vikarie", "sudo userdel -r vikarie"),
                    Check = c =>
                        c.ExitCode == 0 && Re(@"^(userdel|deluser)\b.*\bvikarie\b").IsMatch(Unsudo(c.Line)) && UsersLib.FindUser(c.Sh, "vikarie") is null && !Exists(c, "/home/vikarie"),
                },
            },
        },
    };
}
