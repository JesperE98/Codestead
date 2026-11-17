// Port of Chapters/system/lankar.cs – the chapter "lankar" (part "system"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { Js } from "@codestead/linux-shell";
import { abs, cmds, linkNode, node, ran, re, realPath, x } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function lankar(): Chapter {
  return new Chapter({
    id: "lankar",
    part: "system",
    title: "Länkar och filinformation",
    tasks: [
      new ChapterTask({
        id: "symlink",
        text: "Skapa en symbolisk länk `~/log` som pekar på katalogen `/var/log`.",
        hint: "`ln -s MÅL LÄNKNAMN` – målet först: `ln -s /var/log ~/log`.",
        solution: cmds("ln -s /var/log ~/log"),
        check: (c) => linkNode(c, "~/log")?.type === "link" && realPath(c, "~/log") === "/var/log",
      }),
      new ChapterTask({
        id: "relative",
        text: "Stå i hemkatalogen och skapa länken `{{fruits}}` som pekar på `{{documents}}/{{fruits}}` – med en relativ sökväg.",
        hint: "`cd ~` och sedan `ln -s {{documents}}/{{fruits}} {{fruits}}`. En relativ sökväg i länken räknas från katalogen där länken ligger.",
        solution: cmds("cd ~", "ln -s {{documents}}/{{fruits}} {{fruits}}"),
        check: (c) => {
          const l = linkNode(c, "~/{{fruits}}");
          return (
            l?.type === "link" &&
            !(l.content ?? "").startsWith("/") &&
            realPath(c, "~/{{fruits}}") === abs(c, "~/{{documents}}/{{fruits}}")
          );
        },
      }),
      new ChapterTask({
        id: "readlink",
        text: "Visa vart länken `~/{{fruits}}` pekar med `readlink`.",
        solution: cmds("readlink ~/{{fruits}}"),
        check: (c) => ran(c, re(String.raw`^readlink\b`)) && c.output.includes(x(c, "{{documents}}/{{fruits}}")),
      }),
      new ChapterTask({
        id: "hardlink",
        text: "Ge `~/{{notes}}` ett namn till: en **hård** länk som heter `~/{{todo}}`.",
        hint: "`ln` utan `-s`: `ln ~/{{notes}} ~/{{todo}}`. Med `ls -li` ser du att båda har samma inodnummer.",
        solution: cmds("ln ~/{{notes}} ~/{{todo}}"),
        check: (c) => {
          const t = linkNode(c, "~/{{todo}}");
          return t?.type === "file" && t === linkNode(c, "~/{{notes}}");
        },
      }),
      new ChapterTask({
        id: "stat",
        text: "Ta reda på rättigheterna för `/etc/shadow` som siffror med `stat`.",
        hint: "`stat /etc/shadow` och titta på raden `Access: (0640/...)` – eller bara `stat -c %a /etc/shadow`.",
        solution: cmds("stat -c %a /etc/shadow"),
        check: (c) => ran(c, re(String.raw`^stat\b.*\/etc\/shadow\b`)) && re(String.raw`\b0?640\b`).test(c.output),
      }),
      new ChapterTask({
        id: "file",
        text: "Ta reda på vad `~/{{documents}}/{{grades}}` innehåller med `file`.",
        solution: cmds("file ~/{{documents}}/{{grades}}"),
        check: (c) => ran(c, re(String.raw`^file\b`)) && c.output.includes("CSV"),
      }),
      new ChapterTask({
        id: "umask",
        text: "Ändra umask så att nya filer bara kan läsas och skrivas av dig, och skapa sedan den tomma filen `~/{{privateFile}}`.",
        hint: "`umask 077` tar bort alla rättigheter för gruppen och övriga. Skapa sedan filen med `touch ~/{{privateFile}}` – den får `rw-------`.",
        solution: cmds("umask 077", "touch ~/{{privateFile}}"),
        check: (c) => {
          const f = node(c, "~/{{privateFile}}");
          return (c.sh.vfs.umask & Js.oct(77)) === Js.oct(77) && f?.type === "file" && (f.mode & Js.oct(777)) === Js.oct(600);
        },
      }),
      new ChapterTask({
        id: "umask-back",
        text: "Sätt tillbaka umask till det vanliga värdet `022`.",
        solution: cmds("umask 022"),
        check: (c) => c.sh.vfs.umask === Js.oct(22) && ran(c, re(String.raw`^umask\s`)),
      }),
    ],
  });
}
