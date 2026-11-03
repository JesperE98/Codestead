namespace Codestead.Content;

// The chapter "natverk" (part "natverk"). Its place in the course is set by DefineChapters() in ChapterDefinitions.cs.

public static partial class ChaptersLib
{
    private static Chapter Natverk() =>
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
                    Hint = "I Ubuntu måste curl installeras: `sudo apt install curl`. Får du *Couldn't connect to server* är myserver stoppad – starta den med `myserver`.",
                    Solution = Cmds("sudo apt update", "sudo apt install curl", "myserver", "curl http://localhost:8080"),
                    Check = c => Ran(c, Re(@"^curl\b.*\b(localhost|127\.0\.0\.1|192\.168\.1\.42):8080\b")) && c.Output.Contains("Hello from myserver"),
                },
                new()
                {
                    Id = "spara",
                    Text = "Spara webbsidan `https://example.com` som filen `~/{{exampleHtml}}`.",
                    Hint = "Stå i hemkatalogen och använd `curl -o {{exampleHtml}} https://example.com` eller `wget -O {{exampleHtml}} https://example.com`.",
                    Solution = Cmds("cd ~", "wget -O {{exampleHtml}} https://example.com"),
                    Check = c => Content(c, "~/{{exampleHtml}}").Contains("Example Domain"),
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
                    Text = "Kör kommandot `hostname` på servern `server.lan` med `ssh` som användaren `{{user}}`.",
                    Hint = "`ssh {{user}}@server.lan hostname` – och svara `yes` på frågan om värdnyckeln.",
                    Solution = Cmds("ssh {{user}}@server.lan hostname", "yes"),
                    Check = c => Ran(c, Re(@"^ssh\b.*(server\.lan|192\.168\.1\.10)")) && OutLines(c).Any(l => l.Trim() == "server"),
                },
            },
        };
}
