// The optional project of the main chapter "skript": the report robot. The boss wants a summary of the server log on
// the desk every weekday morning, so the learner writes a script (~/{{robotScript}}) that takes the log as its argument,
// checks its input, counts the lines of each level with awk, lists the errors without the date with sed – and schedules
// it with cron, the output going to ~/{{robotLog}}. Its place is set by defineProjects() in ChapterDefinitions.ts; the
// brief is src/Linux/content/chapters/<lang>/skript-project.md.

import { ChapterKinds } from "@codestead/learning";
import { InitfsLib, VfsLib } from "@codestead/linux-shell";
import { cmds, content, cronJobs, every, isFile, mode, outLines, setEquals, w } from "../../Checks.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

const logLines = InitfsLib.ServerLog.split("\n").filter((l) => l !== "");

/** How many lines of the log have each level, upper and lower case counted together (info 9, warn 3, error 3). */
const levelCounts = new Map<string, number>();
for (const l of logLines) {
  const level = l.split(/\s+/)[2]!.toLowerCase();
  levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
}

/** The error lines as time and message, e.g. ["09:15:10", "Could not connect to the database"]. */
const errors = logLines
  .filter((l) => l.includes("ERROR"))
  .map((l) => {
    const m = /^\S+ (\S+) ERROR\s+(.*)$/.exec(l)!;
    return { time: m[1]!, message: m[2]! };
  });
const logDate = logLines[0]!.split(" ")[0]!;

/** The level a word names ("WARN", "warning", "Errors" …), or null. */
function levelOf(word: string): string | null {
  const m = /^(info|warn|error)(ing)?s?$/.exec(word.toLowerCase());
  return m === null ? null : m[1]!;
}

/**
 * The report's lines count every level right: each line that holds one level word and one number (" 3 WARN",
 * "WARN: 3", "ERROR 3" …) has the right number, and there is such a line for every level.
 */
function countsRight(lines: string[]): boolean {
  const seen = new Set<string>();
  for (const l of lines) {
    const words = l.split(/[\s:=,;()|]+/).filter((t) => t !== "");
    const levels = words.map(levelOf).filter((v) => v !== null);
    const numbers = words.filter((t) => /^\d+$/.test(t));
    if (levels.length !== 1 || numbers.length !== 1) continue;
    if (Number(numbers[0]) !== levelCounts.get(levels[0]!)) return false;
    seen.add(levels[0]!);
  }
  return [...levelCounts.keys()].every((k) => seen.has(k));
}

/** The report lists every error with its time and message but without the date – and no INFO lines. */
function errorsRight(lines: string[]): boolean {
  return (
    errors.every((e) => lines.some((l) => l.includes(e.time) && l.includes(e.message) && !l.includes(logDate))) &&
    !lines.some((l) => l.includes("Server starting"))
  );
}

/**
 * The arguments when the command line runs the robot script (`./{{robotScript}}`, `~/{{robotScript}} FILE`,
 * `bash {{robotScript}} FILE` …), without quotes; null when the line runs something else.
 */
