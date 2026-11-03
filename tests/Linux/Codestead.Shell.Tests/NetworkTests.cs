using System.Text.RegularExpressions;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/network.test.ts
public class NetworkTests
{
    private static TestShell Shell(string distro = "arch") => new(distro);

    // ---------- ip och hostname ----------

    [Fact(DisplayName = "ip a, ip -br a och hostname -I visar adresserna")]
    public void IpAddresses()
    {
        var t = Shell();
        var a = t.Run("ip a");
        Assert.Equal(0, a.ExitCode);
        Assert.Contains("inet 127.0.0.1/8 scope host lo", a.Out);
        Assert.Contains("inet 192.168.1.42/24 brd 192.168.1.255", a.Out);
        Assert.Contains("state UP", a.Out);
        Assert.DoesNotContain("enp0s3", t.Run("ip addr show dev lo").Out);
        Assert.Matches(@"(?m)^enp0s3\s+UP\s+192\.168\.1\.42/24", t.Run("ip -br a").Out);
        Assert.Equal("192.168.1.42 \n", t.Run("hostname -I").Out);
        Assert.NotEqual(0, t.Run("ip x").ExitCode);
    }

    [Fact(DisplayName = "ip route visar gatewayen")]
    public void IpRoute()
    {
        var t = Shell();
        Assert.Contains("default via 192.168.1.1 dev enp0s3", t.Run("ip r").Out);
        Assert.Contains("via 192.168.1.1", t.Run("ip route get 1.1.1.1").Out);
        Assert.Contains("192.168.1.1 dev enp0s3", t.Run("ip neigh").Out);
    }

    [Fact(DisplayName = "ip link set kräver root, och ett avstängt kort stänger nätet")]
    public void IpLinkSet()
    {
        var t = Shell();
        var denied = t.Run("ip link set enp0s3 down");
        Assert.Contains("Operation not permitted", denied.Out);
        Assert.Equal(0, t.Run("sudo ip link set enp0s3 down").ExitCode);
        Assert.Contains("state DOWN", t.Run("ip link").Out);
        Assert.Equal("", t.Run("ip route").Out);
        Assert.Contains("Network is unreachable", t.Run("ping -c 1 192.168.1.1").Out);
        Assert.Contains("Temporary failure in name resolution", t.Run("ping -c 1 example.com").Out);
        // localhost still works
        Assert.Equal(0, t.Run("ping -c 1 localhost").ExitCode);
        t.Run("sudo ip link set dev enp0s3 up");
        Assert.Equal(0, t.Run("ping -c 1 example.com").ExitCode);
    }

    // ---------- ping ----------

    [Fact(DisplayName = "-c räknar paketen och visar statistik")]
    public void PingCount()
    {
        var t = Shell();
        var r = t.Run("ping -c 3 192.168.1.1");
        Assert.Equal(0, r.ExitCode);
        Assert.Equal(3, Regex.Matches(r.Out, @"^64 bytes from 192\.168\.1\.1: icmp_seq=[0-9] ttl=64 time=[0-9.]+ ms$", RegexOptions.Multiline).Count);
        Assert.Contains("3 packets transmitted, 3 received, 0% packet loss", r.Out);
        Assert.Matches(@"rtt min/avg/max/mdev = [0-9.]+/[0-9.]+/[0-9.]+/[0-9.]+ ms", r.Out);
    }

    [Fact(DisplayName = "utan -c \"trycker\" simulatorn Ctrl+C efter några svar")]
    public void PingWithoutCount()
    {
        var t = Shell();
        var r = t.Run("ping example.com");
        Assert.Contains("PING example.com (203.0.113.10) 56(84) bytes of data.", r.Out);
        Assert.Contains("64 bytes from example.com (203.0.113.10)", r.Out);
        Assert.Contains("^C", r.Out);
        Assert.Contains("Ctrl+C", r.Out);
    }

    [Fact(DisplayName = "okända namn och adresser som inte svarar")]
    public void PingUnknown()
    {
        var t = Shell();
        var unknown = t.Run("ping -c 1 finns-inte.example");
        Assert.Equal(2, unknown.ExitCode);
        Assert.Contains("Name or service not known", unknown.Out);
        var lan = t.Run("ping -c 2 192.168.1.77");
        Assert.Equal(1, lan.ExitCode);
        Assert.Contains("Destination Host Unreachable", lan.Out);
        Assert.Contains("100% packet loss", t.Run("ping -c 2 10.9.8.7").Out);
        Assert.Contains("Destination address required", t.Run("ping").Out);
    }

