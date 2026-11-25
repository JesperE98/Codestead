// The optional project of the main chapter "natverk": the website is down. The company's website is myserver on
// port 8080 of the learner's own computer. The learner works from the inside out with what the part taught – the
// address and the gateway, ping, ss, curl – and writes it all down in an incident log, then puts a key on the
// server server.lan, backs the log up there and reads it over ssh without a password. Its place is set by
// defineProjects() in ChapterDefinitions.ts; the brief is src/Linux/content/chapters/<lang>/natverk-project.md.

import { ChapterKinds } from "@codestead/learning";
import { cmds, content, outLines, ran, re, serverNode, unsudo } from "../../Checks.js";
import { SshCmd } from "../../ShellCommands.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

const logPath = "~/{{incidentDir}}/{{incidentLog}}";

/** The incident log on the learner's computer. */
function incidentLog(c: CheckContext): string {
  return content(c, logPath);
}

/** The copy of the incident log in the home directory on the server ("" when there is none). */
function serverLog(c: CheckContext): string {
  const n = serverNode(c, logPath);
  return n?.type === "file" ? (n.content ?? "") : "";
}

/** The log holds the response headers of the website: status 200 from myserver. */
function hasHeaders(log: string): boolean {
  return re(String.raw`^HTTP\/[0-9.]+ 200 OK`, "m").test(log) && log.includes("myserver");
}

/** The log holds a ping to a name on the internet where every packet came back. */
function hasPingOut(log: string): boolean {
  const lines = log.split("\n").map((l) => l.trim());
  return lines.some((l, i) => {
    const m = re(String.raw`^--- (\S+) ping statistics ---$`).exec(l);
    if (m === null) return false;
    const host = m[1]!.toLowerCase();
    const name = re("[a-z]").test(host) && host.includes(".") && !host.endsWith(".lan") && !host.startsWith("localhost");
    const stats = re(String.raw`^(\d+) packets transmitted, (\d+) received`).exec(lines[i + 1] ?? "");
    return name && stats !== null && Number(stats[1]) > 0 && stats[1] === stats[2];
  });
}

export function natverkProject(): Chapter {
  return new Chapter({
    id: "natverk-project",
    part: "natverk",
    kind: ChapterKinds.Project,
    title: "Projekt: Webbplatsen ligger nere!",
    tasks: [
      new ChapterTask({
        id: "facts",
        text: "Börja en incidentlogg, `" + logPath + "`, med datorns IP-adress och gatewayens adress.",
        hint: "`ip a` visar adressen och `ip route` gatewayen (raden `default via`). Skicka utskriften till loggen med `>` och `>>`.",
        solution: cmds("mkdir -p ~/{{incidentDir}}", `ip a > ${logPath}`, `ip route >> ${logPath}`),
        check: (c) => {
          const log = incidentLog(c);
          return log.includes("192.168.1.42") && re(String.raw`192\.168\.1\.1(?![0-9])`).test(log);
        },
      }),
      new ChapterTask({
        id: "ping-out",
        text: "Visa att nätet fungerar hela vägen ut på internet – namnuppslagning inräknad. Lägg till en ping med tre paket till ett namn på internet i loggen.",
        hint: "Pinga ett **namn**, inte en adress, så testar du DNS också: `ping -c 3 example.com`, och avsluta med `>>`.",
        solution: cmds(`ping -c 3 example.com >> ${logPath}`),
        check: (c) => hasPingOut(incidentLog(c)),
      }),
      new ChapterTask({
        id: "listening",
        text: "Webbplatsen är myserver på port 8080. Ta reda på om något lyssnar på porten – och om inget gör det, starta webbservern och kontrollera igen.",
        hint: "`ss -tulpn` visar portarna som lyssnar. Saknas 8080 startar du servern med `myserver` (eller med `systemctl`).",
        solution: cmds("ss -tulpn"),
        check: (c) =>
          c.exitCode === 0 &&
          re(String.raw`^(ss|netstat)\b`).test(unsudo(c.line)) &&
          outLines(c).some((l) => re(String.raw`:8080\b`).test(l) && l.includes("LISTEN")),
      }),
      new ChapterTask({
        id: "headers",
        text: "Svarar webbplatsen som den ska? Lägg till svarshuvudena från startsidan, `http://localhost:8080`, i loggen. Statuskoden ska vara 200.",
        hint: "`curl -I` hämtar bara huvudena. I Ubuntu måste curl installeras först: `sudo apt install curl`.",
        solution: cmds(`curl -I http://localhost:8080 >> ${logPath}`),
        check: (c) => hasHeaders(incidentLog(c)),
      }),
      new ChapterTask({
        id: "key",
        text: "Nästa gång vill du in på servern `server.lan` utan lösenord. Skapa ett nyckelpar och lägg den publika nyckeln på servern.",
        hint:
          "`ssh-keygen` skapar nyckelparet – tryck Enter på frågorna. `ssh-copy-id` lägger sedan den publika nyckeln på servern, " +
          "till exempel `ssh-copy-id srv`.",
        solution: cmds("ssh-keygen -f ~/.ssh/id_ed25519 -N ''", "ssh-copy-id srv"),
        check: (c) => {
          const pub = SshCmd.publicKey(c.sh)?.trim() ?? "";
          return (
            ran(c, re(String.raw`^ssh-copy-id\b`)) && pub !== "" && (serverNode(c, "~/.ssh/authorized_keys")?.content ?? "").includes(pub)
          );
        },
      }),
      new ChapterTask({
        id: "backup",
        text: "Säkerhetskopiera hela mappen `~/{{incidentDir}}` till din hemkatalog på servern, så att loggen finns kvar även om din dator ger upp.",
        hint: "`rsync -av` med ett snedstreck efter källan kopierar innehållet: `rsync -av ~/{{incidentDir}}/ srv:{{incidentDir}}/`. `scp -r` fungerar också.",
        solution: cmds("rsync -av ~/{{incidentDir}}/ srv:{{incidentDir}}/"),
        check: (c) => {
          const log = incidentLog(c);
          return ran(c, re(String.raw`^(rsync|scp)\b`)) && hasHeaders(log) && serverLog(c) === log;
        },
      }),
      new ChapterTask({
        id: "remote-read",
        text: "Visa loggen som ligger på servern med `ssh` – utan att någon frågar efter ett lösenord.",
        hint: "Skriv kommandot efter värden: `ssh srv cat {{incidentDir}}/{{incidentLog}}`. Frågar ssh efter lösenord ligger nyckeln inte på plats.",
        solution: cmds("ssh srv cat {{incidentDir}}/{{incidentLog}}"),
        check: (c) => {
          const remote = serverLog(c)
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l !== "");
          return (
            ran(c, re(String.raw`^ssh\b`)) &&
            re(c, String.raw`{{incidentLog}}`).test(c.line) &&
            !c.output.includes("password:") &&
            outLines(c).some((l) => remote.includes(l.trim()))
          );
        },
      }),
    ],
  });
}
