// Port of tests/Linux/Codestead.Shell.Tests/LinksCronTransferTests.cs – links (ln, readlink, stat ...), xargs, nohup,
// watch, umask, ~/.ssh/config, scp, rsync and cron.

import { afterEach, describe, expect, it } from "vitest";
import * as CronCmd from "../src/Commands/Cron/CronCmd.js";
import { Js } from "../src/Js.js";
import { Shell } from "../src/Shell/Shell.js";
import { expectEndsWith, expectStartsWith, itNeeds, TestShell } from "./TestShell.js";

const en = (distro = "ubuntu"): TestShell => new TestShell(distro, "en", "en");

const Home = "/home/student";

function connected(): TestShell {
  const t = en();
  t.run("mkdir -p ~/.ssh && printf 'Host srv\\n    HostName 192.168.1.10\\n    User student\\n' > ~/.ssh/config");
  expect(t.run("ssh srv true").pending).toBe(true);
  t.run("yes");
  return t;
}

/** The commands connected() needs. */
const connectedNeeds = ["printf", "ssh", "true"];

describe("LinksCronTransferTests", () => {
  afterEach(() => {
    Js.clockOverride = null;
  });

  // ---------- symbolic links ----------

  it("ln -s: länken visas med ->, följs av cat och cd, och rm tar bara bort länken", () => {
    const t = en();
    expect(t.run("ln -s documents/fruits.txt fr").exitCode).toBe(0);
    const ls = t.run("ls -l fr").out;
    expectStartsWith(ls, "lrwxrwxrwx 1 student student 20 ");
    expectEndsWith(ls, " fr -> documents/fruits.txt\n");
    expectStartsWith(t.run("cat fr").out, "apple\nbanana");
    expect(t.run("readlink fr").out).toBe("documents/fruits.txt\n");
    expect(t.run("readlink -f fr").out).toBe(`${Home}/documents/fruits.txt\n`);
    expect(t.run("realpath fr").out).toBe(`${Home}/documents/fruits.txt\n`);
    // Writing through the link writes to the target.
    t.run("echo melon >> fr");
    expectEndsWith(t.run("cat documents/fruits.txt").out, "mango\nmelon\n");
    // A link to a directory: cd follows it, pwd remembers the way, pwd -P shows the real place.
    t.run("ln -s /var/log loggar");
    t.run("cd loggar");
    expect(t.run("pwd").out).toBe(`${Home}/loggar\n`);
    expect(t.run("pwd -P").out).toBe("/var/log\n");
    t.run("cd ~");
    expect(t.run("ls -F").out).toContain("loggar@");
    // rm removes the link, never the target; rmdir refuses a link.
    expect(t.run("rmdir loggar").out).toContain("Not a directory");
    expect(t.run("rm loggar").exitCode).toBe(0);
    expect(t.sh.vfs.tryLookup("/var/log", t.sh.rootUser())).not.toBeNull();
    t.run("rm fr");
    expect(t.sh.vfs.tryLookup(`${Home}/documents/fruits.txt`, t.sh.rootUser())).not.toBeNull();
  });

  it("en bruten länk: cat säger att filen saknas, ls visar den, find -type l hittar den", () => {
    const t = en();
    t.run("ln -s missing.txt broken");
    expect(t.run("cat broken").out).toContain("No such file or directory");
    expect(t.run("ls -l").out).toContain("broken -> missing.txt");
    expect(t.run("find . -type l").out).toBe("./broken\n");
    expect(t.run("file broken").out).toBe("broken: broken symbolic link to missing.txt\n");
    expect(t.run("ln -s notes.txt broken").out).toContain("File exists");
    expect(t.run("ln -sf notes.txt broken").exitCode).toBe(0);
    expect(t.run("readlink broken").out).toBe("notes.txt\n");
    // A broken link matches a glob too.
    t.run("ln -s nothing b2");
    expect(t.run("echo b*").out).toContain("b2");
  });

  it("ln utan -s: hårda länkar delar inod och innehåll, även efter att terminalen sparats", () => {
    const t = en();
    expect(t.run("ln notes.txt same.txt").exitCode).toBe(0);
    const a = t.run("stat -c '%i %h' notes.txt").out;
    expect(t.run("stat -c '%i %h' same.txt").out).toBe(a);
    expectEndsWith(a, " 2\n");
    expect(t.run("ls -l same.txt").out).toMatch(/^-rw-r--r-- 2 student/);
    const inodes = t
      .run("ls -i notes.txt same.txt")
      .out.split(/[ \n]/)
      .filter((s) => s !== "");
    expect(inodes[2]).toBe(inodes[0]);
    t.run("echo extra >> same.txt");
    expectEndsWith(t.run("cat notes.txt").out, "extra\n");
    // Saved and loaded: still the same file.
    const restored = Shell.restoreJson(t.sh.snapshotJson())!;
    restored.execute("echo again >> notes.txt");
    expectEndsWith(restored.execute("cat same.txt").output, "again\n");
    // Removing one name leaves the other.
    t.run("rm notes.txt");
    expectEndsWith(t.run("cat same.txt").out, "extra\n");
    expect(t.run("stat -c %h same.txt").out).toBe("1\n");
    expect(t.run("ln documents docs2").out).toContain("hard link not allowed for directory");
  });

  it("tar sparar symboliska länkar som länkar", () => {
    const t = en();
    t.runAll("mkdir box", "ln -s ../notes.txt box/n", "tar -cf box.tar box", "rm -r box", "tar -xf box.tar");
    expect(t.run("readlink box/n").out).toBe("../notes.txt\n");
    expectStartsWith(t.run("cat box/n").out, "Things to learn");
  });

  it("systemctl enable skapar en symbolisk länk till unit-filen", () => {
    const t = en();
    const r = t.run("ls -l /etc/systemd/system/multi-user.target.wants/");
    expect(r.out).toContain("ssh.service -> /usr/lib/systemd/system/ssh.service");
  });

  // ---------- stat, file, umask ----------

  itNeeds(["printf"], "stat och file berättar om filer", () => {
    const t = en();
    const stat = t.run("stat notes.txt").out;
    expect(stat).toContain("  File: notes.txt\n");
    expect(stat).toContain("regular file");
    expect(stat).toContain("Access: (0644/-rw-r--r--)  Uid: ( 1000/ student)   Gid: ( 1000/ student)");
    expect(t.run("stat -c '%a %U %n' notes.txt").out).toBe("644 student notes.txt\n");
    expect(t.run("stat -c %F documents").out).toBe("directory\n");
    expect(t.run("stat nope").out).toContain("cannot statx 'nope'");

    expect(t.run("file notes.txt").out).toBe("notes.txt: ASCII text\n");
    expect(t.run("file documents").out).toBe("documents: directory\n");
    expect(t.run("file /usr/bin/ls").out).toContain("ELF 64-bit LSB pie executable");
    expect(t.run("file -b documents/grades.csv").out).toBe("CSV ASCII text\n");
    t.run("printf '#!/bin/bash\\necho hi\\n' > s.sh && chmod +x s.sh");
    expect(t.run("file -b s.sh").out).toBe("Bourne-Again shell script, ASCII text executable\n");
    t.run("tar -czf a.tgz documents");
    expect(t.run("file -b a.tgz").out).toBe("gzip compressed data, from Unix\n");
    t.run("cp notes.txt picture.jpg");
    expect(t.run("file picture.jpg").out).toBe("picture.jpg: ASCII text\n");
  });

  it("umask bestämmer rättigheterna på nya filer och kataloger", () => {
    const t = en();
    expect(t.run("umask").out).toBe("0022\n");
    expect(t.run("umask -S").out).toBe("u=rwx,g=rx,o=rx\n");
    t.run("umask 077");
    t.runAll("touch private.txt", "mkdir privdir");
    expect(t.run("stat -c %a private.txt").out).toBe("600\n");
    expect(t.run("stat -c %a privdir").out).toBe("700\n");
    t.run("umask u=rwx,g=rx,o=");
    expect(t.run("umask").out).toBe("0027\n");
    expect(t.run("umask 999").out).toContain("octal number out of range");
    // Saved with the terminal.
    expect(Shell.restoreJson(t.sh.snapshotJson())!.execute("umask").output).toBe("0027\n");
  });

  // ---------- xargs, nohup, watch ----------

  itNeeds(["printf", "xargs"], "xargs gör indata till argument", () => {
    const t = en();
    expect(t.run("printf 'a\\nb\\nc\\n' | xargs").out).toBe("a b c\n");
    expect(t.run("printf 'a b\\n' | xargs -n 1 echo Hi").out).toBe("Hi a\nHi b\n");
    t.run("printf 'x1\\nx2\\n' | xargs touch");
    expect(t.node(`${Home}/x1`)).not.toBeNull();
    expect(t.node(`${Home}/x2`)).not.toBeNull();
    expect(t.run("printf 'one\\ntwo words\\n' | xargs -I {} echo [{}] | xargs").out).toBe("[one] [two words]\n");
    expect(t.run("find documents -name '*.txt' | xargs wc -l").out).toContain("10 documents/fruits.txt");
    expect(t.run("echo x | xargs nosuchcommand").exitCode).toBe(127);
    expect(t.run("echo nope | xargs ls").exitCode).toBe(123);
    expect(t.run("printf '' | xargs").out).toBe("\n");
    expect(t.run("printf '' | xargs -r echo hi").out).toBe("");
  });

  itNeeds(["nohup", "watch", "vi"], "nohup skriver till nohup.out, watch visar en gång", () => {
    const t = en();
    const r = t.run("nohup echo done");
    expect(r.out).toContain("nohup: ignoring input and appending output to 'nohup.out'");
    expect(t.content(`${Home}/nohup.out`)).toBe("done\n");
    expect(t.run("nohup echo done | cat").out).toBe("done\n");
    const w = t.run("watch -n 5 echo hi").out;
    expectStartsWith(w, "Every 5.0s: echo hi");
    expect(w).toContain("\nhi\n");
    expect(w).toContain("every 5 s");
    expect(t.run("vi notes.txt").out).toContain("vi is an interactive text editor");
  });

  // ---------- ~/.ssh/config, scp, rsync ----------

  itNeeds([...connectedNeeds, "hostname", "whoami"], "~/.ssh/config ger servern ett kort namn", () => {
    const t = connected();
    // No key yet: the password line comes first.
    expectEndsWith(t.run("ssh srv hostname").out, "password: (the simulator skips the password)\nserver\n");
    expectEndsWith(t.run("ssh srv whoami").out, "\nstudent\n");
    t.run("chmod 666 ~/.ssh/config");
    expect(t.run("ssh srv true").out).toContain(`Bad owner or permissions on ${Home}/.ssh/config`);
    t.run("chmod 600 ~/.ssh/config && echo 'Hostnam x' >> ~/.ssh/config");
    const bad = t.run("ssh srv true");
    expect(bad.exitCode).toBe(255);
    expect(bad.out).toContain("line 4: Bad configuration option: hostnam");
  });

  itNeeds([...connectedNeeds, "scp"], "scp kopierar till och från servern", () => {
    const t = connected();
    const up = t.run("scp notes.txt srv:");
    expect(up.exitCode).toBe(0);
    expect(t.run("ssh srv cat notes.txt").out).toContain("\nThings to learn");
    expect(t.run("scp srv:welcome.txt fromserver.txt").exitCode).toBe(0);
    expect(t.node(`${Home}/fromserver.txt`)).not.toBeNull();
    expect(t.run("scp documents srv:").out).toContain("is not a regular file");
    expect(t.run("scp -r documents srv:backup").exitCode).toBe(0);
    expect(t.run("ssh srv ls backup").out).toContain("fruits.txt");
    expect(t.run("scp srv:nope.txt .").out).toContain("No such file or directory");
    expect(t.run("scp student@192.168.1.10:notes.txt n2.txt").exitCode).toBe(0);
  });

  itNeeds(["rsync"], "rsync kopierar bara det som ändrats, och snedstrecket sist spelar roll", () => {
    const t = en();
    const first = t.run("rsync -av documents/ backup/").out;
    expectStartsWith(first, "sending incremental file list\ncreated directory backup\n./\n");
    expect(first).toContain("fruits.txt\n");
    expect(t.node(`${Home}/backup/fruits.txt`)).not.toBeNull();
    // Nothing changed: nothing is sent.
    const again = t.run("rsync -av documents/ backup/").out;
    expect(again).not.toContain("fruits.txt");
    t.run("echo lime >> documents/fruits.txt");
    expect(t.run("rsync -av documents/ backup/").out).toContain("\nfruits.txt\n");
    // Without the slash the directory itself is copied.
    t.run("rsync -a documents backup2");
    expect(t.node(`${Home}/backup2/documents/fruits.txt`)).not.toBeNull();
    // --delete, tried with -n first.
    t.run("touch backup/extra.txt");
    const dry = t.run("rsync -avn --delete documents/ backup/").out;
    expect(dry).toContain("deleting extra.txt");
    expect(dry).toContain("(DRY RUN)");
    expect(t.node(`${Home}/backup/extra.txt`)).not.toBeNull();
    t.run("rsync -a --delete documents/ backup/");
    expect(t.node(`${Home}/backup/extra.txt`)).toBeNull();
    expect(t.run("rsync documents backup3").out).toContain("skipping directory documents");
  });

  itNeeds([...connectedNeeds, "rsync"], "rsync till servern över ssh", () => {
    const t = connected();
    expect(t.run("rsync -a documents/ srv:documents/").exitCode).toBe(0);
    expect(t.run("ssh srv ls documents").out).toContain("grades.csv");
    expect(t.run("rsync srv:a srv:b").out).toContain("The source and destination cannot both be remote");
  });

  // ---------- cron ----------

  itNeeds(["crontab", "printf"], "crontab installerar, visar och tar bort jobb – och säger till om fel", () => {
    const t = en();
    expect(t.run("crontab -l").out).toBe("no crontab for student\n");
    expect(t.run("echo '*/5 * * * * date >> ~/cron.log' | crontab -").exitCode).toBe(0);
    expect(t.run("crontab -l").out).toBe("*/5 * * * * date >> ~/cron.log\n");
    expect(t.sh.vfs.tryLookup("/var/spool/cron/crontabs/student", t.sh.rootUser())?.content).toBe("*/5 * * * * date >> ~/cron.log\n");
    const bad = t.run("echo '61 * * * * date' | crontab -");
    expect(bad.exitCode).toBe(1);
    expect(bad.out).toBe("\"-\":1: bad minute\nerrors in crontab file, can't install.\n");
    expect(t.run("echo '0 24 * * * date' | crontab -").out).toContain("bad hour");
    expect(t.run("echo '0 1 * * funday date' | crontab -").out).toContain("bad day-of-week");
    expect(t.run("echo '0 1 * * *' | crontab -").out).toContain("bad command");
    t.run("printf '@daily ~/backup.sh\\n# a comment\\nMAILTO=\"\"\\n30 2 * * 1-5 echo hi\\n' > jobs.txt");
    expect(t.run("crontab jobs.txt").exitCode).toBe(0);
    expect(t.run("crontab -l").out).toContain("30 2 * * 1-5 echo hi");
    expect(t.run("(crontab -l; echo '@reboot echo up') | crontab -").exitCode).toBe(0);
    expect(t.run("crontab -l").out).toContain("@reboot echo up");
    expect(t.run("crontab -e").out).toContain("crontab -e opens your crontab");
    expect(t.run("crontab -u root -l").out).toContain("must be privileged");
    expect(t.run("crontab -r").exitCode).toBe(0);
    expect(t.run("crontab -l").exitCode).toBe(1);
  });

  it("tidsfälten: */15, intervall, listor, namn och @-genvägar", () => {
    const job = (line: string): CronCmd.Job => {
      const jobs = CronCmd.parse(line + "\n", "student").jobs;
      expect(jobs.length).toBe(1);
      return jobs[0]!;
    };
    // new DateTime(...) in C# is local time (the month is 1-based there, 0-based here).
    const monday = new Date(2026, 10, 2, 2, 30, 0);
    expect(CronCmd.due(job("30 2 * * 1-5 x"), monday)).toBe(true);
    expect(CronCmd.due(job("30 2 * * 0,6 x"), monday)).toBe(false);
    expect(CronCmd.due(job("*/15 * * * * x"), monday)).toBe(true);
    expect(CronCmd.due(job("*/7 * * * * x"), monday)).toBe(false);
    expect(CronCmd.due(job("30 2 * nov mon x"), monday)).toBe(true);
    expect(CronCmd.due(job("0 0 * * 7 x"), new Date(2026, 10, 1, 0, 0, 0))).toBe(true);
    expect(CronCmd.due(job("@daily x"), new Date(2026, 10, 2, 0, 0, 0))).toBe(true);
    expect(CronCmd.due(job("@daily x"), monday)).toBe(false);
    expect(CronCmd.due(job("@hourly x"), new Date(2026, 10, 2, 5, 0, 0))).toBe(true);
    // Day of month and day of week both set: either is enough.
    expect(CronCmd.due(job("0 0 15 * 1 x"), new Date(2026, 10, 2, 0, 0, 0))).toBe(true);
    expect(job("1 2 3 4 5   echo a  b > f").command).toBe("echo a  b > f");
    const withUser = CronCmd.parse("1 * * * * root ls\n", "x", true).jobs;
    expect(withUser.length).toBe(1);
    expect(withUser[0]!.command).toBe("ls");
  });

  itNeeds(["crontab", "true", "journalctl", "sudo", "systemctl"], "cron kör jobben när minuten är inne, bara medan tjänsten är igång", () => {
    let now = Date.UTC(2026, 10, 3, 10, 0, 30);
    Js.clockOverride = () => now;
    const t = en();
    t.run("echo '* * * * * echo tick >> ~/cron.log' | crontab -");
    t.run("(crontab -l; echo '* * * * * pwd > where.txt') | crontab -");
    expect(t.node(`${Home}/cron.log`)).toBeNull();
    now += 60_000;
    t.run("true");
    expect(t.content(`${Home}/cron.log`)).toBe("tick\n");
    expect(t.content(`${Home}/where.txt`)).toBe(`${Home}\n`);
    now += 3 * 60_000;
    t.run("cd /tmp");
    expect(t.content(`${Home}/cron.log`)).toBe("tick\ntick\ntick\ntick\n");
    // The job did not move the student's shell.
    expect(t.run("pwd").out).toBe("/tmp\n");
    expect(t.run("journalctl -u cron").out).toContain("(student) CMD (echo tick >> ~/cron.log)");
    // Stopped cron runs nothing.
    t.run("sudo systemctl stop cron");
    now += 5 * 60_000;
    t.run("true");
    expect(t.content(`${Home}/cron.log`)!.split("\n").filter((l) => l !== "").length).toBe(4);
    // Output that is not redirected is lost (and logged).
    t.run("sudo systemctl start cron");
    t.run("echo '* * * * * echo lost' | crontab -");
    now += 60_000;
    t.run("true");
    expect(t.run("journalctl -u cron").out).toContain("No MTA installed, discarding output");
  });

  itNeeds(["crontab", "sudo", "pacman", "systemctl"], "cron på Arch: installera cronie och starta tjänsten", () => {
    const t = en("arch");
    expect(t.run("crontab -l").exitCode).toBe(127);
    t.run("sudo pacman -S --noconfirm cronie");
    expect(t.run("crontab -l").out).toBe("no crontab for student\n");
    expect(t.run("systemctl is-enabled cronie").out).toContain("disabled");
    expect(t.run("sudo systemctl enable --now cronie").exitCode).toBe(0);
    expect(t.run("systemctl is-active cronie").out).toBe("active\n");
    expect(t.run("echo '0 3 * * * echo x' | crontab -").exitCode).toBe(0);
    expect(t.sh.vfs.tryLookup("/var/spool/cron/student", t.sh.rootUser())).not.toBeNull();
  });

  itNeeds(["systemctl"], "systemctl list-timers visar systemd:s schemalagda jobb", () => {
    const r = en().run("systemctl list-timers").out;
    expectStartsWith(r, "NEXT");
    expect(r).toContain("logrotate.timer");
    expect(r).toContain("timers listed.");
    expect(en().run("cat /etc/crontab").out).toContain("/etc/cron.daily");
    expect(en().run("ls /etc/cron.daily").out).toContain("logrotate");
  });
});
