using System.Text.RegularExpressions;

namespace Codestead.Shell.Tests;

// Port of src/shell/users.test.ts
public class UsersTests
{
    private static ShadowEntry? ShadowOf(Shell sh, string name) => UsersLib.LoadDb(sh).Shadow.Find(s => s.Name == name);

    // ---------- användare läses från /etc/passwd och /etc/group ----------

    [Fact(DisplayName = "elev och root fungerar som förut")]
    public void StudentAndRoot()
    {
        var t = new TestShell();
        Assert.Equal("uid=1000(elev) gid=1000(elev) groups=1000(elev),27(sudo)\n", t.Run("id").Out);
        Assert.Equal("elev sudo\n", t.Run("groups").Out);
        Assert.Equal("uid=0(root) gid=0(root) groups=0(root)\n", t.Run("id root").Out);
        var me = t.Sh.CurrentUser();
        Assert.Equal("elev", me.Name);
        Assert.Equal(1000, me.Uid);
        Assert.Equal(new[] { "elev", "sudo" }, me.Groups);
        Assert.Equal("/home/elev", me.Home);
        Assert.Equal("elev\n", t.Run("id -un").Out);
        Assert.Equal("1000 27\n", t.Run("id -G").Out);
    }

    [Fact(DisplayName = "wheel i Arch och Fedora")]
    public void WheelArchFedora()
    {
        Assert.Equal("uid=1000(elev) gid=1000(elev) groups=1000(elev),998(wheel)\n", new TestShell("arch").Run("id").Out);
        Assert.Equal("elev : elev wheel\n", new TestShell("fedora").Run("groups elev").Out);
    }

    [Fact(DisplayName = "okända användare")]
    public void UnknownUsers()
    {
        var t = new TestShell();
        Assert.Equal("id: 'nisse': no such user\n", t.Run("id nisse").Out);
        Assert.Equal(1, t.Run("groups nisse").ExitCode);
    }

    [Fact(DisplayName = "gamla sparade terminaler (kort /etc/passwd, ingen /etc/skel) fungerar")]
    public void OldSnapshots()
    {
        var sh = new TestShell().Sh;
        var root = sh.RootUser();
        sh.Vfs.WriteFile("/etc/passwd", "root:x:0:0:root:/root:/bin/bash\nelev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n", root);
        sh.Vfs.WriteFile("/etc/group", "root:x:0:\nsudo:x:27:elev\nelev:x:1000:\n", root);
        sh.Vfs.Remove("/etc/skel", root);
        var snap = sh.Snapshot();
        foreach (var k in snap.Flags.Keys.ToList()) if (k.StartsWith("default:file:/etc", StringComparison.Ordinal)) snap.Flags.Remove(k);
        var restored = Shell.Restore(Js.Parse<ShellSnapshot>(Js.Stringify(snap)))!;
        Assert.Equal(new[] { "elev", "sudo" }, restored.CurrentUser().Groups);
        Assert.NotNull(restored.Vfs.TryLookup("/etc/skel/.bashrc", root));
        restored.Execute("sudo useradd -m kim");
        Assert.Equal("uid=1001(kim) gid=1001(kim) groups=1001(kim)\n", restored.Execute("id kim").Output);
    }

    [Fact(DisplayName = "ändringar i /etc/group syns direkt (cachen töms)")]
    public void GroupChangesVisible()
    {
        var t = new TestShell();
        t.Run("echo 'spel:x:1500:elev' | sudo tee -a /etc/group");
        Assert.Equal("elev sudo spel\n", t.Run("groups").Out);
    }

    // ---------- useradd, usermod, userdel ----------