    // ---------- namnuppslag ----------

    [Fact(DisplayName = "/etc/hosts används av ping och getent men inte av dig")]
    public void EtcHosts()
    {
        var t = Shell("debian");
        Assert.Equal(2, t.Run("ping -c 1 server.lan").ExitCode);
        t.Run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
        var ping = t.Run("ping -c 2 server.lan");
        Assert.Equal(0, ping.ExitCode);
        Assert.Contains("64 bytes from server.lan (192.168.1.10)", ping.Out);
        Assert.Equal("192.168.1.10    server.lan\n", t.Run("getent hosts server.lan").Out);
        t.Run("sudo apt update");
        t.Run("sudo apt install dnsutils");
        Assert.Equal("", t.Run("dig +short server.lan").Out);
        Assert.Contains("status: NXDOMAIN", t.Run("dig server.lan").Out);
    }

    [Fact(DisplayName = "dig, host och nslookup måste installeras och frågar DNS")]
    public void DnsTools()
    {
        var t = Shell("fedora");
        Assert.Equal(127, t.Run("dig example.com").ExitCode);
        t.Run("sudo dnf install bind-utils");
        t.Run("y");
        Assert.Equal("203.0.113.10\n", t.Run("dig +short example.com").Out);
        var full = t.Run("dig example.com");
        Assert.Contains(";; ANSWER SECTION:", full.Out);
        Assert.Contains("SERVER: 127.0.0.53#53", full.Out);
        Assert.Contains("SERVER: 1.1.1.1#53", t.Run("dig @1.1.1.1 example.com").Out);
        Assert.Equal("2001:db8::10\n", t.Run("dig +short example.com AAAA").Out);
        Assert.Contains("example.com has address 203.0.113.10", t.Run("host example.com").Out);
        Assert.Contains("domain name pointer one.one.one.one.", t.Run("host 1.1.1.1").Out);
        Assert.Contains("not found: 3(NXDOMAIN)", t.Run("host nope.invalid").Out);
        Assert.Contains("Address: 203.0.113.30", t.Run("nslookup archlinux.org").Out);
    }

    [Fact(DisplayName = "paketnamnen skiljer sig mellan familjerna")]
    public void PackageNames()
    {
        Assert.Contains("dig", PackagesLib.FindPackage("debian", "dnsutils")?.Provides ?? new List<string>());
        Assert.Contains("dig", PackagesLib.FindPackage("arch", "bind")?.Provides ?? new List<string>());
        Assert.Contains("dig", PackagesLib.FindPackage("redhat", "bind-utils")?.Provides ?? new List<string>());
        Assert.Contains("ss", PackagesLib.FindPackage("redhat", "iproute")?.Provides ?? new List<string>());
        Assert.Contains("ping", PackagesLib.FindPackage("debian", "iputils-ping")?.Provides ?? new List<string>());
    }

    [Fact(DisplayName = "en trasig /etc/resolv.conf stoppar namn men inte adresser")]
    public void BrokenResolvConf()
    {
        var t = Shell("debian");
        Assert.Contains("nameserver 192.168.1.1", t.Run("cat /etc/resolv.conf").Out);
        t.Run("echo 'nameserver 10.0.0.99' | sudo tee /etc/resolv.conf");
        Assert.Contains("Temporary failure in name resolution", t.Run("ping -c 1 example.com").Out);
        Assert.Equal(0, t.Run("ping -c 1 1.1.1.1").ExitCode);
    }

    // ---------- ss och myserver ----------

    [Fact(DisplayName = "ss -tulpn visar lyssnande portar, processerna bara med sudo")]
    public void SsListening()
    {
        var t = Shell();
        var r = t.Run("ss -tulpn");
        Assert.Matches(@"tcp\s+LISTEN.*0\.0\.0\.0:22\b", r.Out);
        Assert.Matches(@"0\.0\.0\.0:8080\b", r.Out);
        Assert.DoesNotContain("users:", r.Out);
        var root = t.Run("sudo ss -tulpn");
        Assert.Contains("users:((\"sshd\",pid=733", root.Out);
        Assert.Contains("users:((\"myserver\",pid=812", root.Out);
        Assert.Contains("0.0.0.0:ssh", t.Run("ss -tl").Out);
    }

