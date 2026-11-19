// Port of tests/Linux/Codestead.Shell.Tests/NetworkTests.cs (src/shell/network.test.ts). The tests that also need
// commands of other groups (echo, tee, cat, cd, ls ...) are todos until those are ported (see itNeeds).

import { describe, expect, it } from "vitest";
import * as UtilCmd from "../src/Commands/Util/UtilCmd.js";
import { Js } from "../src/Js.js";
import * as PackagesLib from "../src/Packages/PackagesLib.js";
import { Shell } from "../src/Shell/Shell.js";
import { snapshotFromJson } from "../src/Shell/ShellSnapshot.js";
import { itNeeds, TestShell } from "./TestShell.js";

function shell(distro = "arch"): TestShell {
  return new TestShell(distro);
}

/** Regex.Matches(s, pattern, Multiline).Count */
function count(s: string, re: RegExp): number {
  return [...s.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))].length;
}

describe("NetworkTests", () => {
  // ---------- ip och hostname ----------

  itNeeds(["ip", "hostname"], "ip a, ip -br a och hostname -I visar adresserna", () => {
    const t = shell();
    const a = t.run("ip a");
    expect(a.exitCode).toBe(0);
    expect(a.out).toContain("inet 127.0.0.1/8 scope host lo");
    expect(a.out).toContain("inet 192.168.1.42/24 brd 192.168.1.255");
    expect(a.out).toContain("state UP");
    expect(t.run("ip addr show dev lo").out).not.toContain("enp0s3");
    expect(t.run("ip -br a").out).toMatch(/^enp0s3\s+UP\s+192\.168\.1\.42\/24/m);
    expect(t.run("hostname -I").out).toBe("192.168.1.42 \n");
    expect(t.run("ip x").exitCode).not.toBe(0);
  });

  itNeeds(["ip"], "ip route visar gatewayen", () => {
    const t = shell();
    expect(t.run("ip r").out).toContain("default via 192.168.1.1 dev enp0s3");
    expect(t.run("ip route get 1.1.1.1").out).toContain("via 192.168.1.1");
    expect(t.run("ip neigh").out).toContain("192.168.1.1 dev enp0s3");
  });

  itNeeds(["ip", "sudo", "ping"], "ip link set kräver root, och ett avstängt kort stänger nätet", () => {
    const t = shell();
    const denied = t.run("ip link set enp0s3 down");
    expect(denied.out).toContain("Operation not permitted");
    expect(t.run("sudo ip link set enp0s3 down").exitCode).toBe(0);
    expect(t.run("ip link").out).toContain("state DOWN");
    expect(t.run("ip route").out).toBe("");
    expect(t.run("ping -c 1 192.168.1.1").out).toContain("Network is unreachable");
    expect(t.run("ping -c 1 example.com").out).toContain("Temporary failure in name resolution");
    // localhost still works
    expect(t.run("ping -c 1 localhost").exitCode).toBe(0);
    t.run("sudo ip link set dev enp0s3 up");
    expect(t.run("ping -c 1 example.com").exitCode).toBe(0);
  });

  // ---------- ping ----------

  itNeeds(["ping"], "-c räknar paketen och visar statistik", () => {
    const t = shell();
    const r = t.run("ping -c 3 192.168.1.1");
    expect(r.exitCode).toBe(0);
    expect(count(r.out, /^64 bytes from 192\.168\.1\.1: icmp_seq=[0-9] ttl=64 time=[0-9.]+ ms$/m)).toBe(3);
    expect(r.out).toContain("3 packets transmitted, 3 received, 0% packet loss");
    expect(r.out).toMatch(/rtt min\/avg\/max\/mdev = [0-9.]+\/[0-9.]+\/[0-9.]+\/[0-9.]+ ms/);
  });

  itNeeds(["ping"], 'utan -c "trycker" simulatorn Ctrl+C efter några svar', () => {
    const t = shell();
    const r = t.run("ping example.com");
    expect(r.out).toContain("PING example.com (203.0.113.10) 56(84) bytes of data.");
    expect(r.out).toContain("64 bytes from example.com (203.0.113.10)");
    expect(r.out).toContain("^C");
    expect(r.out).toContain("Ctrl+C");
  });

  itNeeds(["ping"], "okända namn och adresser som inte svarar", () => {
    const t = shell();
    const unknown = t.run("ping -c 1 finns-inte.example");
    expect(unknown.exitCode).toBe(2);
    expect(unknown.out).toContain("Name or service not known");
    const lan = t.run("ping -c 2 192.168.1.77");
    expect(lan.exitCode).toBe(1);
    expect(lan.out).toContain("Destination Host Unreachable");
    expect(t.run("ping -c 2 10.9.8.7").out).toContain("100% packet loss");
    expect(t.run("ping").out).toContain("Destination address required");
  });

  // ---------- namnuppslag ----------

  itNeeds(["ping", "echo", "sudo", "tee", "getent", "apt", "dig"], "/etc/hosts används av ping och getent men inte av dig", () => {
    const t = shell("debian");
    expect(t.run("ping -c 1 server.lan").exitCode).toBe(2);
    t.run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
    const ping = t.run("ping -c 2 server.lan");
    expect(ping.exitCode).toBe(0);
    expect(ping.out).toContain("64 bytes from server.lan (192.168.1.10)");
    expect(t.run("getent hosts server.lan").out).toBe("192.168.1.10    server.lan\n");
    t.run("sudo apt update");
    t.run("sudo apt install dnsutils");
    expect(t.run("dig +short server.lan").out).toBe("");
    expect(t.run("dig server.lan").out).toContain("status: NXDOMAIN");
  });

  itNeeds(["dig", "sudo", "dnf", "host", "nslookup"], "dig, host och nslookup måste installeras och frågar DNS", () => {
    const t = shell("fedora");
    expect(t.run("dig example.com").exitCode).toBe(127);
    t.run("sudo dnf install bind-utils");
    t.run("y");
    expect(t.run("dig +short example.com").out).toBe("203.0.113.10\n");
    const full = t.run("dig example.com");
    expect(full.out).toContain(";; ANSWER SECTION:");
    expect(full.out).toContain("SERVER: 127.0.0.53#53");
    expect(t.run("dig @1.1.1.1 example.com").out).toContain("SERVER: 1.1.1.1#53");
    expect(t.run("dig +short example.com AAAA").out).toBe("2001:db8::10\n");
    expect(t.run("host example.com").out).toContain("example.com has address 203.0.113.10");
    expect(t.run("host 1.1.1.1").out).toContain("domain name pointer one.one.one.one.");
    expect(t.run("host nope.invalid").out).toContain("not found: 3(NXDOMAIN)");
    expect(t.run("nslookup archlinux.org").out).toContain("Address: 203.0.113.30");
  });

  it("paketnamnen skiljer sig mellan familjerna", () => {
    expect(PackagesLib.findPackage("debian", "dnsutils")?.provides ?? []).toContain("dig");
    expect(PackagesLib.findPackage("arch", "bind")?.provides ?? []).toContain("dig");
    expect(PackagesLib.findPackage("redhat", "bind-utils")?.provides ?? []).toContain("dig");
    expect(PackagesLib.findPackage("redhat", "iproute")?.provides ?? []).toContain("ss");
    expect(PackagesLib.findPackage("debian", "iputils-ping")?.provides ?? []).toContain("ping");
  });

  itNeeds(["cat", "echo", "sudo", "tee", "ping"], "en trasig /etc/resolv.conf stoppar namn men inte adresser", () => {
    const t = shell("debian");
    expect(t.run("cat /etc/resolv.conf").out).toContain("nameserver 192.168.1.1");
    t.run("echo 'nameserver 10.0.0.99' | sudo tee /etc/resolv.conf");
    expect(t.run("ping -c 1 example.com").out).toContain("Temporary failure in name resolution");
    expect(t.run("ping -c 1 1.1.1.1").exitCode).toBe(0);
  });

  // ---------- ss och myserver ----------

  itNeeds(["ss", "sudo"], "ss -tulpn visar lyssnande portar, processerna bara med sudo", () => {
    const t = shell();
    const r = t.run("ss -tulpn");
    expect(r.out).toMatch(/tcp\s+LISTEN.*0\.0\.0\.0:22\b/);
    expect(r.out).toMatch(/0\.0\.0\.0:8080\b/);
    expect(r.out).not.toContain("users:");
    const root = t.run("sudo ss -tulpn");
    expect(root.out).toContain('users:(("sshd",pid=733');
    expect(root.out).toContain('users:(("myserver",pid=812');
    expect(t.run("ss -tl").out).toContain("0.0.0.0:ssh");
  });

  itNeeds(["myserver", "sudo", "pkill", "ss", "curl"], "myserver kan stoppas och startas igen", () => {
    const t = shell();
    expect(t.run("myserver").out).toContain("Address already in use");
    t.run("sudo pkill myserver");
    expect(t.run("ss -tln").out).not.toContain(":8080");
    expect(t.run("curl http://localhost:8080").exitCode).toBe(7);
    expect(t.run("myserver --port 80").out).toContain("Permission denied");
    expect(t.run("myserver").exitCode).toBe(0);
    expect(t.run("ss -tlpn").out).toContain('users:(("myserver"');
    expect(t.run("curl -s localhost:8080").out).toContain("Hello from myserver!");
  });

  // ---------- curl och wget ----------

  itNeeds(["curl", "grep"], "curl hämtar sidor och visar headers", () => {
    const t = shell();
    expect(t.run("curl http://localhost:8080").out).toContain("<h1>Hello from myserver!</h1>");
    const head = t.run("curl -I https://example.com");
    expect(head.out).toMatch(/^HTTP\/2 200\n/);
    expect(head.out).toContain("content-type: text/html");
    expect(head.out).not.toContain("<html>");
    expect(t.run("curl -s https://example.com | grep title").out).toContain("<title>Example Domain</title>");
    expect(t.run("curl -i http://localhost:8080/about.html").out).toMatch(/^HTTP\/1\.0 200 OK\n[\s\S]*Server: myserver\/1\.0[\s\S]*About myserver/);
  });

  itNeeds(["curl"], "omdirigeringar följs bara med -L", () => {
    const t = shell();
    const plain = t.run("curl http://linux.org");
    expect(plain.out).toContain("301 Moved Permanently");
    expect(plain.out).toContain("-L");
    expect(t.run("curl -I http://linux.org").out).toContain("Location: https://linux.org/");
    expect(t.run("curl -L http://linux.org").out).toContain("<h1>Linux.org</h1>");
  });

  itNeeds(["cd", "curl"], "curl -o, -O och felkoder", () => {
    const t = shell();
    t.run("cd ~");
    expect(t.run("curl -o sida.html https://example.com").exitCode).toBe(0);
    expect(t.content("~/sida.html")).toContain("Example Domain");
    expect(t.run("curl -O https://example.com/cheatsheet.txt").exitCode).toBe(0);
    expect(t.content("~/cheatsheet.txt")).toContain("ss -tulpn");
    expect(t.run("curl -o /etc/x.html https://example.com").exitCode).toBe(23);
    expect(t.run("curl -f http://localhost:8080/finns-inte").exitCode).toBe(22);
    expect(t.run("curl http://localhost:8080/finns-inte").out).toContain("404 Not Found");
    expect(t.run("curl https://finns-inte.example").out).toContain("curl: (6) Could not resolve host: finns-inte.example");
    expect(t.run("curl http://192.168.1.10:8080").exitCode).toBe(7);
    expect(t.run("curl ftp://example.com").exitCode).toBe(1);
  });

  itNeeds(["curl", "wget"], "curl saknas i Debian, wget saknas i Arch och Fedora", () => {
    expect(shell("debian").run("curl https://example.com").exitCode).toBe(127);
    expect(shell("arch").run("wget https://example.com").exitCode).toBe(127);
    expect(shell("fedora").run("wget https://example.com").exitCode).toBe(127);
  });

  itNeeds(["cd", "wget"], "wget sparar filer, följer omdirigeringar och numrerar dubbletter", () => {
    const t = shell("ubuntu");
    t.run("cd ~");
    const r = t.run("wget https://example.com/cheatsheet.txt");
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Connecting to example.com (example.com)|203.0.113.10|:443... connected.");
    expect(r.out).toContain("‘cheatsheet.txt’ saved");
    t.run("wget -q https://example.com/cheatsheet.txt");
    expect(t.node("~/cheatsheet.txt.1")).not.toBeNull();
    expect(t.run("wget http://linux.org").out).toContain("Location: https://linux.org/ [following]");
    expect(t.content("~/index.html")).toContain("Linux.org");
    expect(t.run("wget -O exempel.html https://example.com").exitCode).toBe(0);
    expect(t.content("~/exempel.html")).toContain("Example Domain");
    expect(t.run("wget https://example.com/saknas").exitCode).toBe(8);
    expect(t.run("wget http://finns-inte.example").exitCode).toBe(4);
    expect(t.run("wget -O - http://localhost:8080").out).toContain("Hello from myserver!");
  });

  // ---------- ssh ----------

  /** The commands withHosts runs. */
  const hostsCommands = ["echo", "sudo", "tee"];

  function withHosts(distro = "fedora"): TestShell {
    const s = shell(distro);
    s.run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
    return s;
  }

  itNeeds([...hostsCommands, "ssh", "hostname", "whoami", "cat"], "första gången frågar ssh om värdnyckeln", () => {
    const t = withHosts();
    const first = t.run("ssh elev@server.lan hostname");
    expect(first.pending).toBe(true);
    expect(first.out).toContain("The authenticity of host 'server.lan (192.168.1.10)' can't be established.");
    expect(t.run("y").pending).toBe(true); // "yes" must be typed out
    const r = t.run("yes");
    expect(r.line).toBe("ssh elev@server.lan hostname");
    expect(r.exitCode).toBe(0);
    expect(r.out).toContain("Warning: Permanently added 'server.lan' (ED25519)");
    expect(r.out.split("\n")).toContain("server");
    expect(t.content("~/.ssh/known_hosts")).toMatch(/^server\.lan ssh-ed25519 /);
    expect(t.node("~/.ssh")?.mode).toBe(Js.oct(700));
    // The second time: no question.
    const again = t.run("ssh elev@server.lan 'whoami; cat valkommen.txt'");
    expect(again.pending).toBe(false);
    expect(again.out).toContain("elev\nVälkommen till servern!");
  });

  itNeeds([...hostsCommands, "ssh", "true", "ls"], "nej, fel användare, fel port och okänd värd", () => {
    const t = withHosts();
    t.run("ssh elev@server.lan true");
    expect(t.run("no").out).toContain("Host key verification failed.");
    t.run("ssh elev@192.168.1.10 true");
    t.run("yes");
    expect(t.run("ssh root@192.168.1.10 ls").out).toContain("Permission denied (publickey,password)");
    expect(t.run("ssh -p 2222 elev@server.lan ls").out).toContain("port 2222: Connection refused");
    expect(t.run("ssh elev@okand.lan ls").out).toContain("Could not resolve hostname okand.lan");
    expect(t.run("ssh 192.168.1.1").out).toContain("Connection refused");
  });

  itNeeds([...hostsCommands, "ssh", "touch", "ls", "hostname", "wc"], "kommandon körs på servern, inte lokalt", () => {
    const t = withHosts();
    t.run("ssh elev@server.lan touch pa-servern.txt");
    t.run("yes");
    expect(t.sh.vfs.tryLookup("/home/elev/pa-servern.txt", t.sh.rootUser())).toBeNull();
    expect(t.run("ssh elev@server.lan ls").out).toContain("pa-servern.txt");
    expect(t.run("ssh elev@server.lan hostname -I").out).toContain("192.168.1.10");
    expect(t.run("ssh elev@server.lan ls | wc -l").exitCode).toBe(0);
  });

  itNeeds([...hostsCommands, "ssh"], "interaktiv inloggning förklaras", () => {
    const t = withHosts();
    t.run("ssh server.lan");
    const r = t.run("yes");
    expect(r.out).toContain("Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY");
    expect(r.out).toContain("Connection to server.lan closed.");
  });

  itNeeds([...hostsCommands, "ssh", "ssh-keygen", "ssh-copy-id", "cat"], "ssh-keygen och ssh-copy-id ger inloggning utan lösenord", () => {
    const t = withHosts("ubuntu");
    expect(t.run("ssh-copy-id elev@server.lan").out).toContain("No identities found");
    const k = t.run("ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519");
    expect(k.exitCode).toBe(0);
    expect(k.out).toContain("Your public key has been saved in /home/elev/.ssh/id_ed25519.pub");
    expect(k.out).toContain("+----[SHA256]-----+");
    expect(t.node("~/.ssh/id_ed25519")?.mode).toBe(Js.oct(600));
    expect(t.content("~/.ssh/id_ed25519.pub")).toMatch(/^ssh-ed25519 AAAA\S+ elev@ubuntu\n$/);
    t.run("ssh-copy-id elev@server.lan");
    const copied = t.run("yes");
    expect(copied.out).toContain("Number of key(s) added: 1");
    const login = t.run("ssh elev@server.lan cat .ssh/authorized_keys");
    expect(login.out).not.toContain("password");
    expect(login.out).toContain(t.content("~/.ssh/id_ed25519.pub")!.trim());
    expect(t.run("ssh-copy-id elev@server.lan").out).toContain("All keys were skipped");
  });

  itNeeds(["ssh-keygen"], "interaktiv ssh-keygen frågar efter fil och lösenfras", () => {
    const t = shell("fedora");
    expect(t.run("ssh-keygen").pending).toBe(true);
    expect(t.run("").pending).toBe(true);
    expect(t.run("hemlig").pending).toBe(true);
    expect(t.run("annan").out).toContain("Passphrases do not match");
    t.run("ssh-keygen");
    t.run("");
    t.run("");
    expect(t.run("").out).toContain("The key fingerprint is:");
    expect(t.node("~/.ssh/id_ed25519.pub")).not.toBeNull();
    t.run("ssh-keygen");
    t.run("");
    expect(t.run("n").exitCode).toBe(1);
  });

  itNeeds([...hostsCommands, "ssh", "pacman", "hostname"], "ssh saknas i Arch tills openssh installeras", () => {
    const t = withHosts("arch");
    expect(t.run("ssh elev@server.lan hostname").exitCode).toBe(127);
    t.run("sudo pacman -S openssh");
    t.run("y");
    expect(t.run("ssh elev@server.lan hostname").pending).toBe(true);
  });

  // ---------- traceroute och getent ----------

  itNeeds(["sudo", "pacman", "traceroute"], "traceroute visar vägen via gatewayen", () => {
    const t = shell();
    t.run("sudo pacman -S traceroute");
    t.run("y");
    const r = t.run("traceroute example.com");
    expect(r.out).toMatch(/^ 1 {2}192\.168\.1\.1 \(192\.168\.1\.1\)/m);
    expect(r.out).toMatch(/example\.com \(203\.0\.113\.10\)/);
  });

  itNeeds(["getent"], "getent slår upp i hosts, passwd och group", () => {
    const t = shell();
    expect(t.run("getent hosts localhost").out).toContain("127.0.0.1");
    expect(t.run("getent hosts example.com").out).toBe("203.0.113.10    example.com\n");
    expect(t.run("getent passwd elev").out).toMatch(/^elev:x:1000:/);
    expect(t.run("getent hosts finns.inte").exitCode).toBe(2);
  });

  // ---------- sparade terminaler ----------

  itNeeds(["which"], "resolv.conf och myserver läggs till i gamla sparade tillstånd", () => {
    const sh = Shell.create("ubuntu", "sv");
    const root = sh.rootUser();
    sh.vfs.remove("/etc/resolv.conf", root);
    sh.vfs.remove("/usr/local/bin/myserver", root);
    const snap = snapshotFromJson(sh.snapshotJson())!;
    snap.flags.delete("default:file:/etc/resolv.conf");
    snap.flags.delete("default:file:/usr/local/bin/myserver");
    const restored = Shell.restore(snap)!;
    expect(restored.vfs.tryLookup("/etc/resolv.conf", root)?.content).toContain("127.0.0.53");
    expect(UtilCmd.stripAnsi(restored.execute("which myserver").output)).toBe("/usr/local/bin/myserver\n");
  });
});
