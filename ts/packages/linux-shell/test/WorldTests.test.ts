// Port of tests/Linux/Codestead.Shell.Tests/WorldTests.cs – the student's computer in the student's language
// (World.ts) and switching language (WorldMigration.ts).

import { describe, expect, it } from "vitest";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import * as InitfsLib from "../src/InitfsLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { World } from "../src/World.js";
import * as WorldMigration from "../src/WorldMigration.js";
import { expectEndsWith, expectStartsWith, itNeeds, whenCommands } from "./TestShell.js";

const ordinalSort = (xs: Iterable<string>): string[] => [...xs].sort();

describe("WorldTests", () => {
  it.each(ordinalSort(World.languages))("världen har samma nycklar som engelskan och namn som går att skriva (%s)", (lang) => {
    const en = World.get("en");
    const w = World.get(lang);
    expect(w.lang).toBe(lang);
    expect(ordinalSort(w.names.keys())).toEqual(ordinalSort(en.names.keys()));
    expect(ordinalSort(w.words.keys())).toEqual(ordinalSort(en.words.keys()));
    expect(ordinalSort(w.files.keys())).toEqual(ordinalSort(en.files.keys()));
    expect(w.locale).toMatch(/^[a-z]{2}_[A-Z]{2}\.UTF-8$/);
    // Names are typed on any keyboard: ASCII, no spaces or shell characters.
    for (const [key, name] of w.names) expect(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name), `${lang}: "${key}" = "${name}" is not a plain ASCII name`).toBe(true);
    // User, group and variable names follow the stricter rules of real Linux and bash.
    for (const key of ["user", "devGroup", "tempUser"])
      expect(/^[a-z_][a-z0-9_-]*$/.test(w.get(key)), `${lang}: "${key}" = "${w.get(key)}" is not a valid user or group name`).toBe(true);
    for (const key of ["sumVar", "favVar", "linesVar", "doubleFn", "fruitVar", "nameVar", "lineVar"])
      expect(/^[A-Za-z_][A-Za-z0-9_]*$/.test(w.get(key)), `${lang}: "${key}" = "${w.get(key)}" is not a valid variable name`).toBe(true);
    // The names of one folder must differ, or one file would hide another.
    for (const group of [
      ["notes", "documents", "old", "pictures", "webProject", "downloads", "project", "etcFiles", "helloScript", "helloFile", "unpacked", "fromZip", "exampleHtml", "report"],
      ["grades", "fruits"],
      ["oldNotes", "backup", "archive"],
    ])
      expect(new Set(group.map((k) => w.get(k))).size === group.length, `${lang}: two exercise files have the same name in ${group.join(", ")}`).toBe(true);
    // The checks rely on these: ten fruits, the first one three times; eight grades with the same points.
    const fruits = w.file("fruits").split("\n").filter((f) => f !== "");
    expect(fruits.length).toBe(10);
    expect(fruits.filter((f) => f === fruits[0]).length).toBe(3);
    expect(w.get("fruitWord")).toBe(fruits[0]);
    expect(
      w
        .file("grades")
        .split("\n")
        .filter((l) => l !== "")
        .slice(1)
        .map((l) => l.split(",")[2])
        .join(","),
    ).toBe("87,64,92,45,78,95,58,71");
    expect(w.file("notes")).toContain("Linux");
    expectStartsWith(w.file("report"), "%PDF");
    expect(w.file("webIndex")).toContain(w.get("siteTitle"));
    expect(w.file("webReadme")).toContain(w.get("siteTitle"));
  });

  it("en ny dator på engelska har engelska namn och användaren student", () => {
    const sh = Shell.create("ubuntu", "en");
    const root = sh.rootUser();
    expect(sh.currentUser().name).toBe("student");
    expect(sh.cwd).toBe("/home/student");
    expect(sh.env.get("LANG")).toBe("en_US.UTF-8");
    expectStartsWith(sh.vfs.tryLookup("/home/student/documents/fruits.txt", root)?.content, "apple\nbanana\n");
    expect(sh.vfs.tryLookup("/home/student/Downloads/Calculator.AppImage", root)).not.toBeNull();
    expect(sh.vfs.tryLookup("/etc/passwd", root)?.content).toContain("student:x:1000:1000:Student,,,:/home/student:/bin/bash");
    whenCommands(["whoami"], () => expect(sh.execute("whoami").output).toContain("student"));
    expect(sh.proc.procs.map((p) => p.user)).toContain("student");
    // sort follows $LANG.
    whenCommands(["sort", "head"], () => expect(sh.execute("sort documents/fruits.txt | head -n 1").output.trim()).toBe("apple"));
  });

  itNeeds(["echo", "mkdir", "cp", "cd", "whoami", "sudo"], "byta språk översätter övningsfilerna och användaren på plats", () => {
    const sh = Shell.create("ubuntu", "sv");
    const t = (line: string): string => UtilCmd.stripAnsi(sh.execute(line).output);
    t("echo mitt eget > dokument/egen.txt");
    t("echo ändrad >> anteckningar.txt");
    t("mkdir projekt && cp anteckningar.txt projekt/");
    t("cd dokument");
    WorldMigration.translate(sh, "en");

    const root = sh.rootUser();
    expect(sh.world.lang).toBe("en");
    expect(sh.currentUser().name).toBe("student");
    expect(sh.cwd).toBe("/home/student/documents");
    expect(sh.env.get("HOME")).toBe("/home/student");
    expect(sh.env.get("LANG")).toBe("en_US.UTF-8");
    expect(sh.vfs.tryLookup("/home/elev", root)).toBeNull();
    // Exercise files: new names, and new text where it was untouched.
    expectStartsWith(sh.vfs.tryLookup("/home/student/documents/fruits.txt", root)?.content, "apple\n");
    expectStartsWith(sh.vfs.tryLookup("/home/student/documents/grades.csv", root)?.content, "name,subject,points\n");
    expect(sh.vfs.tryLookup("/home/student/old/archive/log-2019.txt", root)).not.toBeNull();
    expect(sh.vfs.tryLookup("/home/student/Downloads/Calculator.AppImage", root)).not.toBeNull();
    expect(sh.vfs.tryLookup("/home/student/Downloads/Calculator.AppImage", root)?.content).toContain("AppImage: Calculator");
    // What the student wrote or changed stays as it is (the folder they made follows the new name).
    expect(sh.vfs.tryLookup("/home/student/documents/egen.txt", root)?.content).toBe("mitt eget\n");
    expectEndsWith(sh.vfs.tryLookup("/home/student/notes.txt", root)?.content, "ändrad\n");
    expectEndsWith(sh.vfs.tryLookup("/home/student/project/notes.txt", root)?.content, "ändrad\n");
    // The account everywhere.
    expect(sh.vfs.tryLookup("/etc/passwd", root)?.content).toContain("student:x:1000:1000:Student,,,:/home/student:/bin/bash");
    expect(sh.vfs.tryLookup("/etc/group", root)?.content).not.toContain("elev");
    expectStartsWith(
      sh.vfs
        .tryLookup("/etc/shadow", root)
        ?.content?.split("\n")
        .filter((l) => l !== "")
        .at(-1),
      "student:",
    );
    expect(sh.vfs.tryLookup("/home/student/notes.txt", root)?.owner).toBe("student");
    expect(sh.proc.procs.some((p) => p.user === "elev")).toBe(false);
    expect(sh.services.journal.some((e) => /\belev\b/.test(e.msg))).toBe(false);
    expect(t("whoami").trim()).toBe("student");
    expect(
      t("sudo whoami")
        .split("\n")
        .filter((l) => l !== "")
        .at(-1),
    ).toBe("root");
    // And back: Swedish again.
    WorldMigration.translate(sh, "sv");
    expect(sh.currentUser().name).toBe("elev");
    expectStartsWith(sh.vfs.tryLookup("/home/elev/dokument/frukter.txt", root)?.content, "äpple\n");
    expect(sh.vfs.tryLookup("/home/elev/dokument/egen.txt", root)?.content).toBe("mitt eget\n");
  });

  itNeeds(["sudo", "apt", "git", "cd"], "ett git-repo lämnas orört när språket byts", () => {
    const sh = Shell.create("ubuntu", "sv");
    sh.execute("sudo apt update");
    sh.execute("sudo apt install -y git");
    sh.execute("git config --global user.name Elev && git config --global user.email elev@example.com");
    sh.execute("cd projekt-webb && git init && git add . && git commit -qm första");
    WorldMigration.translate(sh, "en");
    expect(sh.cwd).toBe("/home/student/web-project");
    expect(sh.vfs.tryLookup("/home/student/web-project/README.md", sh.rootUser())?.content).toContain("Min webbplats");
    expect(UtilCmd.stripAnsi(sh.execute("git status -s").output)).toBe("");
  });

  it("en terminal sparad före världen blir svensk med nya programnamn", () => {
    // As saved by version 0.5.0: no "world", the old program names and Swedish system texts.
    const json = Shell.create("ubuntu", "sv")
      .snapshotJson()
      .replaceAll('"world":"sv",', "")
      .replaceAll("myserver", "minserver")
      .replaceAll("reportd", "rapportd")
      .replaceAll(
        JSON.stringify(InitfsLib.Bashrc).slice(1, -1),
        JSON.stringify("# ~/.bashrc: körs av bash för interaktiva skal.\n# Här brukar man lägga alias och egna inställningar.\n\n# Exempel:\n# alias ll='ls -la'\n# export EDITOR=nano\n").slice(1, -1),
      );
    expect(json).not.toContain('"world"');
    expect(json).toContain("minserver");
    const sh = Shell.restoreJson(json)!;
    expect(sh.world.lang).toBe("sv");
    expect(sh.currentUser().name).toBe("elev");
    expect(sh.snapshotJson()).not.toContain("minserver");
    expect(sh.snapshotJson()).not.toContain("rapportd");
    expect(sh.vfs.tryLookup("/usr/local/bin/myserver", sh.rootUser())).not.toBeNull();
    expect(sh.vfs.tryLookup("/home/elev/.bashrc", sh.rootUser())?.content).toBe(InitfsLib.Bashrc);
    whenCommands(["systemctl"], () => expect(sh.execute("systemctl status myserver").exitCode).toBe(0));
  });
});