    [Fact(DisplayName = "myserver kan stoppas och startas igen")]
    public void MyserverRestart()
    {
        var t = Shell();
        Assert.Contains("Address already in use", t.Run("myserver").Out);
        t.Run("sudo pkill myserver");
        Assert.DoesNotContain(":8080", t.Run("ss -tln").Out);
        Assert.Equal(7, t.Run("curl http://localhost:8080").ExitCode);
        Assert.Contains("Permission denied", t.Run("myserver --port 80").Out);
        Assert.Equal(0, t.Run("myserver").ExitCode);
        Assert.Contains("users:((\"myserver\"", t.Run("ss -tlpn").Out);
        Assert.Contains("Hello from myserver!", t.Run("curl -s localhost:8080").Out);
    }

    // ---------- curl och wget ----------

    [Fact(DisplayName = "curl hämtar sidor och visar headers")]
    public void CurlPages()
    {
        var t = Shell();
        Assert.Contains("<h1>Hello from myserver!</h1>", t.Run("curl http://localhost:8080").Out);
        var head = t.Run("curl -I https://example.com");
        Assert.Matches(@"^HTTP/2 200\n", head.Out);
        Assert.Contains("content-type: text/html", head.Out);
        Assert.DoesNotContain("<html>", head.Out);
        Assert.Contains("<title>Example Domain</title>", t.Run("curl -s https://example.com | grep title").Out);
        Assert.Matches(@"^HTTP/1\.0 200 OK\n[\s\S]*Server: myserver/1\.0[\s\S]*About myserver", t.Run("curl -i http://localhost:8080/about.html").Out);
    }

    [Fact(DisplayName = "omdirigeringar följs bara med -L")]
    public void CurlRedirects()
    {
        var t = Shell();
        var plain = t.Run("curl http://linux.org");
        Assert.Contains("301 Moved Permanently", plain.Out);
        Assert.Contains("-L", plain.Out);
        Assert.Contains("Location: https://linux.org/", t.Run("curl -I http://linux.org").Out);
        Assert.Contains("<h1>Linux.org</h1>", t.Run("curl -L http://linux.org").Out);
    }

    [Fact(DisplayName = "curl -o, -O och felkoder")]
    public void CurlOutputAndErrors()
    {
        var t = Shell();
        t.Run("cd ~");
        Assert.Equal(0, t.Run("curl -o sida.html https://example.com").ExitCode);
        Assert.Contains("Example Domain", t.Content("~/sida.html"));
        Assert.Equal(0, t.Run("curl -O https://example.com/cheatsheet.txt").ExitCode);
        Assert.Contains("ss -tulpn", t.Content("~/cheatsheet.txt"));
        Assert.Equal(23, t.Run("curl -o /etc/x.html https://example.com").ExitCode);
        Assert.Equal(22, t.Run("curl -f http://localhost:8080/finns-inte").ExitCode);
        Assert.Contains("404 Not Found", t.Run("curl http://localhost:8080/finns-inte").Out);
        Assert.Contains("curl: (6) Could not resolve host: finns-inte.example", t.Run("curl https://finns-inte.example").Out);
        Assert.Equal(7, t.Run("curl http://192.168.1.10:8080").ExitCode);
        Assert.Equal(1, t.Run("curl ftp://example.com").ExitCode);
    }

    [Fact(DisplayName = "curl saknas i Debian, wget saknas i Arch och Fedora")]
    public void CurlWgetMissing()
    {
        Assert.Equal(127, Shell("debian").Run("curl https://example.com").ExitCode);
        Assert.Equal(127, Shell("arch").Run("wget https://example.com").ExitCode);
        Assert.Equal(127, Shell("fedora").Run("wget https://example.com").ExitCode);
    }

