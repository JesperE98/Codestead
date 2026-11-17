// Port of Chapters/admin/systemd.cs – the chapter "systemd" (part "admin"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, isFile, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function systemd(): Chapter {
  return new Chapter({
    id: "systemd",
    part: "admin",
    title: "Tjänster och loggar med systemd",
    tasks: [
      new ChapterTask({
        id: "status-ssh",
        text: "Visa status för SSH-servern med `systemctl status`. Tänk på vad tjänsten heter i Ubuntu!",
        hint: "I Ubuntu heter tjänsten `ssh`: `systemctl status ssh`.",
        solution: cmds("systemctl status ssh"),
        check: (c) =>
          re(String.raw`\bsystemctl\b.*\bstatus\b`).test(c.line) && c.output.includes("ssh.service - "),
      }),
      new ChapterTask({
        id: "failed",
        text: "En tjänst verkar inte ha startat. Lista alla tjänster som har misslyckats (*failed*).",
        hint: "`systemctl --failed` (eller `systemctl list-units --state=failed`).",
        solution: cmds("systemctl --failed"),
        check: (c) => ran(c, re(String.raw`\bsystemctl\b.*(--failed|--state[= ]\S*failed)`)) && c.output.includes("loaded units listed"),
      }),
      new ChapterTask({
        id: "journal-err",
        text: "Visa bara felmeddelandena (prioritet *err* och allvarligare) från den här uppstarten i journalen.",
        hint: "`-p err` väljer prioritet och `-b` den senaste uppstarten: `journalctl -p err -b`.",
        solution: cmds("journalctl -p err -b"),
        check: (c) =>
          ran(c, re(String.raw`\bjournalctl\b`)) &&
          re(String.raw`(^|\s)(-\w*p\s*|--priority[= ])(err|error|3|0\.\.3|emerg\.\.err)(\s|$)`).test(c.line) &&
          re(String.raw`(^|\s)(-\w*b\w*|--boot)\b`).test(c.line),
      }),
      new ChapterTask({
        id: "journal-u",
        text: "Läs loggen för den trasiga tjänsten `reportd` med `journalctl`. Varför startar den inte?",
        hint: "`-u` visar bara raderna från en tjänst: `journalctl -u reportd`. Med `-xe` hoppar du till slutet och får förklaringar.",
        solution: cmds("journalctl -u reportd"),
        check: (c) => ran(c, re(String.raw`\bjournalctl\b.*\breportd\b`)) && c.output.includes("reportd.conf"),
      }),
      new ChapterTask({
        id: "fix",
        text: "Rätta felet som loggen berättar om och starta sedan om `reportd` med `systemctl`, så att den kör.",
        hint: "Konfigurationsfilen saknas, men det finns ett exempel: `sudo cp /etc/reportd.conf.example /etc/reportd.conf`. Starta sedan om med `sudo systemctl restart reportd`.",
        solution: cmds("sudo cp /etc/reportd.conf.example /etc/reportd.conf", "sudo systemctl restart reportd"),
        check: (c) => re(String.raw`\bsystemctl\b.*\breportd\b`).test(c.line) && c.sh.services.units.get("reportd.service")?.active === "active",
      }),
      new ChapterTask({
        id: "start-myserver",
        text: "Starta tjänsten `myserver` (om den inte redan kör) och visa sedan dess status. Vilket PID fick den?",
        hint: "`sudo systemctl start myserver` och sedan `systemctl status myserver`.",
        solution: cmds("sudo systemctl start myserver", "systemctl status myserver"),
        check: (c) => ran(c, re(String.raw`\bsystemctl\b.*\bstatus\b.*\bmyserver\b`)) && c.output.includes("active (running)"),
      }),
      new ChapterTask({
        id: "stop",
        text: "Stoppa `myserver` med `systemctl`. Kontrollera gärna med `pgrep myserver` att processen är borta.",
        hint: "`sudo systemctl stop myserver`",
        solution: cmds("sudo systemctl stop myserver", "pgrep myserver"),
        check: (c) =>
          ran(c, re(String.raw`\bsystemctl\b.*\bstop\b.*\bmyserver\b`)) && !c.sh.proc.procs.some((p) => p.cmd.includes("/myserver")),
      }),
      new ChapterTask({
        id: "enable",
        text: "Se till att `myserver` startar automatiskt varje gång datorn startar – och starta den nu också, med ett enda kommando.",
        hint: "`enable` gäller vid uppstart och `--now` startar den direkt: `sudo systemctl enable --now myserver`.",
        solution: cmds("sudo systemctl enable --now myserver"),
        check: (c) =>
          re(String.raw`\bsystemctl\b.*\benable\b`).test(c.line) &&
          isFile(c, "/etc/systemd/system/multi-user.target.wants/myserver.service") &&
          c.sh.services.units.get("myserver.service")?.active === "active",
      }),
    ],
  });
}
