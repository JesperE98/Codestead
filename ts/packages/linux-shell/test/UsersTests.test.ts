// Port of tests/Linux/Codestead.Shell.Tests/UsersTests.cs (src/shell/users.test.ts).

import { describe, expect, it } from "vitest";
import { Js } from "../src/Js.js";
import { Shell } from "../src/Shell/Shell.js";
import { snapshotFromJson, snapshotToJson } from "../src/Shell/ShellSnapshot.js";
import type { ShadowEntry } from "../src/Users/ShadowEntry.js";
import * as UsersLib from "../src/Users/UsersLib.js";
import { itNeeds, TestShell } from "./TestShell.js";

function shadowOf(sh: Shell, name: string): ShadowEntry | null {
  return UsersLib.loadDb(sh).shadow.find((s) => s.name === name) ?? null;
}

describe("UsersTests", () => {
  // ---------- användare läses från /etc/passwd och /etc/group ----------

  itNeeds(["id", "groups"], "elev och root fungerar som förut", () => {
    const t = new TestShell();
    expect(t.run("id").out).toBe("uid=1000(elev) gid=1000(elev) groups=1000(elev),27(sudo)\n");
    expect(t.run("groups").out).toBe("elev sudo\n");
    expect(t.run("id root").out).toBe("uid=0(root) gid=0(root) groups=0(root)\n");
    const me = t.sh.currentUser();
    expect(me.name).toBe("elev");
    expect(me.uid).toBe(1000);
    expect(me.groups).toEqual(["elev", "sudo"]);
    expect(me.home).toBe("/home/elev");
    expect(t.run("id -un").out).toBe("elev\n");
    expect(t.run("id -G").out).toBe("1000 27\n");
  });

  itNeeds(["id", "groups"], "wheel i Arch och Fedora", () => {
    expect(new TestShell("arch").run("id").out).toBe("uid=1000(elev) gid=1000(elev) groups=1000(elev),998(wheel)\n");
    expect(new TestShell("fedora").run("groups elev").out).toBe("elev : elev wheel\n");
  });

  itNeeds(["id", "groups"], "okända användare", () => {
    const t = new TestShell();
    expect(t.run("id nisse").out).toBe("id: 'nisse': no such user\n");
    expect(t.run("groups nisse").exitCode).toBe(1);
  });

  itNeeds(["sudo", "id"], "gamla sparade terminaler (kort /etc/passwd, ingen /etc/skel) fungerar", () => {
    const sh = new TestShell().sh;
    const root = sh.rootUser();
    sh.vfs.writeFile("/etc/passwd", "root:x:0:0:root:/root:/bin/bash\nelev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n", root);
    sh.vfs.writeFile("/etc/group", "root:x:0:\nsudo:x:27:elev\nelev:x:1000:\n", root);
    sh.vfs.remove("/etc/skel", root);
    const snap = sh.snapshot();
    for (const k of [...snap.flags.keys()]) if (k.startsWith("default:file:/etc")) snap.flags.delete(k);
    const restored = Shell.restore(snapshotFromJson(snapshotToJson(snap)))!;
    expect(restored.currentUser().groups).toEqual(["elev", "sudo"]);
    expect(restored.vfs.tryLookup("/etc/skel/.bashrc", root)).not.toBeNull();
    restored.execute("sudo useradd -m kim");
    expect(restored.execute("id kim").output).toBe("uid=1001(kim) gid=1001(kim) groups=1001(kim)\n");
  });

  itNeeds(["echo", "sudo", "tee", "groups"], "ändringar i /etc/group syns direkt (cachen töms)", () => {
    const t = new TestShell();
    t.run("echo 'spel:x:1500:elev' | sudo tee -a /etc/group");
    expect(t.run("groups").out).toBe("elev sudo spel\n");
  });

  // ---------- useradd, usermod, userdel ----------

  itNeeds(["sudo", "grep", "ls", "id"], "useradd -m -s skapar användare, grupp, hemkatalog och shadow-rad", () => {
    const t = new TestShell();
    const sh = t.sh;
    expect(t.run("useradd kim").out).toContain("useradd: Permission denied.");
    expect(t.run('sudo useradd -m -s /bin/bash -c "Kim Svensson" kim').exitCode).toBe(0);
    expect(t.run("grep kim /etc/passwd").out).toBe("kim:x:1001:1001:Kim Svensson:/home/kim:/bin/bash\n");
    expect(UsersLib.findGroup(sh, "kim")?.gid).toBe(1001);
    expect(shadowOf(sh, "kim")?.hash).toBe("!");
    expect(t.run("ls -la /home/kim").out).toContain("Permission denied");
    expect(t.run("sudo ls -la /home/kim").out).toContain(".bashrc");
    const home = sh.vfs.tryLookup("/home/kim", sh.rootUser())!;
    expect([home.owner, home.group, home.mode]).toEqual(["kim", "kim", Js.oct(750)]);
    expect(t.run("id kim").out).toBe("uid=1001(kim) gid=1001(kim) groups=1001(kim)\n");
    expect(t.run("sudo useradd kim").out).toBe("useradd: user 'kim' already exists\n");
    t.run("sudo useradd -m alex");
    expect(UsersLib.findUser(sh, "alex")?.uid).toBe(1002);
  });

  itNeeds(["sudo"], "standardvärden skiljer sig mellan familjerna", () => {
    const deb = new TestShell("debian");
    deb.run("sudo useradd kim");
    expect(UsersLib.findUser(deb.sh, "kim")?.shell).toBe("/bin/sh");
    expect(deb.sh.vfs.tryLookup("/home/kim", deb.sh.rootUser())).toBeNull();

    const fed = new TestShell("fedora");
    fed.run("sudo useradd kim");
    expect(UsersLib.findUser(fed.sh, "kim")?.shell).toBe("/bin/bash");
    expect(fed.sh.vfs.tryLookup("/home/kim", fed.sh.rootUser())?.mode).toBe(Js.oct(700));
    expect(shadowOf(fed.sh, "kim")?.hash).toBe("!!");
  });

  itNeeds(["sudo"], "ogiltiga namn och grupper", () => {
    const t = new TestShell();
    expect(t.run("sudo useradd Kim").exitCode).toBe(3);
    expect(t.run("sudo useradd -G finnsinte kim").out).toBe("useradd: group 'finnsinte' does not exist\n");
  });

  itNeeds(["sudo", "groups"], "usermod -aG lägger till, -G utan -a ersätter", () => {
    const t = new TestShell();
    t.run("sudo useradd -m kim");
    t.run("sudo groupadd utvecklare");
    t.run("sudo usermod -aG utvecklare kim");
    t.run("sudo usermod -aG sudo kim");
    expect(t.run("groups kim").out).toBe("kim : kim sudo utvecklare\n");
    t.run("sudo usermod -G utvecklare kim");
    expect(t.run("groups kim").out).toBe("kim : kim utvecklare\n");
    expect(t.run("sudo usermod -a kim").exitCode).toBe(2);
    t.run("sudo usermod -s /bin/zsh kim");
    expect(UsersLib.findUser(t.sh, "kim")?.shell).toBe("/bin/zsh");
    expect(t.run("sudo usermod -s /bin/bash nisse").out).toBe("usermod: user 'nisse' does not exist\n");
  });

  itNeeds(["sudo", "groups", "id", "getent"], "gruppen backup finns i Debian-familjen (kapitlet om användare)", () => {
    const t = new TestShell();
    t.run("sudo useradd -m -s /bin/bash kim");
    expect(t.run("sudo usermod -aG backup kim").exitCode).toBe(0);
    expect(t.run("groups kim").out).toBe("kim : kim backup\n");
    expect(t.run("id kim").out).toBe("uid=1001(kim) gid=1001(kim) groups=1001(kim),34(backup)\n");
    expect(t.run("getent group backup").out).toBe("backup:x:34:kim\n");
    t.run("sudo usermod -G backup kim");
    expect(t.run("groups kim").out).toBe("kim : kim backup\n");
    expect(new TestShell("debian").run("getent group backup").out).toBe("backup:x:34:\n");
    // Arch och Fedora har ingen backup-grupp, men disk (som enhetsfilerna i /dev tillhör) finns överallt.
    for (const d of ["arch", "fedora"]) {
      const o = new TestShell(d);
      expect(o.run("getent group backup").exitCode).toBe(2);
      expect(o.run("getent group disk").exitCode).toBe(0);
    }
  });

  it("system-grupper som saknas läggs till i terminaler sparade innan de fanns", () => {
    const t = new TestShell();
    const json = t.sh.snapshotJson().replace("backup:x:34:\\n", "").replace(/,?"default:systemGroups:2":true/, "");
    expect(json).not.toContain("backup:x:34:");
    expect(json).not.toContain("default:systemGroups");
    const old = Shell.restoreJson(json)!;
    expect(old.vfs.readFile("/etc/group", old.rootUser())).toContain("backup:x:34:\n");
    // Bara en gång: en grupp som eleven tar bort sedan kommer inte tillbaka.
    old.execute("sudo groupdel backup");
    const again = Shell.restoreJson(old.snapshotJson())!;
    expect(again.vfs.readFile("/etc/group", again.rootUser())).not.toContain("backup:");
  });

  itNeeds(["sudo"], "usermod -L låser och -U låser upp", () => {
    const t = new TestShell();
    t.run("sudo useradd -m kim");
    t.run("sudo passwd kim");
    t.run("hemligt");
    t.run("hemligt");
    t.run("sudo usermod -L kim");
    expect(shadowOf(t.sh, "kim")?.hash.startsWith("!$y$")).toBe(true);
    expect(t.run("sudo passwd -S kim").out).toMatch(/^kim L /);
    t.run("sudo usermod -U kim");
    expect(t.run("sudo passwd -S kim").out).toMatch(/^kim P /);
  });

  itNeeds(["sudo"], "userdel -r tar bort allt; inloggade användare går inte att ta bort", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("sudo useradd -m -G sudo vikarie");
    expect(t.run("sudo userdel -r vikarie").exitCode).toBe(0);
    expect(UsersLib.findUser(sh, "vikarie")).toBeNull();
    expect(UsersLib.findGroup(sh, "vikarie")).toBeNull();
    expect(UsersLib.findGroup(sh, "sudo")?.members).toEqual(["elev"]);
    expect(shadowOf(sh, "vikarie")).toBeNull();
    expect(sh.vfs.tryLookup("/home/vikarie", sh.rootUser())).toBeNull();
    expect(t.run("sudo userdel elev").out).toBe("userdel: user elev is currently used by process 1290\n");
    expect(t.run("sudo userdel nisse").exitCode).toBe(6);
  });

  // ---------- grupper ----------

  itNeeds(["sudo"], "groupadd, gpasswd och groupdel", () => {
    const t = new TestShell();
    const sh = t.sh;
    expect(t.run("groupadd utvecklare").exitCode).toBe(10);
    t.run("sudo groupadd utvecklare");
    expect(t.run("getent group utvecklare").out).toBe("utvecklare:x:1001:\n");
    expect(t.run("sudo groupadd utvecklare").out).toBe("groupadd: group 'utvecklare' already exists\n");
    expect(t.run("sudo gpasswd -a elev utvecklare").out).toBe("Adding user elev to group utvecklare\n");
    expect(UsersLib.findGroup(sh, "utvecklare")?.members).toEqual(["elev"]);
    expect(t.run("sudo gpasswd -d elev utvecklare").out).toBe("Removing user elev from group utvecklare\n");
    expect(t.run("sudo gpasswd -d elev utvecklare").exitCode).toBe(3);
    expect(t.run("sudo groupdel elev").out).toBe("groupdel: cannot remove the primary group of user 'elev'\n");
    expect(t.run("sudo groupdel utvecklare").exitCode).toBe(0);
    expect(UsersLib.findGroup(sh, "utvecklare")).toBeNull();
  });

  itNeeds(["sudo", "touch", "ls", "chown"], "chown och chgrp använder de riktiga grupperna", () => {
    const t = new TestShell();
    t.run("sudo groupadd utvecklare");
    t.run("touch ~/fil.txt");
    expect(t.run("chgrp utvecklare ~/fil.txt").out).toContain("Operation not permitted");
    t.run("sudo usermod -aG utvecklare elev");
    expect(t.run("chgrp utvecklare ~/fil.txt").exitCode).toBe(0);
    expect(t.run("ls -l ~/fil.txt").out).toContain("elev utvecklare");
    expect(t.run("sudo chown nisse ~/fil.txt").out).toBe("chown: invalid user: 'nisse'\n");
    t.run("sudo useradd kim");
    expect(t.run("sudo chown kim: ~/fil.txt").exitCode).toBe(0);
    expect(t.run("ls -l ~/fil.txt").out).toContain("kim kim");
  });

  // ---------- passwd och su ----------

  itNeeds(["sudo"], "passwd frågar två gånger och sparar en hash i /etc/shadow", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("sudo useradd -m kim");
    let r = t.run("sudo passwd kim");
    expect(r.pending).toBe(true);
    expect(sh.prompt()).toBe("New password: ");
    expect(sh.pendingQuestion?.secret).toBe(true);
    r = t.run("hemligt123");
    expect(sh.prompt()).toBe("Retype new password: ");
    r = t.run("hemligt123");
    expect(r.out).toBe("passwd: password updated successfully\n");
    expect(r.line).toBe("sudo passwd kim");
    expect(shadowOf(sh, "kim")?.hash).toMatch(/^\$y\$j9T\$/);
    expect(sh.history).not.toContain("hemligt123");
  });

  itNeeds(["sudo", "echo"], "resten av raden körs efter båda frågorna", () => {
    const t = new TestShell();
    t.run("sudo useradd kim");
    t.run("sudo passwd kim; echo klart");
    t.run("abc");
    expect(t.run("abc").out).toBe("passwd: password updated successfully\nklart\n");
    t.run("sudo passwd kim; echo klart");
    t.run("abc");
    expect(t.run("xyz").out).toMatch(/password unchanged\nklart\n$/);
  });

  itNeeds(["sudo"], "olika lösenord godtas inte", () => {
    const t = new TestShell();
    t.run("sudo useradd kim");
    t.run("sudo passwd kim");
    t.run("ett");
    const r = t.run("två");
    expect(r.out).toContain("Sorry, passwords do not match.");
    expect(r.exitCode).toBe(10);
    expect(shadowOf(t.sh, "kim")?.hash).toBe("!");
  });

  it("bara root får byta andras lösenord", () => {
    expect(new TestShell().run("passwd root").out).toBe("passwd: You may not view or modify password information for root.\n");
    expect(new TestShell("fedora").run("passwd root").out).toBe("passwd: Only root can specify a user name.\n");
  });

  itNeeds(["sudo", "su", "whoami", "ls", "exit"], "su - kim kräver kims lösenord", () => {
    const t = new TestShell();
    const sh = t.sh;
    t.run("sudo useradd -m -s /bin/bash kim");
    t.run("sudo passwd kim");
    t.run("hemligt");
    t.run("hemligt");
    t.run("su - kim");
    expect(sh.pendingQuestion?.secret).toBe(true);
    expect(t.run("fel").out).toBe("su: Authentication failure\n");
    expect(t.run("whoami").out).toBe("elev\n");
    t.run("su - kim");
    t.run("hemligt");
    expect(t.run("whoami").out).toBe("kim\n");
    expect(sh.cwd).toBe("/home/kim");
    expect(sh.prompt()).toContain("kim@ubuntu");
    expect(t.run("sudo ls").out).toContain("kim is not in the sudoers file.");
    expect(t.run("exit").out).toBe("logout\n");
    expect(t.run("whoami").out).toBe("elev\n");
  });

  itNeeds(["sudo", "su", "whoami", "exit"], "su utan lösenord på kontot och su som root", () => {
    const t = new TestShell();
    t.run("sudo useradd -m kim");
    t.run("su kim");
    expect(t.run("vad som helst").out).toContain("su: Authentication failure");
    t.run("su -");
    expect(t.run("x").out).toContain("sudo -i");
    t.run("sudo -i");
    t.run("su - kim");
    expect(t.run("whoami").out).toBe("kim\n");
    t.run("exit");
    expect(t.run("su - daemon").out).toBe("This account is currently not available.\n");
  });

  itNeeds(["sudo", "su", "whoami"], "su -c kör ett kommando", () => {
    const t = new TestShell();
    t.run("sudo useradd -m kim");
    expect(t.run("sudo su -c whoami kim").out).toBe("kim\n");
    expect(t.run("whoami").out).toBe("elev\n");
  });

  itNeeds(["sudo"], "chage -l visar fälten i /etc/shadow", () => {
    const t = new TestShell();
    t.run("sudo useradd kim");
    expect(t.run("chage -l kim").out).toBe("chage: Permission denied.\n");
    t.run("sudo chage -M 90 kim");
    const out = t.run("sudo chage -l kim").out;
    expect(out).toContain("Maximum number of days between password change\t\t: 90".replaceAll("\t\t", "          "));
    expect(out).not.toContain("Password expires                                        : never");
    expect(t.run("chage -l elev").exitCode).toBe(0);
  });

  itNeeds(["echo", "sudo"], "chpasswd läser användare:lösenord", () => {
    const t = new TestShell();
    t.run("sudo useradd kim");
    t.run("echo 'kim:hemligt' | sudo chpasswd");
    expect(shadowOf(t.sh, "kim")?.hash).toMatch(/^\$y\$/);
  });

  // ---------- sudo -u och sudo -i ----------

  itNeeds(["sudo", "whoami", "touch"], "sudo -u kör som en annan användare", () => {
    const t = new TestShell();
    t.run("sudo useradd -m kim");
    expect(t.run("sudo -u kim whoami").out).toBe("kim\n");
    expect(t.run("sudo -u nisse whoami").out).toBe("sudo: unknown user nisse\n");
    expect(t.run("sudo -u kim touch /home/elev/x").out).toContain("Permission denied");
  });

  itNeeds(["sudo", "whoami", "exit"], "ny användare i sudo-gruppen får använda sudo", () => {
    const t = new TestShell("arch");
    t.run("sudo useradd -m -G wheel kim");
    t.run("sudo -iu kim");
    expect(t.run("whoami").out).toBe("kim\n");
    expect(t.run("sudo whoami").out).toContain("root");
    t.run("exit");
    expect(t.run("whoami").out).toBe("elev\n");
  });

  // ---------- adduser (Debian-familjen) ----------

  itNeeds(["sudo", "groups"], "frågar efter lösenord och namn", () => {
    const t = new TestShell("debian");
    const sh = t.sh;
    expect(t.run("adduser kim").out).toBe("fatal: Only root may add a user or group to the system.\n");
    let r = t.run("sudo adduser kim");
    expect(r.out).toContain("info: Adding user `kim' ...");
    expect(r.out).toContain("info: Creating home directory `/home/kim' ...");
    expect(sh.prompt()).toBe("New password: ");
    t.run("hemligt");
    r = t.run("hemligt");
    expect(r.out).toContain("passwd: password updated successfully");
    expect(sh.prompt()).toBe("\tFull Name []: ");
    t.run("Kim Svensson");
    expect(sh.prompt()).toBe("Is the information correct? [Y/n] ");
    r = t.run("");
    expect(r.out).toContain("Adding user `kim' to group `users'");
    const kim = UsersLib.findUser(sh, "kim");
    expect(kim).not.toBeNull();
    expect(kim!.uid).toBe(1001);
    expect(kim!.gecos).toBe("Kim Svensson,,,");
    expect(kim!.shell).toBe("/bin/bash");
    expect(kim!.home).toBe("/home/kim");
    expect(t.run("sudo adduser kim sudo").out).toBe("info: Adding user `kim' to group `sudo' ...\n");
    expect(t.run("groups kim").out).toBe("kim : kim sudo users\n");
    t.run("sudo deluser --remove-home kim");
    expect(UsersLib.findUser(sh, "kim")).toBeNull();
  });

  itNeeds(["sudo"], "finns inte i Arch", () => {
    expect(new TestShell("arch").run("sudo adduser kim").out).toContain("command not found");
  });

  // ---------- who, w, last, getent ----------

  itNeeds(["sudo"], "visar den inloggade användaren", () => {
    const t = new TestShell();
    expect(t.run("who").out).toMatch(/^elev\s+pts\/0\s+[0-9]{4}-[0-9]{2}-[0-9]{2} 08:12\n$/);
    expect(t.run("w").out).toContain("USER     TTY");
    expect(t.run("last").out).toContain("still logged in");
    expect(t.run("getent passwd elev").out).toBe("elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n");
    expect(t.run("getent group 27").out).toBe("sudo:x:27:elev\n");
    expect(t.run("getent passwd nisse").exitCode).toBe(2);
    expect(t.run("getent shadow").exitCode).toBe(2);
    expect(t.run("sudo getent shadow root").out).toMatch(/^root:\*:/m);
  });

  it("paketen heter olika i familjerna", () => {
    const arch = new TestShell("arch");
    expect(arch.sh.installed.has("shadow")).toBe(true);
    expect(arch.sh.installed.has("adduser")).toBe(false);
    expect(new TestShell("debian").sh.installed.has("adduser")).toBe(true);
  });
});