    [Fact(DisplayName = "wget sparar filer, följer omdirigeringar och numrerar dubbletter")]
    public void Wget()
    {
        var t = Shell("ubuntu");
        t.Run("cd ~");
        var r = t.Run("wget https://example.com/cheatsheet.txt");
        Assert.Equal(0, r.ExitCode);
        Assert.Contains("Connecting to example.com (example.com)|203.0.113.10|:443... connected.", r.Out);
        Assert.Contains("‘cheatsheet.txt’ saved", r.Out);
        t.Run("wget -q https://example.com/cheatsheet.txt");
        Assert.NotNull(t.Node("~/cheatsheet.txt.1"));
        Assert.Contains("Location: https://linux.org/ [following]", t.Run("wget http://linux.org").Out);
        Assert.Contains("Linux.org", t.Content("~/index.html"));
        Assert.Equal(0, t.Run("wget -O exempel.html https://example.com").ExitCode);
        Assert.Contains("Example Domain", t.Content("~/exempel.html"));
        Assert.Equal(8, t.Run("wget https://example.com/saknas").ExitCode);
        Assert.Equal(4, t.Run("wget http://finns-inte.example").ExitCode);
        Assert.Contains("Hello from myserver!", t.Run("wget -O - http://localhost:8080").Out);
    }

    // ---------- ssh ----------

    private static TestShell WithHosts(string distro = "fedora")
    {
        var s = Shell(distro);
        s.Run("echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts");
        return s;
    }

    [Fact(DisplayName = "första gången frågar ssh om värdnyckeln")]
    public void SshHostKey()
    {
        var t = WithHosts();
        var first = t.Run("ssh elev@server.lan hostname");
        Assert.True(first.Pending);
        Assert.Contains("The authenticity of host 'server.lan (192.168.1.10)' can't be established.", first.Out);
        Assert.True(t.Run("y").Pending); // "yes" must be typed out
        var r = t.Run("yes");
        Assert.Equal("ssh elev@server.lan hostname", r.Line);
        Assert.Equal(0, r.ExitCode);
        Assert.Contains("Warning: Permanently added 'server.lan' (ED25519)", r.Out);
        Assert.Contains("server", r.Out.Split('\n'));
        Assert.Matches(@"^server\.lan ssh-ed25519 ", t.Content("~/.ssh/known_hosts"));
        Assert.Equal(Js.Oct(700), t.Node("~/.ssh")?.Mode);
        // The second time: no question.
        var again = t.Run("ssh elev@server.lan 'whoami; cat valkommen.txt'");
        Assert.False(again.Pending);
        Assert.Contains("elev\nVälkommen till servern!", again.Out);
    }

    [Fact(DisplayName = "nej, fel användare, fel port och okänd värd")]
    public void SshFailures()
    {
        var t = WithHosts();
        t.Run("ssh elev@server.lan true");
        Assert.Contains("Host key verification failed.", t.Run("no").Out);
        t.Run("ssh elev@192.168.1.10 true");
        t.Run("yes");
        Assert.Contains("Permission denied (publickey,password)", t.Run("ssh root@192.168.1.10 ls").Out);
        Assert.Contains("port 2222: Connection refused", t.Run("ssh -p 2222 elev@server.lan ls").Out);
        Assert.Contains("Could not resolve hostname okand.lan", t.Run("ssh elev@okand.lan ls").Out);
        Assert.Contains("Connection refused", t.Run("ssh 192.168.1.1").Out);
    }

    [Fact(DisplayName = "kommandon körs på servern, inte lokalt")]
    public void SshRunsOnServer()
    {
        var t = WithHosts();
        t.Run("ssh elev@server.lan touch pa-servern.txt");
        t.Run("yes");
        Assert.Null(t.Sh.Vfs.TryLookup("/home/elev/pa-servern.txt", t.Sh.RootUser()));
        Assert.Contains("pa-servern.txt", t.Run("ssh elev@server.lan ls").Out);
        Assert.Contains("192.168.1.10", t.Run("ssh elev@server.lan hostname -I").Out);
        Assert.Equal(0, t.Run("ssh elev@server.lan ls | wc -l").ExitCode);
    }

    [Fact(DisplayName = "interaktiv inloggning förklaras")]
    public void SshInteractive()
    {
        var t = WithHosts();
        t.Run("ssh server.lan");
        var r = t.Run("yes");
        Assert.Contains("Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY", r.Out);
        Assert.Contains("Connection to server.lan closed.", r.Out);
    }

