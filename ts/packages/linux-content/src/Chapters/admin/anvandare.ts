// Port of Chapters/admin/anvandare.cs – the chapter "anvandare" (part "admin"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { UsersLib } from "@codestead/linux-shell";
import { cmds, exists, isDir, outLines, ran, re, unsudo, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function anvandare(): Chapter {
  return new Chapter({
    id: "anvandare",
    part: "admin",
    title: "Användare och grupper",
    tasks: [
      new ChapterTask({
        id: "useradd",
        text: "Skapa användaren `kim` med en hemkatalog och `/bin/bash` som skal.",
        hint: "`sudo useradd -m -s /bin/bash kim` – `-m` skapar hemkatalogen och `-s` väljer skalet.",
        solution: cmds("sudo useradd -m -s /bin/bash kim"),
        check: (c) => {
          const kim = UsersLib.findUser(c.sh, "kim");
          return kim !== null && re(String.raw`\/bash$`).test(kim.shell) && isDir(c, kim.home);
        },
      }),
      new ChapterTask({
        id: "passwd-rad",
        text: "Visa kims rad i `/etc/passwd`.",
        hint: "`grep kim /etc/passwd` – eller `getent passwd kim`.",
        solution: cmds("grep kim /etc/passwd"),
        check: (c) => c.exitCode === 0 && re("passwd").test(c.line) && outLines(c).some((l) => l.startsWith("kim:x:")),
      }),
      new ChapterTask({
        id: "losenord",
        text: "Ge `kim` ett lösenord med `passwd`.",
        hint: "Bara root får sätta lösenord åt andra: `sudo passwd kim`. Skriv samma lösenord två gånger – det syns inte när du skriver.",
        solution: cmds("sudo passwd kim", "{{password}}", "{{password}}"),
        check: (c) => (UsersLib.shadowHash(c.sh, "kim") ?? "").startsWith("$"),
      }),
      new ChapterTask({
        id: "grupp",
        text: "Skapa gruppen `{{devGroup}}` och lägg till `kim` i den.",
        hint: "Först `sudo groupadd {{devGroup}}`, sedan `sudo usermod -aG {{devGroup}} kim`.",
        solution: cmds("sudo groupadd {{devGroup}}", "sudo usermod -aG {{devGroup}} kim"),
        check: (c) => UsersLib.findGroup(c.sh, w(c).get("devGroup"))?.members.includes("kim") === true,
      }),
      new ChapterTask({
        id: "sudo-ratt",
        text: "Ge `kim` rätt att använda `sudo` genom att lägga till kontot i gruppen `sudo`.",
        hint: "`sudo usermod -aG sudo kim` – glöm inte `-a`!",
        solution: cmds("sudo usermod -aG sudo kim"),
        check: (c) => UsersLib.findGroup(c.sh, "sudo")?.members.includes("kim") === true,
      }),
      new ChapterTask({
        id: "sudo-u",
        text: "Kör `whoami` som `kim` med `sudo -u`.",
        hint: "`sudo -u kim whoami`",
        solution: cmds("sudo -u kim whoami"),
        check: (c) => ran(c, re(String.raw`^sudo\s+(-\S+\s+)*-u\s*kim\s+whoami\s*$`)) && outLines(c).at(-1) === "kim",
      }),
      new ChapterTask({
        id: "su",
        text: "Logga in som `kim` med `su -` och kör `id`. Gå sedan tillbaka till `{{user}}` med `exit`.",
        hint: "Skriv `su - kim` och sedan kims lösenord – det du valde med `passwd`. Prompten visar att du är kim.",
        solution: cmds("su - kim", "{{password}}", "id", "exit"),
        check: (c) => ran(c, re(String.raw`^id\s*$`)) && c.sh.currentUser().name === "kim",
      }),
      new ChapterTask({
        id: "userdel",
        text: "Skapa en tillfällig användare `{{tempUser}}` med hemkatalog – och ta sedan bort den igen, **inklusive** hemkatalogen.",
        hint: "`sudo useradd -m {{tempUser}}` och sedan `sudo userdel -r {{tempUser}}`.",
        solution: cmds("sudo useradd -m {{tempUser}}", "sudo userdel -r {{tempUser}}"),
        check: (c) =>
          c.exitCode === 0 && re(c, String.raw`^(userdel|deluser)\b.*\b{{tempUser}}\b`).test(unsudo(c.line)) && UsersLib.findUser(c.sh, w(c).get("tempUser")) === null && !exists(c, "/home/{{tempUser}}"),
      }),
    ],
  });
}