    [Fact(DisplayName = "useradd -m -s skapar användare, grupp, hemkatalog och shadow-rad")]
    public void UseraddCreates()
    {
        var t = new TestShell();
        var sh = t.Sh;
        Assert.Contains("useradd: Permission denied.", t.Run("useradd kim").Out);
        Assert.Equal(0, t.Run("sudo useradd -m -s /bin/bash -c \"Kim Svensson\" kim").ExitCode);
        Assert.Equal("kim:x:1001:1001:Kim Svensson:/home/kim:/bin/bash\n", t.Run("grep kim /etc/passwd").Out);
        Assert.Equal(1001, UsersLib.FindGroup(sh, "kim")?.Gid);
        Assert.Equal("!", ShadowOf(sh, "kim")?.Hash);
        Assert.Contains("Permission denied", t.Run("ls -la /home/kim").Out);
        Assert.Contains(".bashrc", t.Run("sudo ls -la /home/kim").Out);
        var home = sh.Vfs.TryLookup("/home/kim", sh.RootUser())!;
        Assert.Equal(("kim", "kim", Js.Oct(750)), (home.Owner, home.Group, home.Mode));
        Assert.Equal("uid=1001(kim) gid=1001(kim) groups=1001(kim)\n", t.Run("id kim").Out);
        Assert.Equal("useradd: user 'kim' already exists\n", t.Run("sudo useradd kim").Out);
        t.Run("sudo useradd -m alex");
        Assert.Equal(1002, UsersLib.FindUser(sh, "alex")?.Uid);
    }

    [Fact(DisplayName = "standardvärden skiljer sig mellan familjerna")]
    public void DefaultsDiffer()
    {
        var deb = new TestShell("debian");
        deb.Run("sudo useradd kim");
        Assert.Equal("/bin/sh", UsersLib.FindUser(deb.Sh, "kim")?.Shell);
        Assert.Null(deb.Sh.Vfs.TryLookup("/home/kim", deb.Sh.RootUser()));

        var fed = new TestShell("fedora");
        fed.Run("sudo useradd kim");
        Assert.Equal("/bin/bash", UsersLib.FindUser(fed.Sh, "kim")?.Shell);
        Assert.Equal(Js.Oct(700), fed.Sh.Vfs.TryLookup("/home/kim", fed.Sh.RootUser())?.Mode);
        Assert.Equal("!!", ShadowOf(fed.Sh, "kim")?.Hash);
    }

    [Fact(DisplayName = "ogiltiga namn och grupper")]
    public void InvalidNamesAndGroups()
    {
        var t = new TestShell();
        Assert.Equal(3, t.Run("sudo useradd Kim").ExitCode);
        Assert.Equal("useradd: group 'finnsinte' does not exist\n", t.Run("sudo useradd -G finnsinte kim").Out);
    }

    [Fact(DisplayName = "usermod -aG lägger till, -G utan -a ersätter")]
    public void UsermodGroups()
    {
        var t = new TestShell();
        t.Run("sudo useradd -m kim");
        t.Run("sudo groupadd utvecklare");
        t.Run("sudo usermod -aG utvecklare kim");
        t.Run("sudo usermod -aG sudo kim");
        Assert.Equal("kim : kim sudo utvecklare\n", t.Run("groups kim").Out);
        t.Run("sudo usermod -G utvecklare kim");
        Assert.Equal("kim : kim utvecklare\n", t.Run("groups kim").Out);
        Assert.Equal(2, t.Run("sudo usermod -a kim").ExitCode);
        t.Run("sudo usermod -s /bin/zsh kim");
        Assert.Equal("/bin/zsh", UsersLib.FindUser(t.Sh, "kim")?.Shell);
        Assert.Equal("usermod: user 'nisse' does not exist\n", t.Run("sudo usermod -s /bin/bash nisse").Out);
    }

    [Fact(DisplayName = "usermod -L låser och -U låser upp")]
    public void UsermodLock()
    {
        var t = new TestShell();
        t.Run("sudo useradd -m kim");
        t.Run("sudo passwd kim");
        t.Run("hemligt");
        t.Run("hemligt");
        t.Run("sudo usermod -L kim");
        Assert.True(ShadowOf(t.Sh, "kim")?.Hash.StartsWith("!$y$", StringComparison.Ordinal));
        Assert.Matches(@"^kim L ", t.Run("sudo passwd -S kim").Out);
        t.Run("sudo usermod -U kim");
        Assert.Matches(@"^kim P ", t.Run("sudo passwd -S kim").Out);
    }

