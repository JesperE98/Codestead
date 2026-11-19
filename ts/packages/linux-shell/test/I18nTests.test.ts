// Port of tests/Linux/Codestead.Shell.Tests/I18nTests.cs (src/shell/i18n.test.ts).

import { describe, expect, it } from "vitest";
import * as IndexCmd from "../src/Commands/IndexCmd.js";
import * as ManEnCmd from "../src/Commands/Man/ManEnCmd.js";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import * as PackagesLib from "../src/Packages/PackagesLib.js";
import * as ProcsLib from "../src/Procs/ProcsLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { itNeeds, TestShell } from "./TestShell.js";

const swedish = /[åäöÅÄÖ]/;
const swedishHeadings = /^(NAMN|BESKRIVNING|FLAGGOR|EXEMPEL|VARNING|TIPS FRÅN)(?![\p{L}\p{Mn}\p{Nd}\p{Pc}])/mu;
const exerciseNames = /frukter|dokument|betyg|anteckningar|välkommen/g;
const nameHeading = /^NAME\n/;
const namnHeading = /^NAMN\n/;

const newShell = (distro = "ubuntu", lang = "en"): TestShell => new TestShell(distro, lang);

function notMatch(re: RegExp, s: string, label: string): void {
  expect(re.test(s), `${label}: expected not to match ${re}:\n${s}`).toBe(false);
}

describe("I18nTests", () => {
  // ---------- engelska manualsidor ----------

  it("varje kommando har en engelsk sammanfattning", () => {
    const sv = Shell.create("ubuntu", "sv");
    const sh = newShell().sh;
    for (const def of IndexCmd.commands().values()) {
      if (def.name.startsWith("__")) continue; // hidden internal helper commands
      const en = ManEnCmd.summaryFor(def, sh);
      expect(en !== ManEnCmd.summaryFor(def, sv), `${def.name}: English summary equals the Swedish one: ${en}`).toBe(true);
      notMatch(swedish, en, def.name);
    }
  });

  it("varje kommando har en engelsk manualsida", () => {
    const sh = newShell().sh;
    for (const def of IndexCmd.commands().values()) {
      if (def.name.startsWith("__")) continue;
      const man = ManEnCmd.manFor(def, sh);
      expect(nameHeading.test(man), `${def.name}: expected to start with NAME:\n${man}`).toBe(true);
      notMatch(swedishHeadings, man, def.name);
      // Examples may use the Swedish names of the exercise files, but not Swedish text.
      notMatch(swedish, man.replace(exerciseNames, ""), def.name);
    }
  });

  itNeeds(["ls", "cd"], "svenska är oförändrat", () => {
    const sh = newShell("ubuntu", "sv").sh;
    expect(ManEnCmd.manFor(IndexCmd.commands().get("ls")!, sh)).toMatch(namnHeading);
    expect(ManEnCmd.summaryFor(IndexCmd.commands().get("cd")!, sh)).toBe("Byter aktuell katalog");
  });

  itNeeds(["man", "ls", "cp", "help"], "man, --help och help på engelska", () => {
    const t = newShell();
    const man = t.run("man ls").out;
    expect(man).toContain("Simulated manual");
    expect(man).toContain("DESCRIPTION");
    expect(man).toContain("-a, --all");
    expect(t.run("cp --help").out).toContain("copy files and directories");
    const help = t.run("help").out;
    expect(help).toContain("Commands in this simulated terminal");
    expect(help).toContain("Changes the current directory");
    notMatch(swedish, help, "help");

    const sv = newShell("ubuntu", "sv");
    expect(sv.run("man ls").out).toContain("Simulerad manual");
    expect(sv.run("help").out).toContain("Kommandon i den här simulerade terminalen");
  });

  // ---------- simulatorns tipsrader på engelska ----------

  it("välkomsttexten", () => {
    const sh = newShell().sh;
    expect(UtilCmd.stripAnsi(sh.welcome())).toContain("Simulated terminal");
    notMatch(swedish, sh.welcome(), "welcome");
    expect(Shell.create("ubuntu", "sv").welcome()).toContain("Simulerad terminal");
  });

  const outputCommands = [
    "help", "man", "ls", "sudo", "whoami", "su", "bash", "nano", "vim", "htop", "git", "curl", "wget", "ssh", "python3", "top", "kill",
    "sleep", "fg", "tail", "awk", "sed", "echo", "read", "printf", "true", "cowsay", "exit",
  ];
  for (const distro of ["ubuntu", "arch", "fedora"]) {
    itNeeds(outputCommands, `inga svenska tecken i utskrifterna (${distro})`, () => {
      const t = newShell(distro);
      const sh = t.sh;
      // Install every program so that their tip lines run too.
      for (const pkg of PackagesLib.packages) {
        if (pkg.names.get(sh.distro.family)) PackagesLib.installPackage(sh, pkg);
      }
      const lines = [
        "help",
        "man man",
        "man tar",
        "ls --help",
        "sudo whoami",
        "su -",
        "bash",
        "nano anteckning.txt",
        "vim",
        "htop",
        "git status",
        "curl https://example.com",
        "wget https://example.com",
        "ssh elev@server",
        "python3",
        "top",
        `kill ${ProcsLib.ShellPid}`,
        "sleep 300 &",
        "fg",
        "tail -f /etc/hostname",
        "awk 'function f() { return 1 } { print }' /etc/hostname",
        "awk '/a/,/b/' /etc/hostname",
        "sed 'h' /etc/hostname",
        'echo | read x; printf "read x\\n" > /tmp/r.sh; bash /tmp/r.sh < /dev/null',
        "f() { f; }; f",
        "while true; do true; done",
        "cowsay hej",
        "exit",
        "man nosuchcommand",
      ];
      for (const line of lines) {
        const output = t.run(line).out;
        if (sh.pendingQuestion !== null) t.run("n");
        notMatch(swedish, output, line);
      }
    });
  }

  itNeeds(["sudo", "apt"], "pakethanteraren i Debian/Ubuntu", () => {
    const t = newShell("ubuntu");
    const output = t.run("sudo apt install tree").out + t.run("sudo apt upgrade").out + t.run("sudo apt remove bash").out;
    expect(output).toContain("Tip from the simulator");
    notMatch(swedish, output, "apt");
  });

  it("kommandot finns i ett paket", () => {
    const t = newShell("fedora");
    const output = t.run("cowsay hej").out;
    expect(output).toContain("command not found");
    expect(output).toContain("Tip from the simulator");
    notMatch(swedish, output, "cowsay hej");
  });

  itNeeds(["bash", "exit"], "samma rader på svenska", () => {
    const t = newShell("fedora", "sv");
    expect(t.run("cowsay hej").out).toContain("Tips från simulatorn");
    expect(t.run("bash").out).toContain("Du kör redan bash!");
    expect(t.run("exit").out).toContain("simulerad terminal");
  });
});