function robotArgs(c: CheckContext): string[] | null {
  const name = w(c).get("robotScript").replace(/[.]/g, "\\.");
  const m = new RegExp(`^(?:(?:ba)?sh\\s+)?(?:\\S*/)?${name}((?:\\s+\\S+)*)\\s*$`).exec(c.line);
  if (m === null) return null;
  return m[1]!
    .trim()
    .split(/\s+/)
    .filter((a) => a !== "")
    .map((a) => a.replace(/^(["'])(.*)\1$/, "$2"));
}

/** The robot script's text. */
function script(c: CheckContext): string {
  return content(c, "~/{{robotScript}}");
}

/** Output that is a message of the script's own, not an error from a tool it ran (awk, grep, cat …). */
function ownMessage(c: CheckContext): boolean {
  const lines = outLines(c);
  return lines.length > 0 && !lines.some((l) => /^(m?awk|grep|sed|sort|uniq|cat|wc|tr|head|tail|cut):/.test(l));
}

/** The robot ran on a file that exists. */
function ranOnFile(c: CheckContext): boolean {
  const args = robotArgs(c);
  if (args === null || args.length !== 1) return false;
  const p = args[0]!.startsWith("~") ? w(c).home + args[0]!.slice(1) : VfsLib.resolvePath(c.sh.cwd, args[0]!);
  return isFile(c, p);
}

export function skriptProject(): Chapter {
  return new Chapter({
    id: "skript-project",
    part: "skript",
    kind: ChapterKinds.Project,
    title: "Projekt: Rapportroboten",
    tasks: [
      new ChapterTask({
        id: "robot-born",
        text: "Skapa skriptet `~/{{robotScript}}` med en shebang-rad och en rad som skriver ut en rubrik. Gör det körbart och kör det.",
        hint: "Skriv skriptet med `cat > ~/{{robotScript}} << '{{heredocEnd}}'`, börja med `#!/bin/bash` och avsluta med `{{heredocEnd}}`. Sedan `chmod +x` och `./{{robotScript}}` i hemkatalogen.",
        solution: cmds(
          "cd ~",
          "cat > ~/{{robotScript}} << '{{heredocEnd}}'",
          "#!/bin/bash",
          "echo \"Daily report\"",
          "{{heredocEnd}}",
          "chmod +x ~/{{robotScript}}",
          "./{{robotScript}}",
        ),
        check: (c) => robotArgs(c) !== null && script(c).startsWith("#!") && (mode(c, "~/{{robotScript}}") & 0o100) !== 0 && c.output.trim() !== "",
      }),
      new ChapterTask({
        id: "usage",
        text:
          "Roboten ska få loggfilen som första argument. Körs den **utan** argument ska den skriva ut hur den används och " +
          "avsluta med en annan slutkod än 0. Prova!",
        hint: "`$#` är antalet argument – jämför det med `-eq 0` i ett `if`. `exit 1` avslutar skriptet med slutkod 1.",
        solution: cmds(
          "cat > ~/{{robotScript}} << '{{heredocEnd}}'",
          "#!/bin/bash",
          "if [ $# -eq 0 ]; then",
          "  echo \"Usage: $0 FILE\"",
          "  exit 1",
          "fi",
          "echo \"Daily report for $1\"",
          "{{heredocEnd}}",
          "./{{robotScript}}",
        ),
        check: (c) => robotArgs(c)?.length === 0 && c.exitCode !== 0 && ownMessage(c) && script(c).includes("exit"),
      }),
      new ChapterTask({
        id: "missing-file",
        text: "Om filen i argumentet inte finns ska roboten säga det och avsluta med en annan slutkod än 0. Prova med ett filnamn som inte finns.",
        hint: "`[ -f \"$1\" ]` är sant om filen finns, och `!` vänder på villkoret. Felmeddelanden skickas gärna till stderr med `>&2`.",
        solution: cmds(
          "cat > ~/{{robotScript}} << '{{heredocEnd}}'",
          "#!/bin/bash",
          "if [ $# -eq 0 ]; then",
          "  echo \"Usage: $0 FILE\"",
          "  exit 1",
          "fi",
          "if [ ! -f \"$1\" ]; then",
          "  echo \"Cannot find $1\" >&2",
          "  exit 2",
          "fi",
          "echo \"Daily report for $1\"",
          "{{heredocEnd}}",
          "./{{robotScript}} {{missing}}.log",
        ),
        check: (c) => {
          const args = robotArgs(c);
          return args?.length === 1 && !ranOnFile(c) && c.exitCode !== 0 && ownMessage(c) && script(c).includes("exit");
        },
      }),
      new ChapterTask({
        id: "levels",
        text:
          "Nu det viktiga: kör på `~/{{documents}}/server.log` ska roboten skriva ut hur många rader loggen har av varje nivå, " +
          "räknat med `awk`. `WARN` och `warn` är samma nivå!",
        hint:
          "Nivån är fält 3: `awk '{print $3}' \"$1\"`. Gör om den till versaler med `toupper($3)`, och räkna sedan med `sort | uniq -c`.",
        solution: cmds(
          "cat > ~/{{robotScript}} << '{{heredocEnd}}'",
          "#!/bin/bash",
          "if [ $# -eq 0 ]; then",
          "  echo \"Usage: $0 FILE\"",
          "  exit 1",
          "fi",
          "if [ ! -f \"$1\" ]; then",
          "  echo \"Cannot find $1\" >&2",
          "  exit 2",
          "fi",
          "echo \"Daily report for $1\"",
          "awk '{print toupper($3)}' \"$1\" | sort | uniq -c",
          "{{heredocEnd}}",
          "./{{robotScript}} ~/{{documents}}/server.log",
        ),
        check: (c) => ranOnFile(c) && c.exitCode === 0 && script(c).includes("awk") && countsRight(outLines(c)),
      }),
      new ChapterTask({
        id: "error-list",
        text:
          "Under siffrorna ska rapporten lista alla fel – med klockslag och meddelande men **utan** datumet, som ändå är " +
          "detsamma på alla rader. Ta bort datumet med `sed`.",
        hint: "`grep ERROR \"$1\"` plockar ut felen, och `sed 's/^[0-9-]* //'` tar bort allt fram till första mellanslaget.",
        solution: cmds(
          "cat > ~/{{robotScript}} << '{{heredocEnd}}'",
          "#!/bin/bash",
          "if [ $# -eq 0 ]; then",
          "  echo \"Usage: $0 FILE\"",
          "  exit 1",
          "fi",
          "if [ ! -f \"$1\" ]; then",
          "  echo \"Cannot find $1\" >&2",
          "  exit 2",
          "fi",
          "echo \"Daily report for $1\"",
          "awk '{print toupper($3)}' \"$1\" | sort | uniq -c",
          "echo \"Errors:\"",
          "grep ERROR \"$1\" | sed 's/^[0-9-]* //'",
          "{{heredocEnd}}",
          "./{{robotScript}} ~/{{documents}}/server.log",
        ),
        check: (c) => ranOnFile(c) && c.exitCode === 0 && countsRight(outLines(c)) && errorsRight(outLines(c)),
      }),
      new ChapterTask({
        id: "schedule",
        text:
          "Schemalägg roboten: den ska köras på `~/{{documents}}/server.log` klockan 06.30 måndag till fredag, och " +
          "utskriften ska läggas till i `~/{{robotLog}}`. Behåll dina gamla jobb.",
        hint:
          "Minut 30, timme 6, veckodag 1-5. Lägg till jobbet utan att ta bort de gamla med `(crontab -l; echo '…') | crontab -`, " +
          "och avsluta jobbraden med `>> ~/{{robotLog}} 2>&1`.",
        solution: cmds("(crontab -l; echo '30 6 * * 1-5 ~/{{robotScript}} ~/{{documents}}/server.log >> ~/{{robotLog}} 2>&1') | crontab -"),
        check: (c) =>
          cronJobs(c).some(
            (j) =>
              setEquals(j.when[0]!, [30]) &&
              setEquals(j.when[1]!, [6]) &&
              every(j.when[2]!, 1, 31) &&
              every(j.when[3]!, 1, 12) &&
              setEquals(j.when[4]!, [1, 2, 3, 4, 5]) &&
              j.command.includes(w(c).get("robotScript")) &&
              j.command.includes("server.log") &&
              new RegExp(`>\\s*\\S*${w(c).get("robotLog").replace(/[.]/g, "\\.")}`).test(j.command),
          ),
      }),
      new ChapterTask({
        id: "rehearsal",
        text: "Generalrepetition: kör jobbets kommando för hand en gång, så att dagens rapport hamnar i `~/{{robotLog}}`.",
        hint: "Kopiera kommandot efter de fem tidsfälten i `crontab -l` och kör det. Titta sedan i filen med `cat`.",
        solution: cmds("~/{{robotScript}} ~/{{documents}}/server.log >> ~/{{robotLog}} 2>&1", "cat ~/{{robotLog}}"),
        check: (c) => {
          const lines = content(c, "~/{{robotLog}}").split("\n");
          return countsRight(lines) && errorsRight(lines);
        },
      }),
    ],
  });
}
