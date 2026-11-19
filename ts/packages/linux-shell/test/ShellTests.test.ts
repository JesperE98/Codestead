// Port of tests/Linux/Codestead.Shell.Tests/ShellTests.cs (src/shell/shell.test.ts). The parser tests
// ("parser: ...") live in CoreTests.test.ts. Most tests run commands from Commands/, which are ported in wave 2:
// until then they are todos that name the commands they wait for (see itNeeds).

import { describe, expect, it } from "vitest";
import { Shell } from "../src/Shell/Shell.js";
import { snapshotFromJson, snapshotToJson } from "../src/Shell/ShellSnapshot.js";
import { itNeeds, TestShell } from "./TestShell.js";

describe("ShellTests", () => {
  // ---------- expansion ----------

  itNeeds(["echo"], "expansion: variabler och citattecken", () => {
    const t = new TestShell();
    expect(t.run('echo "$HOME"').out).toBe("/home/elev\n");
    expect(t.run("echo '$HOME'").out).toBe("$HOME\n");
    expect(t.run("echo \\$HOME").out).toBe("$HOME\n");
    expect(t.run("echo ~/x").out).toBe("/home/elev/x\n");
  });

  itNeeds(["echo"], "expansion: jokertecken", () => {
    const t = new TestShell();
    expect(t.run("echo dokument/*").out).toBe("dokument/betyg.csv dokument/frukter.txt dokument/server.log\n");
    expect(t.run('echo "dokument/*"').out).toBe("dokument/*\n");
    expect(t.run("echo *.saknas").out).toBe("*.saknas\n");
  });

  itNeeds(["ls", "echo", "false"], "expansion: $? och kedjor", () => {
    const t = new TestShell();
    expect(t.run("ls /finnsinte; echo $?").out).toContain("\n2\n");
    expect(t.run("false && echo nej || echo ja").out).toBe("ja\n");
  });

  // ---------- filer och rättigheter ----------

  itNeeds(["mkdir", "touch", "cp", "mv", "rm"], "filer och rättigheter: skapa, kopiera, flytta och ta bort", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("mkdir -p a/b && touch a/b/c.txt && cp -r a kopia && mv kopia/b/c.txt kopia/d.txt");
    expect(sh.vfs.tryLookup("/home/elev/kopia/d.txt", sh.rootUser())).not.toBeNull();
    expect(t.run("rm a").out).toContain("Is a directory");
    t.run("rm -r a");
    expect(sh.vfs.tryLookup("/home/elev/a", sh.rootUser())).toBeNull();
  });

  itNeeds(["touch", "echo", "sudo"], "filer och rättigheter: vanliga användare får inte skriva i /etc", () => {
    const t = new TestShell();
    expect(t.run("touch /etc/x").out).toBe("touch: cannot touch '/etc/x': Permission denied\n");
    expect(t.run("echo hej > /etc/x").out).toBe("bash: /etc/x: Permission denied\n");
    expect(t.run("sudo touch /etc/x").exitCode).toBe(0);
  });

  itNeeds(["sudo", "rm"], "filer och rättigheter: rm -rf / stoppas", () => {
    const t = new TestShell();
    expect(t.run("sudo rm -rf /").out).toContain("dangerous");
  });

  itNeeds(["echo", "bash", "chmod", "ls"], "filer och rättigheter: chmod och körbara skript", () => {
    const t = new TestShell();
    t.run("echo 'echo från skriptet' > s.sh");
    expect(t.run("./s.sh").out).toBe("bash: ./s.sh: Permission denied\n");
    expect(t.run("bash s.sh").out).toBe("från skriptet\n");
    t.run("chmod u+x s.sh");
    expect(t.run("ls -l s.sh").out).toMatch(/^-rwxr--r--/);
    expect(t.run("./s.sh").out).toBe("från skriptet\n");
    t.run("chmod 640 s.sh");
    expect(t.run("ls -l s.sh").out).toMatch(/^-rw-r-----/);
  });

  itNeeds(["cd", "sudo", "exit"], "filer och rättigheter: cd in i /root nekas", () => {
    const t = new TestShell();
    expect(t.run("cd /root").out).toBe("bash: cd: /root: Permission denied\n");
    t.run("sudo -i");
    expect(t.sh.prompt()).toBe("root@ubuntu:~# ");
    t.run("exit");
    expect(t.sh.currentUser().name).toBe("elev");
  });

  // ---------- textverktyg ----------

  itNeeds(["grep", "wc", "sort", "uniq", "head", "cut", "tail"], "textverktyg: grep, sort, uniq, wc och head", () => {
    const t = new TestShell();
    expect(t.run("grep -c ERROR dokument/server.log").out).toBe("3\n");
    expect(t.run("grep -ic warn dokument/server.log").out).toBe("3\n");
    expect(t.run('grep -E "ERROR|WARN" dokument/server.log | wc -l').out).toBe("5\n");
    expect(t.run('grep "ERROR|WARN" dokument/server.log').exitCode).toBe(1);
    expect(t.run("sort dokument/frukter.txt | uniq -c | sort -rn | head -1").out).toBe("      3 äpple\n");
    expect(t.run("wc -l < dokument/frukter.txt").out).toBe("10\n");
    expect(t.run("cut -d: -f1 /etc/passwd | tail -1").out).toBe("elev\n");
  });

  itNeeds(["echo", "tee", "cat", "ls", "wc"], "textverktyg: tee och 2>/dev/null", () => {
    const t = new TestShell();
    expect(t.run("echo hej | tee x.txt").out).toBe("hej\n");
    expect(t.run("cat x.txt").out).toBe("hej\n");
    expect(t.run("ls /finnsinte 2>/dev/null").out).toBe("");
    expect(t.run("ls /finnsinte 2>&1 | wc -l").out).toBe("1\n");
  });

  itNeeds(["alias", "ls", "export", "echo"], "textverktyg: alias och export", () => {
    const t = new TestShell();
    t.run("alias ll='ls -la'");
    expect(t.run("ll").out).toContain(".bashrc");
    t.run("export FAVORIT=linux");
    expect(t.run("echo $FAVORIT").out).toBe("linux\n");
    expect(t.sh.env.get("FAVORIT")).toBe("linux");
  });

  // ---------- pakethantering ----------

  itNeeds(["apt", "sudo", "tree"], "pakethantering: apt kräver sudo och apt update", () => {
    const t = new TestShell("debian");
    const sh = t.sh;
    expect(t.run("apt install tree").exitCode).toBe(100);
    expect(t.run("sudo apt install tree").out).toContain("Unable to locate package tree");
    t.run("sudo apt update");
    t.run("sudo apt install tree");
    expect(sh.installed.has("tree")).toBe(true);
    expect(t.run("tree -L 1").exitCode).toBe(0);
    t.run("sudo apt remove tree");
    expect(sh.prompt()).toBe("Do you want to continue? [Y/n] ");
    t.run("");
    expect(sh.installed.has("tree")).toBe(false);
    expect(t.run("tree").exitCode).toBe(127);
  });

  itNeeds(["pacman", "sudo"], "pakethantering: pacman och partiella svar", () => {
    const t = new TestShell("arch");
    const sh = t.sh;
    expect(t.run("pacman -S htop").out).toContain("unless you are root");
    t.run("sudo pacman -S htop");
    t.run("n");
    expect(sh.installed.has("htop")).toBe(false);
    t.run("sudo pacman -S --noconfirm htop");
    expect(sh.installed.has("htop")).toBe(true);
    expect(t.run("pacman -Q htop").out).toMatch(/^htop \S+\n$/);
    expect(t.run("sudo pacman -R pacman").exitCode).toBe(1);
  });

  itNeeds(["dnf", "sudo"], "pakethantering: dnf har Nej som standardsvar och olika paketnamn", () => {
    const t = new TestShell("fedora");
    const sh = t.sh;
    t.run("sudo dnf install vim");
    expect(sh.installed.has("vim")).toBe(false);
    t.run("sudo dnf install vim-enhanced");
    t.run("");
    expect(sh.installed.has("vim")).toBe(false);
    t.run("sudo dnf install -y vim-enhanced");
    expect(sh.installed.has("vim")).toBe(true);
    expect(t.run("dnf check-update").exitCode).toBe(100);
  });

  it("pakethantering: pakethanteraren finns bara i rätt familj", () => {
    expect(new TestShell("ubuntu").run("pacman -Q").exitCode).toBe(127);
    expect(new TestShell("arch").run("apt list").exitCode).toBe(127);
    expect(new TestShell("fedora").run("apt list").exitCode).toBe(127);
  });

  it("pakethantering: ubuntu föreslår paket för kommandon som saknas", () => {
    expect(new TestShell("ubuntu").run("htop").out).toContain("sudo apt install htop");
  });

  // ---------- tab-komplettering ----------

  it("tab-komplettering: kommandon och sökvägar", () => {
    const sh = new TestShell().sh;
    expect(sh.complete("whoa").line).toBe("whoami ");
    expect(sh.complete("cd dok").line).toBe("cd dokument/");
    expect(sh.complete("cat dokument/s").line).toBe("cat dokument/server.log ");
    expect(sh.complete("ls dokument/").options).toEqual(["betyg.csv", "frukter.txt", "server.log"]);
  });

  // ---------- uppdatering av sparat tillstånd ----------

  itNeeds(
    ["sudo", "apt", "rm", "echo", "sed"],
    "uppdatering av sparat tillstånd: nya förinstallerade program och övningsfiler läggs till, borttagna läggs inte tillbaka",
    () => {
      const t = new TestShell("debian");
      t.run("sudo apt remove -y nano");
      t.run("rm ~/dokument/frukter.txt");
      const old = snapshotFromJson(snapshotToJson(t.sh.snapshot()))!;
      // Simulate a state from an older version: without sed and betyg.csv.
      old.installed.delete("sed");
      old.fs.children!.get("usr")!.children!.get("bin")!.children!.delete("sed");
      old.fs.children!.get("home")!.children!.get("elev")!.children!.get("dokument")!.children!.delete("betyg.csv");
      for (const k of [...old.flags.keys()]) {
        if (k.startsWith("default:") && (k.includes("sed") || k.includes("betyg"))) old.flags.delete(k);
      }
      const restored = Shell.restore(old)!;
      expect(restored.installed.has("sed")).toBe(true);
      expect(restored.execute("echo hej | sed 's/hej/hallå/'").output).toBe("hallå\n");
      expect(restored.vfs.tryLookup("/home/elev/dokument/betyg.csv", restored.rootUser())).not.toBeNull();
      expect(restored.installed.has("nano")).toBe(false);
      expect(restored.vfs.tryLookup("/home/elev/dokument/frukter.txt", restored.rootUser())).toBeNull();
    },
  );

  // ---------- spara och återställa ----------

  itNeeds(["mkdir", "cd"], "spara och återställa: snapshot överlever JSON", () => {
    const t = new TestShell("arch");
    t.run("mkdir sparad && cd sparad");
    const restored = Shell.restore(snapshotFromJson(snapshotToJson(t.sh.snapshot())))!;
    expect(restored.cwd).toBe("/home/elev/sparad");
    expect(restored.distro.id).toBe("arch");
  });
});