    [Fact(DisplayName = "userdel -r tar bort allt; inloggade användare går inte att ta bort")]
    public void Userdel()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("sudo useradd -m -G sudo vikarie");
        Assert.Equal(0, t.Run("sudo userdel -r vikarie").ExitCode);
        Assert.Null(UsersLib.FindUser(sh, "vikarie"));
        Assert.Null(UsersLib.FindGroup(sh, "vikarie"));
        Assert.Equal(new[] { "elev" }, UsersLib.FindGroup(sh, "sudo")?.Members);
        Assert.Null(ShadowOf(sh, "vikarie"));
        Assert.Null(sh.Vfs.TryLookup("/home/vikarie", sh.RootUser()));
        Assert.Equal("userdel: user elev is currently used by process 1290\n", t.Run("sudo userdel elev").Out);
        Assert.Equal(6, t.Run("sudo userdel nisse").ExitCode);
    }

    // ---------- grupper ----------

    [Fact(DisplayName = "groupadd, gpasswd och groupdel")]
    public void GroupaddGpasswdGroupdel()
    {
        var t = new TestShell();
        var sh = t.Sh;
        Assert.Equal(10, t.Run("groupadd utvecklare").ExitCode);
        t.Run("sudo groupadd utvecklare");
        Assert.Equal("utvecklare:x:1001:\n", t.Run("getent group utvecklare").Out);
        Assert.Equal("groupadd: group 'utvecklare' already exists\n", t.Run("sudo groupadd utvecklare").Out);
        Assert.Equal("Adding user elev to group utvecklare\n", t.Run("sudo gpasswd -a elev utvecklare").Out);
        Assert.Equal(new[] { "elev" }, UsersLib.FindGroup(sh, "utvecklare")?.Members);
        Assert.Equal("Removing user elev from group utvecklare\n", t.Run("sudo gpasswd -d elev utvecklare").Out);
        Assert.Equal(3, t.Run("sudo gpasswd -d elev utvecklare").ExitCode);
        Assert.Equal("groupdel: cannot remove the primary group of user 'elev'\n", t.Run("sudo groupdel elev").Out);
        Assert.Equal(0, t.Run("sudo groupdel utvecklare").ExitCode);
        Assert.Null(UsersLib.FindGroup(sh, "utvecklare"));
    }

    [Fact(DisplayName = "chown och chgrp använder de riktiga grupperna")]
    public void ChownChgrp()
    {
        var t = new TestShell();
        t.Run("sudo groupadd utvecklare");
        t.Run("touch ~/fil.txt");
        Assert.Contains("Operation not permitted", t.Run("chgrp utvecklare ~/fil.txt").Out);
        t.Run("sudo usermod -aG utvecklare elev");
        Assert.Equal(0, t.Run("chgrp utvecklare ~/fil.txt").ExitCode);
        Assert.Contains("elev utvecklare", t.Run("ls -l ~/fil.txt").Out);
        Assert.Equal("chown: invalid user: 'nisse'\n", t.Run("sudo chown nisse ~/fil.txt").Out);
        t.Run("sudo useradd kim");
        Assert.Equal(0, t.Run("sudo chown kim: ~/fil.txt").ExitCode);
        Assert.Contains("kim kim", t.Run("ls -l ~/fil.txt").Out);
    }

    // ---------- passwd och su ----------

    [Fact(DisplayName = "passwd frågar två gånger och sparar en hash i /etc/shadow")]
    public void PasswdAsksTwice()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("sudo useradd -m kim");
        var r = t.Run("sudo passwd kim");
        Assert.True(r.Pending);
        Assert.Equal("New password: ", sh.Prompt());
        Assert.True(sh.PendingQuestion?.Secret);
        r = t.Run("hemligt123");
        Assert.Equal("Retype new password: ", sh.Prompt());
        r = t.Run("hemligt123");
        Assert.Equal("passwd: password updated successfully\n", r.Out);
        Assert.Equal("sudo passwd kim", r.Line);
        Assert.Matches(@"^\$y\$j9T\$", ShadowOf(sh, "kim")?.Hash);
        Assert.DoesNotContain("hemligt123", sh.History);
    }

    [Fact(DisplayName = "resten av raden körs efter båda frågorna")]
    public void RestOfLineAfterQuestions()
    {
        var t = new TestShell();
        t.Run("sudo useradd kim");
        t.Run("sudo passwd kim; echo klart");
        t.Run("abc");
        Assert.Equal("passwd: password updated successfully\nklart\n", t.Run("abc").Out);
        t.Run("sudo passwd kim; echo klart");
        t.Run("abc");
        Assert.Matches(@"password unchanged\nklart\n\z", t.Run("xyz").Out);
    }

    [Fact(DisplayName = "olika lösenord godtas inte")]
    public void MismatchedPasswords()
    {
        var t = new TestShell();
        t.Run("sudo useradd kim");
        t.Run("sudo passwd kim");
        t.Run("ett");
        var r = t.Run("två");
        Assert.Contains("Sorry, passwords do not match.", r.Out);
        Assert.Equal(10, r.ExitCode);
        Assert.Equal("!", ShadowOf(t.Sh, "kim")?.Hash);
    }

    [Fact(DisplayName = "bara root får byta andras lösenord")]
    public void OnlyRootChangesOthers()
    {
        Assert.Equal("passwd: You may not view or modify password information for root.\n", new TestShell().Run("passwd root").Out);
        Assert.Equal("passwd: Only root can specify a user name.\n", new TestShell("fedora").Run("passwd root").Out);
    }

    [Fact(DisplayName = "su - kim kräver kims lösenord")]
    public void SuNeedsPassword()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("sudo useradd -m -s /bin/bash kim");
        t.Run("sudo passwd kim");
        t.Run("hemligt");
        t.Run("hemligt");
        t.Run("su - kim");
        Assert.True(sh.PendingQuestion?.Secret);
        Assert.Equal("su: Authentication failure\n", t.Run("fel").Out);
        Assert.Equal("elev\n", t.Run("whoami").Out);
        t.Run("su - kim");
        t.Run("hemligt");
        Assert.Equal("kim\n", t.Run("whoami").Out);
        Assert.Equal("/home/kim", sh.Cwd);
        Assert.Contains("kim@ubuntu", sh.Prompt());
        Assert.Contains("kim is not in the sudoers file.", t.Run("sudo ls").Out);
        Assert.Equal("logout\n", t.Run("exit").Out);
        Assert.Equal("elev\n", t.Run("whoami").Out);
    }

    [Fact(DisplayName = "su utan lösenord på kontot och su som root")]
    public void SuWithoutPasswordAndAsRoot()
    {
        var t = new TestShell();
        t.Run("sudo useradd -m kim");
        t.Run("su kim");
        Assert.Contains("su: Authentication failure", t.Run("vad som helst").Out);
        t.Run("su -");
        Assert.Contains("sudo -i", t.Run("x").Out);
        t.Run("sudo -i");
        t.Run("su - kim");
        Assert.Equal("kim\n", t.Run("whoami").Out);
        t.Run("exit");
        Assert.Equal("This account is currently not available.\n", t.Run("su - daemon").Out);
    }

    [Fact(DisplayName = "su -c kör ett kommando")]
    public void SuC()
    {
        var t = new TestShell();
        t.Run("sudo useradd -m kim");
        Assert.Equal("kim\n", t.Run("sudo su -c whoami kim").Out);
        Assert.Equal("elev\n", t.Run("whoami").Out);
    }

    [Fact(DisplayName = "chage -l visar fälten i /etc/shadow")]
    public void ChageList()
    {
        var t = new TestShell();
        t.Run("sudo useradd kim");
        Assert.Equal("chage: Permission denied.\n", t.Run("chage -l kim").Out);
        t.Run("sudo chage -M 90 kim");
        var @out = t.Run("sudo chage -l kim").Out;
        Assert.Contains("Maximum number of days between password change\t\t: 90".Replace("\t\t", "          "), @out);
        Assert.DoesNotContain("Password expires                                        : never", @out);
        Assert.Equal(0, t.Run("chage -l elev").ExitCode);
    }

    [Fact(DisplayName = "chpasswd läser användare:lösenord")]
    public void Chpasswd()
    {
        var t = new TestShell();
        t.Run("sudo useradd kim");
        t.Run("echo 'kim:hemligt' | sudo chpasswd");
        Assert.Matches(@"^\$y\$", ShadowOf(t.Sh, "kim")?.Hash);
    }

    // ---------- sudo -u och sudo -i ----------

    [Fact(DisplayName = "sudo -u kör som en annan användare")]
    public void SudoU()
    {
        var t = new TestShell();
        t.Run("sudo useradd -m kim");
        Assert.Equal("kim\n", t.Run("sudo -u kim whoami").Out);
        Assert.Equal("sudo: unknown user nisse\n", t.Run("sudo -u nisse whoami").Out);
        Assert.Contains("Permission denied", t.Run("sudo -u kim touch /home/elev/x").Out);
    }

    [Fact(DisplayName = "ny användare i sudo-gruppen får använda sudo")]
    public void NewUserInSudoGroup()
    {
        var t = new TestShell("arch");
        t.Run("sudo useradd -m -G wheel kim");
        t.Run("sudo -iu kim");
        Assert.Equal("kim\n", t.Run("whoami").Out);
        Assert.Contains("root", t.Run("sudo whoami").Out);
        t.Run("exit");
        Assert.Equal("elev\n", t.Run("whoami").Out);
    }

    // ---------- adduser (Debian-familjen) ----------

    [Fact(DisplayName = "frågar efter lösenord och namn")]
    public void AdduserAsks()
    {
        var t = new TestShell("debian");
        var sh = t.Sh;
        Assert.Equal("fatal: Only root may add a user or group to the system.\n", t.Run("adduser kim").Out);
        var r = t.Run("sudo adduser kim");
        Assert.Contains("info: Adding user `kim' ...", r.Out);
        Assert.Contains("info: Creating home directory `/home/kim' ...", r.Out);
        Assert.Equal("New password: ", sh.Prompt());
        t.Run("hemligt");
        r = t.Run("hemligt");
        Assert.Contains("passwd: password updated successfully", r.Out);
        Assert.Equal("\tFull Name []: ", sh.Prompt());
        t.Run("Kim Svensson");
        Assert.Equal("Is the information correct? [Y/n] ", sh.Prompt());
        r = t.Run("");
        Assert.Contains("Adding user `kim' to group `users'", r.Out);
        var kim = UsersLib.FindUser(sh, "kim");
        Assert.NotNull(kim);
        Assert.Equal(1001, kim.Uid);
        Assert.Equal("Kim Svensson,,,", kim.Gecos);
        Assert.Equal("/bin/bash", kim.Shell);
        Assert.Equal("/home/kim", kim.Home);
        Assert.Equal("info: Adding user `kim' to group `sudo' ...\n", t.Run("sudo adduser kim sudo").Out);
        Assert.Equal("kim : kim sudo users\n", t.Run("groups kim").Out);
        t.Run("sudo deluser --remove-home kim");
        Assert.Null(UsersLib.FindUser(sh, "kim"));
    }

    [Fact(DisplayName = "finns inte i Arch")]
    public void AdduserNotInArch()
    {
        Assert.Contains("command not found", new TestShell("arch").Run("sudo adduser kim").Out);
    }

    // ---------- who, w, last, getent ----------

    [Fact(DisplayName = "visar den inloggade användaren")]
    public void WhoWLastGetent()
    {
        var t = new TestShell();
        Assert.Matches(@"^elev\s+pts/0\s+[0-9]{4}-[0-9]{2}-[0-9]{2} 08:12\n\z", t.Run("who").Out);
        Assert.Contains("USER     TTY", t.Run("w").Out);
        Assert.Contains("still logged in", t.Run("last").Out);
        Assert.Equal("elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n", t.Run("getent passwd elev").Out);
        Assert.Equal("sudo:x:27:elev\n", t.Run("getent group 27").Out);
        Assert.Equal(2, t.Run("getent passwd nisse").ExitCode);
        Assert.Equal(2, t.Run("getent shadow").ExitCode);
        Assert.Matches(new Regex("^root:\\*:", RegexOptions.Multiline), t.Run("sudo getent shadow root").Out);
    }

    [Fact(DisplayName = "paketen heter olika i familjerna")]
    public void PackagesDiffer()
    {
        var arch = new TestShell("arch");
        Assert.True(arch.Sh.Installed.ContainsKey("shadow"));
        Assert.False(arch.Sh.Installed.ContainsKey("adduser"));
        Assert.True(new TestShell("debian").Sh.Installed.ContainsKey("adduser"));
    }
}
