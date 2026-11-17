// Port of Chapters/skript/schemalaggning.cs – the chapter "schemalaggning" (part "skript"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { cmds, cronJobs, every, ran, re, setEquals, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function schemalaggning(): Chapter {
  return new Chapter({
    id: "schemalaggning",
    part: "skript",
    title: "Schemalagda jobb med cron",
    tasks: [
      new ChapterTask({
        id: "crontab-l",
        text: "Visa din crontab.",
        hint: "`crontab -l`. Har du inga jobb än svarar den *no crontab for {{user}}*.",
        solution: cmds("crontab -l"),
        check: (c) => re(String.raw`^crontab\s+-l\s*$`).test(c.line) && (c.exitCode === 0 || c.output.includes("no crontab for")),
      }),
      new ChapterTask({
        id: "every-minute",
        text: "Lägg till ett jobb som kör `date >> ~/cron.log` varje minut.",
        hint: "Fem stjärnor betyder varje minut: `echo '* * * * * date >> ~/cron.log' | crontab -`.",
        solution: cmds("echo '* * * * * date >> ~/cron.log' | crontab -"),
        check: (c) => cronJobs(c).some((j) => every(j.when[0]!, 0, 59) && every(j.when[1]!, 0, 23) && j.command.includes("date") && j.command.includes("cron.log")),
      }),
      new ChapterTask({
        id: "weekdays",
        text: "Lägg till ett jobb som kör `~/{{helloScript}}` klockan 07.00 måndag till fredag – utan att ta bort det första jobbet.",
        hint: "Minut 0, timme 7, veckodag 1-5. Behåll de gamla raderna: `(crontab -l; echo '0 7 * * 1-5 ~/{{helloScript}}') | crontab -`.",
        solution: cmds("(crontab -l; echo '0 7 * * 1-5 ~/{{helloScript}}') | crontab -"),
        check: (c) => {
          const jobs = cronJobs(c);
          return (
            jobs.some((j) => j.command.includes("cron.log")) &&
            jobs.some(
              (j) =>
                setEquals(j.when[0]!, [0]) &&
                setEquals(j.when[1]!, [7]) &&
                every(j.when[2]!, 1, 31) &&
                every(j.when[3]!, 1, 12) &&
                setEquals(j.when[4]!, [1, 2, 3, 4, 5]) &&
                j.command.includes(w(c).get("helloScript")),
            )
          );
        },
      }),
      new ChapterTask({
        id: "journal",
        text: "Visa vad tjänsten `cron` har skrivit i journalen.",
        hint: "`journalctl -u cron`. När ditt jobb har körts står det där som *CMD (date >> ~/cron.log)*.",
        solution: cmds("journalctl -u cron"),
        check: (c) => ran(c, re(String.raw`^(sudo\s+)?journalctl\b.*-u\s*cron\b`)) && c.output.includes("cron"),
      }),
      new ChapterTask({
        id: "timers",
        text: "Visa systemd:s timers – jobben som systemd själv kör på bestämda tider.",
        solution: cmds("systemctl list-timers"),
        check: (c) => ran(c, re(String.raw`^systemctl\s+(-\S+\s+)*list-timers\b`)),
      }),
      new ChapterTask({
        id: "remove",
        text: "Ta bort jobbet som körs varje minut, men behåll jobbet klockan 07.00.",
        hint: "Filtrera bort raden med `grep -v` och installera resten: `crontab -l | grep -v cron.log | crontab -`.",
        solution: cmds("crontab -l | grep -v cron.log | crontab -"),
        check: (c) => {
          const jobs = cronJobs(c);
          return !jobs.some((j) => j.command.includes("cron.log")) && jobs.some((j) => j.command.includes(w(c).get("helloScript")));
        },
      }),
    ],
  });
}
