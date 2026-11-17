// Port of Chapters/natverk/natverk.cs – the chapter "natverk" (part "natverk"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, content, outLines, ran, re, unsudo } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function natverk(): Chapter {
  return new Chapter({
    id: "natverk",
    part: "natverk",
    title: "Nätverk",
    tasks: [
      new ChapterTask({
        id: "ip-addr",
        text: "Visa datorns IP-adresser med `ip`.",
        hint: "`ip addr` – eller kortare `ip a`.",
        solution: cmds("ip a"),
        check: (c) =>
          (ran(c, re(String.raw`^ip\s+(-\S+\s+)*a(d(d(r(e(s(s)?)?)?)?)?)?(\s|$)`)) || ran(c, re(String.raw`^hostname\s+-I\b`))) && c.output.includes("192.168.1.42"),
      }),
      new ChapterTask({
        id: "ping-gw",
        text: "Pinga gatewayen `192.168.1.1` exakt 3 gånger.",
        hint: "`ping -c 3 192.168.1.1` – `-c` står för *count*.",
        solution: cmds("ping -c 3 192.168.1.1"),
        check: (c) => ran(c, re(String.raw`^ping\b`)) && c.output.includes("(192.168.1.1)") && re(String.raw`\b3 packets transmitted, 3 received`).test(c.output),
      }),
      new ChapterTask({
        id: "dig",
        text: "Installera paketet `dnsutils` och slå upp IP-adressen för `example.com` med `dig`.",
        hint: "`sudo apt update`, `sudo apt install dnsutils` och sedan `dig +short example.com`.",
        solution: cmds("sudo apt update", "sudo apt install dnsutils", "dig +short example.com"),
        check: (c) => ran(c, re(String.raw`^(dig|host|nslookup)\b.*\bexample\.com\b`)) && c.output.includes("203.0.113.10"),
      }),
      new ChapterTask({
        id: "ss",
        text: "Ta reda på vilka portar som lyssnar på datorn med `ss`.",
        hint: "`ss -tulpn` – **t**cp, **u**dp, **l**yssnande, **p**rocess, **n**umeriskt.",
        solution: cmds("ss -tulpn"),
        check: (c) => c.exitCode === 0 && re(String.raw`^ss\s+(-\w+\s+)*-\w*l`).test(unsudo(c.line)) && re(String.raw`:(22|ssh)\b`).test(c.output),
      }),
      new ChapterTask({
        id: "curl-localhost",
        text: "Hämta startsidan från övningsservern på din egen dator, `http://localhost:8080`, med `curl`.",
        hint: "I Ubuntu måste curl installeras: `sudo apt install curl`. Får du *Couldn't connect to server* är myserver stoppad – starta den med `myserver`.",
        solution: cmds("sudo apt update", "sudo apt install curl", "myserver", "curl http://localhost:8080"),
        check: (c) => ran(c, re(String.raw`^curl\b.*\b(localhost|127\.0\.0\.1|192\.168\.1\.42):8080\b`)) && c.output.includes("Hello from myserver"),
      }),
      new ChapterTask({
        id: "spara",
        text: "Spara webbsidan `https://example.com` som filen `~/{{exampleHtml}}`.",
        hint: "Stå i hemkatalogen och använd `curl -o {{exampleHtml}} https://example.com` eller `wget -O {{exampleHtml}} https://example.com`.",
        solution: cmds("cd ~", "wget -O {{exampleHtml}} https://example.com"),
        check: (c) => content(c, "~/{{exampleHtml}}").includes("Example Domain"),
      }),
      new ChapterTask({
        id: "hosts",
        text: "Servern `192.168.1.10` ska heta `server.lan`, men namnet finns inte i DNS. Lägg till det i `/etc/hosts` och pinga sedan `server.lan`.",
        hint: "Filen ägs av root: `echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts` och sedan `ping -c 3 server.lan`.",
        solution: cmds("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts", "ping -c 3 server.lan"),
        check: (c) => ran(c, re(String.raw`^ping\b.*\bserver\.lan\b`)) && c.output.includes("from server.lan (192.168.1.10)"),
      }),
      new ChapterTask({
        id: "ssh",
        text: "Kör kommandot `hostname` på servern `server.lan` med `ssh` som användaren `{{user}}`.",
        hint: "`ssh {{user}}@server.lan hostname` – och svara `yes` på frågan om värdnyckeln.",
        solution: cmds("ssh {{user}}@server.lan hostname", "yes"),
        check: (c) => ran(c, re(String.raw`^ssh\b.*(server\.lan|192\.168\.1\.10)`)) && outLines(c).some((l) => l.trim() === "server"),
      }),
    ],
  });
}