    [Fact(DisplayName = "ssh-keygen och ssh-copy-id ger inloggning utan lösenord")]
    public void SshKeys()
    {
        var t = WithHosts("ubuntu");
        Assert.Contains("No identities found", t.Run("ssh-copy-id elev@server.lan").Out);
        var k = t.Run("ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519");
        Assert.Equal(0, k.ExitCode);
        Assert.Contains("Your public key has been saved in /home/elev/.ssh/id_ed25519.pub", k.Out);
        Assert.Contains("+----[SHA256]-----+", k.Out);
        Assert.Equal(Js.Oct(600), t.Node("~/.ssh/id_ed25519")?.Mode);
        Assert.Matches(@"^ssh-ed25519 AAAA\S+ elev@ubuntu\n\z", t.Content("~/.ssh/id_ed25519.pub"));
        t.Run("ssh-copy-id elev@server.lan");
        var copied = t.Run("yes");
        Assert.Contains("Number of key(s) added: 1", copied.Out);
        var login = t.Run("ssh elev@server.lan cat .ssh/authorized_keys");
        Assert.DoesNotContain("password", login.Out);
        Assert.Contains(t.Content("~/.ssh/id_ed25519.pub")!.Trim(), login.Out);
        Assert.Contains("All keys were skipped", t.Run("ssh-copy-id elev@server.lan").Out);
    }

    [Fact(DisplayName = "interaktiv ssh-keygen frågar efter fil och lösenfras")]
    public void SshKeygenInteractive()
    {
        var t = Shell("fedora");
        Assert.True(t.Run("ssh-keygen").Pending);
        Assert.True(t.Run("").Pending);
        Assert.True(t.Run("hemlig").Pending);
        Assert.Contains("Passphrases do not match", t.Run("annan").Out);
        t.Run("ssh-keygen");
        t.Run("");
        t.Run("");
        Assert.Contains("The key fingerprint is:", t.Run("").Out);
        Assert.NotNull(t.Node("~/.ssh/id_ed25519.pub"));
        t.Run("ssh-keygen");
        t.Run("");
        Assert.Equal(1, t.Run("n").ExitCode);
    }

    [Fact(DisplayName = "ssh saknas i Arch tills openssh installeras")]
    public void SshMissingInArch()
    {
        var t = WithHosts("arch");
        Assert.Equal(127, t.Run("ssh elev@server.lan hostname").ExitCode);
        t.Run("sudo pacman -S openssh");
        t.Run("y");
        Assert.True(t.Run("ssh elev@server.lan hostname").Pending);
    }

    // ---------- traceroute och getent ----------

    [Fact(DisplayName = "traceroute visar vägen via gatewayen")]
    public void Traceroute()
    {
        var t = Shell();
        t.Run("sudo pacman -S traceroute");
        t.Run("y");
        var r = t.Run("traceroute example.com");
        Assert.Matches(@"(?m)^ 1 {2}192\.168\.1\.1 \(192\.168\.1\.1\)", r.Out);
        Assert.Matches(@"example\.com \(203\.0\.113\.10\)", r.Out);
    }

    [Fact(DisplayName = "getent slår upp i hosts, passwd och group")]
    public void Getent()
    {
        var t = Shell();
        Assert.Contains("127.0.0.1", t.Run("getent hosts localhost").Out);
        Assert.Equal("203.0.113.10    example.com\n", t.Run("getent hosts example.com").Out);
        Assert.Matches(@"^elev:x:1000:", t.Run("getent passwd elev").Out);
        Assert.Equal(2, t.Run("getent hosts finns.inte").ExitCode);
    }

    // ---------- sparade terminaler ----------

    [Fact(DisplayName = "resolv.conf och myserver läggs till i gamla sparade tillstånd")]
    public void OldSnapshots()
    {
        var sh = Codestead.Shell.Shell.Create("ubuntu", "sv");
        var root = sh.RootUser();
        sh.Vfs.Remove("/etc/resolv.conf", root);
        sh.Vfs.Remove("/usr/local/bin/myserver", root);
        var snap = Js.Parse<ShellSnapshot>(sh.SnapshotJson())!;
        snap.Flags.Remove("default:file:/etc/resolv.conf");
        snap.Flags.Remove("default:file:/usr/local/bin/myserver");
        var restored = Codestead.Shell.Shell.Restore(snap)!;
        Assert.Contains("127.0.0.53", restored.Vfs.TryLookup("/etc/resolv.conf", root)?.Content);
        Assert.Equal("/usr/local/bin/myserver\n", UtilCmd.StripAnsi(restored.Execute("which myserver").Output));
    }
}
