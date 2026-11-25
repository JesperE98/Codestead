// The optional project of the main chapter "system": the clubhouse. The learner sets up a secret club on the
// computer with what the part taught – permissions (chmod), an executable script, an environment variable, a
// symbolic link, a background job with nohup, a tar.gz backup and kill. Its place is set by defineProjects() in
// ChapterDefinitions.ts; the brief is src/Linux/content/chapters/<lang>/system-project.md.

import { ChapterKinds } from "@codestead/learning";
import { Js } from "@codestead/linux-shell";
import { abs, archiveHas, cmds, content, exported, home, isDir, linkNode, mode, node, ran, re, realPath } from "../../Checks.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

/** The night watch: a background job `nohup sleep …` that is still running. */
function watchRunning(c: CheckContext): boolean {
  return c.sh.proc.jobs.some((j) => j.state === "Running" && re(String.raw`^nohup\s+sleep\s`).test(j.cmd));
}

export function systemProject(): Chapter {
  return new Chapter({
    id: "system-project",
    part: "system",
    kind: ChapterKinds.Project,
    title: "Projekt: Klubbhuset",
    tasks: [
      new ChapterTask({
        id: "clubhouse",
        text: "Bygg klubbhuset: katalogen `~/{{clubDir}}`, där **bara du** får läsa, skriva och gå in (`rwx------`).",
        hint: "Skapa katalogen med `mkdir` och ändra rättigheterna med `chmod`. r = 4, w = 2, x = 1 – och gruppen och övriga ska ha 0.",
        solution: cmds("mkdir ~/{{clubDir}}", "chmod 700 ~/{{clubDir}}"),
        check: (c) => isDir(c, "~/{{clubDir}}") && (mode(c, "~/{{clubDir}}") & Js.oct(777)) === Js.oct(700),
      }),
      new ChapterTask({
        id: "knock",
        text:
          "Skriv dörrvaktsskriptet `~/{{clubDir}}/{{knockScript}}`, som skriver ut klubbens lösenord med `echo`. " +
          "Gör det körbart och kör det.",
        hint:
          "Skriv raden till filen med `echo '…' > fil` (enkla citattecken runt raden), gör den körbar med `chmod +x` " +
          "och kör den med sökvägen, t.ex. `./{{knockScript}}` när du står i klubbhuset.",
        solution: cmds("echo 'echo swordfish' > ~/{{clubDir}}/{{knockScript}}", "chmod +x ~/{{clubDir}}/{{knockScript}}", "~/{{clubDir}}/{{knockScript}}"),
        check: (c) =>
          (mode(c, "~/{{clubDir}}/{{knockScript}}") & Js.oct(100)) !== 0 &&
          re(String.raw`\becho\b`).test(content(c, "~/{{clubDir}}/{{knockScript}}")) &&
          ran(c, re(c, String.raw`^((ba)?sh\s+)?(\S*\/)?{{knockScript}}\s*$`)) &&
          c.output.trim() !== "",
      }),
      new ChapterTask({
        id: "variable",
        text: "Skapa miljövariabeln `{{clubVar}}` med hela sökvägen till klubbhuset, så att `cd ${{clubVar}}` tar dig dit.",
        hint: "`export NAMN=värde` – utan mellanslag runt `=`. Värdet kan vara `~/{{clubDir}}` eller `$HOME/{{clubDir}}`.",
        solution: cmds("export {{clubVar}}=~/{{clubDir}}"),
        check: (c) => {
          let v = exported(c, "{{clubVar}}");
          if (v === null) return false;
          if (v === "~" || v.startsWith("~/")) v = home(c) + v.slice(1);
          return v.startsWith("/") && node(c, v)?.type === "dir" && realPath(c, v) === abs(c, "~/{{clubDir}}");
        },
      }),
      new ChapterTask({
        id: "wardrobe",
        text: "Göm en hemlig ingång: en symbolisk länk `~/{{documents}}/{{wardrobe}}` som leder rakt in i klubbhuset.",
        hint: "`ln -s MÅL LÄNKNAMN` – målet först. Med en absolut sökväg som mål spelar det ingen roll var du står.",
        solution: cmds("ln -s ~/{{clubDir}} ~/{{documents}}/{{wardrobe}}"),
        check: (c) => linkNode(c, "~/{{documents}}/{{wardrobe}}")?.type === "link" && realPath(c, "~/{{documents}}/{{wardrobe}}") === abs(c, "~/{{clubDir}}"),
      }),
      new ChapterTask({
        id: "night-watch",
        text:
          "Ställ ut en nattvakt: kör `sleep 3600` i bakgrunden, så att den håller vakt i en timme – " +
          "och fortsätter även om du loggar ut.",
        hint: "`&` sist på raden kör kommandot i bakgrunden, och `nohup` först gör att det överlever att du loggar ut.",
        solution: cmds("nohup sleep 3600 &"),
        check: (c) => re(String.raw`\bnohup\s+sleep\s`).test(c.line) && watchRunning(c),
      }),
      new ChapterTask({
        id: "backup",
        text: "Gör en säkerhetskopia av hela klubbhuset: det komprimerade arkivet `~/{{clubBackup}}`.",
        hint:
          "Stå i hemkatalogen och använd `tar` med `c` (skapa), `z` (gzip) och `f` följt av arkivets namn – " +
          "sist katalogen som ska packas.",
        solution: cmds("cd ~", "tar -czvf {{clubBackup}} {{clubDir}}"),
        check: (c) => archiveHas(c, "~/{{clubBackup}}", "tar.gz", "{{clubDir}}/{{knockScript}}"),
      }),
      new ChapterTask({
        id: "dismiss",
        text: "Morgonen är här: skicka hem nattvakten genom att avsluta processen.",
        hint: "`jobs` visar nattvaktens jobbnummer och `ps` dess PID. Avsluta den med `kill %NUMMER`, `kill PID` eller `pkill sleep`.",
        solution: cmds("pkill sleep"),
        check: (c) => ran(c, re(String.raw`^(sudo\s+)?(kill|pkill|killall)\b`)) && !watchRunning(c),
      }),
    ],
  });
}
