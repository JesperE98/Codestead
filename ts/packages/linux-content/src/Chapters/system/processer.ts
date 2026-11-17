// Port of Chapters/system/processer.cs – the chapter "processer" (part "system"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { Js, ProcsLib } from "@codestead/linux-shell";
import { cmds, ran, re } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function processer(): Chapter {
  return new Chapter({
    id: "processer",
    part: "system",
    title: "Processer och jobb",
    tasks: [
      new ChapterTask({
        id: "ps",
        text: "Visa processerna i din egen terminal med `ps`.",
        solution: cmds("ps"),
        check: (c) => ran(c, re(String.raw`^ps\s*$`)),
      }),
      new ChapterTask({
        id: "ps-aux",
        text: "Lista **alla** processer på datorn.",
        hint: "`ps aux` (eller `ps -ef`).",
        solution: cmds("ps aux"),
        check: (c) => ran(c, re(String.raw`^ps\s+(-?aux|-ef|-e|-A)\b`)) && c.output.includes("/sbin/init"),
      }),
      new ChapterTask({
        id: "hitta",
        text: "En process slukar nästan all CPU. Visa processerna sorterade efter CPU-användning så att du ser vad den heter.",
        hint: "`top`, `htop` eller `ps aux --sort=-%cpu`.",
        solution: cmds("ps aux --sort=-%cpu"),
        check: (c) => ran(c, re(String.raw`^(top|htop)\b|^ps\b.*--sort[= ]-?%?(cpu|pcpu)`)) && c.output.includes(Js.num(ProcsLib.RunawayPid)),
      }),
      new ChapterTask({
        id: "kill",
        text: "Stoppa den skenande processen (PID " + Js.num(ProcsLib.RunawayPid) + ") med `kill`.",
        solution: cmds(`kill ${Js.num(ProcsLib.RunawayPid)}`),
        check: (c) => !c.sh.proc.procs.some((p) => p.pid === ProcsLib.RunawayPid),
      }),
      new ChapterTask({
        id: "bakgrund",
        text: "Starta `sleep 300` i bakgrunden.",
        hint: "Sätt `&` sist på raden.",
        solution: cmds("sleep 300 &"),
        check: (c) => c.sh.proc.jobs.some((j) => j.state === "Running" && re(String.raw`^sleep\s+300\b`).test(j.cmd)),
      }),
      new ChapterTask({
        id: "jobs",
        text: "Visa dina bakgrundsjobb.",
        solution: cmds("jobs"),
        check: (c) => ran(c, re(String.raw`^jobs\b`)) && c.output.includes("sleep"),
      }),
      new ChapterTask({
        id: "kill-jobb",
        text: "Avsluta bakgrundsjobbet med `kill` och jobbnumret (`%1`) eller dess PID.",
        solution: cmds("kill %1"),
        check: (c) => ran(c, re(String.raw`^kill\b`)) && re("Terminated|Killed").test(c.output),
      }),
      new ChapterTask({
        id: "nohup",
        text: "Starta `sleep 600` i bakgrunden med `nohup`, så att det skulle fortsätta även om du loggade ut.",
        hint: "`nohup sleep 600 &` – `nohup` först och `&` sist.",
        solution: cmds("nohup sleep 600 &"),
        check: (c) => c.sh.proc.jobs.some((j) => j.state === "Running" && re(String.raw`^nohup\s+sleep\s+600\b`).test(j.cmd)),
      }),
      new ChapterTask({
        id: "server",
        text: "Servern `myserver` körs som root. Stoppa den – med `pkill` eller `kill` och rätt behörighet.",
        hint: "Som vanlig användare får du \"Operation not permitted\". Sätt `sudo` framför.",
        solution: cmds("sudo pkill myserver"),
        check: (c) => !c.sh.proc.procs.some((p) => p.pid === ProcsLib.ServerPid),
      }),
    ],
  });
}
