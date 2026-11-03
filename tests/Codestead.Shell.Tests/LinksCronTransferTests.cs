using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

/// <summary>Links (ln, readlink, stat ...), xargs, nohup, watch, umask, ~/.ssh/config, scp, rsync and cron.</summary>
public class LinksCronTransferTests
{
    private static TestShell En(string distro = "ubuntu") => new(distro, "en", "en");

    private const string Home = "/home/student";

    // ---------- symbolic links ----------

    [Fact(DisplayName = "ln -s: länken visas med ->, följs av cat och cd, och rm tar bara bort länken")]
    public void SymbolicLinks()
    {
        var t = En();
        Assert.Equal(0, t.Run("ln -s documents/fruits.txt fr").ExitCode);
        var ls = t.Run("ls -l fr").Out;
        Assert.StartsWith("lrwxrwxrwx 1 student student 20 ", ls);
        Assert.EndsWith(" fr -> documents/fruits.txt\n", ls);
        Assert.StartsWith("apple\nbanana", t.Run("cat fr").Out);
        Assert.Equal("documents/fruits.txt\n", t.Run("readlink fr").Out);
        Assert.Equal($"{Home}/documents/fruits.txt\n", t.Run("readlink -f fr").Out);
        Assert.Equal($"{Home}/documents/fruits.txt\n", t.Run("realpath fr").Out);
        // Writing through the link writes to the target.
        t.Run("echo melon >> fr");
        Assert.EndsWith("mango\nmelon\n", t.Run("cat documents/fruits.txt").Out);
        // A link to a directory: cd follows it, pwd remembers the way, pwd -P shows the real place.
        t.Run("ln -s /var/log loggar");
        t.Run("cd loggar");
        Assert.Equal($"{Home}/loggar\n", t.Run("pwd").Out);
        Assert.Equal("/var/log\n", t.Run("pwd -P").Out);
        t.Run("cd ~");
        Assert.Contains("loggar@", t.Run("ls -F").Out);
        // rm removes the link, never the target; rmdir refuses a link.
        Assert.Contains("Not a directory", t.Run("rmdir loggar").Out);
        Assert.Equal(0, t.Run("rm loggar").ExitCode);
        Assert.NotNull(t.Sh.Vfs.TryLookup("/var/log", t.Sh.RootUser()));
        t.Run("rm fr");
        Assert.NotNull(t.Sh.Vfs.TryLookup($"{Home}/documents/fruits.txt", t.Sh.RootUser()));
    }

    [Fact(DisplayName = "en bruten länk: cat säger att filen saknas, ls visar den, find -type l hittar den")]
    public void BrokenLink()
    {
        var t = En();
        t.Run("ln -s missing.txt broken");
        Assert.Contains("No such file or directory", t.Run("cat broken").Out);
        Assert.Contains("broken -> missing.txt", t.Run("ls -l").Out);
        Assert.Equal("./broken\n", t.Run("find . -type l").Out);
        Assert.Equal("broken: broken symbolic link to missing.txt\n", t.Run("file broken").Out);
        Assert.Contains("File exists", t.Run("ln -s notes.txt broken").Out);
        Assert.Equal(0, t.Run("ln -sf notes.txt broken").ExitCode);
        Assert.Equal("notes.txt\n", t.Run("readlink broken").Out);
        // A broken link matches a glob too.
        t.Run("ln -s nothing b2");
        Assert.Contains("b2", t.Run("echo b*").Out);
    }

    [Fact(DisplayName = "ln utan -s: hårda länkar delar inod och innehåll, även efter att terminalen sparats")]
    public void HardLinks()
    {
        var t = En();
        Assert.Equal(0, t.Run("ln notes.txt same.txt").ExitCode);
        var a = t.Run("stat -c '%i %h' notes.txt").Out;
        Assert.Equal(a, t.Run("stat -c '%i %h' same.txt").Out);
        Assert.EndsWith(" 2\n", a);
        Assert.Matches(@"^-rw-r--r-- 2 student", t.Run("ls -l same.txt").Out);
        var inodes = t.Run("ls -i notes.txt same.txt").Out.Split(new[] { ' ', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(inodes[0], inodes[2]);
        t.Run("echo extra >> same.txt");
        Assert.EndsWith("extra\n", t.Run("cat notes.txt").Out);
        // Saved and loaded: still the same file.
        var restored = Shell.RestoreJson(t.Sh.SnapshotJson())!;
        restored.Execute("echo again >> notes.txt");
        Assert.EndsWith("again\n", restored.Execute("cat same.txt").Output);
        // Removing one name leaves the other.
        t.Run("rm notes.txt");
        Assert.EndsWith("extra\n", t.Run("cat same.txt").Out);
        Assert.Equal("1\n", t.Run("stat -c %h same.txt").Out);
        Assert.Contains("hard link not allowed for directory", t.Run("ln documents docs2").Out);
    }

    [Fact(DisplayName = "tar sparar symboliska länkar som länkar")]
    public void TarKeepsLinks()
    {
        var t = En();
        t.RunAll("mkdir box", "ln -s ../notes.txt box/n", "tar -cf box.tar box", "rm -r box", "tar -xf box.tar");
        Assert.Equal("../notes.txt\n", t.Run("readlink box/n").Out);
        Assert.StartsWith("Things to learn", t.Run("cat box/n").Out);
    }

    [Fact(DisplayName = "systemctl enable skapar en symbolisk länk till unit-filen")]
    public void EnableMakesALink()
    {
        var t = En();
        var r = t.Run("ls -l /etc/systemd/system/multi-user.target.wants/");
        Assert.Contains("ssh.service -> /usr/lib/systemd/system/ssh.service", r.Out);
    }

    // ---------- stat, file, umask ----------

    [Fact(DisplayName = "stat och file berättar om filer")]
    public void StatAndFile()
    {
        var t = En();
        var stat = t.Run("stat notes.txt").Out;
        Assert.Contains("  File: notes.txt\n", stat);
        Assert.Contains("regular file", stat);
        Assert.Contains("Access: (0644/-rw-r--r--)  Uid: ( 1000/ student)   Gid: ( 1000/ student)", stat);
        Assert.Equal("644 student notes.txt\n", t.Run("stat -c '%a %U %n' notes.txt").Out);
        Assert.Equal("directory\n", t.Run("stat -c %F documents").Out);
        Assert.Contains("cannot statx 'nope'", t.Run("stat nope").Out);

        Assert.Equal("notes.txt: ASCII text\n", t.Run("file notes.txt").Out);
        Assert.Equal("documents: directory\n", t.Run("file documents").Out);
        Assert.Contains("ELF 64-bit LSB pie executable", t.Run("file /usr/bin/ls").Out);
        Assert.Equal("CSV ASCII text\n", t.Run("file -b documents/grades.csv").Out);
        t.Run("printf '#!/bin/bash\\necho hi\\n' > s.sh && chmod +x s.sh");
        Assert.Equal("Bourne-Again shell script, ASCII text executable\n", t.Run("file -b s.sh").Out);
        t.Run("tar -czf a.tgz documents");
        Assert.Equal("gzip compressed data, from Unix\n", t.Run("file -b a.tgz").Out);
        t.Run("cp notes.txt picture.jpg");
        Assert.Equal("picture.jpg: ASCII text\n", t.Run("file picture.jpg").Out);
    }

    [Fact(DisplayName = "umask bestämmer rättigheterna på nya filer och kataloger")]
    public void Umask()
    {
        var t = En();
        Assert.Equal("0022\n", t.Run("umask").Out);
        Assert.Equal("u=rwx,g=rx,o=rx\n", t.Run("umask -S").Out);
        t.Run("umask 077");
        t.RunAll("touch private.txt", "mkdir privdir");
        Assert.Equal("600\n", t.Run("stat -c %a private.txt").Out);
        Assert.Equal("700\n", t.Run("stat -c %a privdir").Out);
        t.Run("umask u=rwx,g=rx,o=");
        Assert.Equal("0027\n", t.Run("umask").Out);
        Assert.Contains("octal number out of range", t.Run("umask 999").Out);
        // Saved with the terminal.
        Assert.Equal("0027\n", Shell.RestoreJson(t.Sh.SnapshotJson())!.Execute("umask").Output);
    }

    // ---------- xargs, nohup, watch ----------

    [Fact(DisplayName = "xargs gör indata till argument")]
    public void Xargs()
    {
        var t = En();
        Assert.Equal("a b c\n", t.Run("printf 'a\\nb\\nc\\n' | xargs").Out);
        Assert.Equal("Hi a\nHi b\n", t.Run("printf 'a b\\n' | xargs -n 1 echo Hi").Out);
        t.Run("printf 'x1\\nx2\\n' | xargs touch");
        Assert.NotNull(t.Node($"{Home}/x1"));
        Assert.NotNull(t.Node($"{Home}/x2"));
        Assert.Equal("[one] [two words]\n", t.Run("printf 'one\\ntwo words\\n' | xargs -I {} echo [{}] | xargs").Out);
        Assert.Contains("10 documents/fruits.txt", t.Run("find documents -name '*.txt' | xargs wc -l").Out);
        Assert.Equal(127, t.Run("echo x | xargs nosuchcommand").ExitCode);
        Assert.Equal(123, t.Run("echo nope | xargs ls").ExitCode);
        Assert.Equal("\n", t.Run("printf '' | xargs").Out);
        Assert.Equal("", t.Run("printf '' | xargs -r echo hi").Out);
    }

    [Fact(DisplayName = "nohup skriver till nohup.out, watch visar en gång")]
    public void NohupAndWatch()
    {
        var t = En();
        var r = t.Run("nohup echo done");
        Assert.Contains("nohup: ignoring input and appending output to 'nohup.out'", r.Out);
        Assert.Equal("done\n", t.Content($"{Home}/nohup.out"));
        Assert.Equal("done\n", t.Run("nohup echo done | cat").Out);
        var w = t.Run("watch -n 5 echo hi").Out;
        Assert.StartsWith("Every 5.0s: echo hi", w);
        Assert.Contains("\nhi\n", w);
        Assert.Contains("every 5 s", w);
        Assert.Contains("vi is an interactive text editor", t.Run("vi notes.txt").Out);
    }

    // ---------- ~/.ssh/config, scp, rsync ----------

    private static TestShell Connected()
    {
        var t = En();
        t.Run("mkdir -p ~/.ssh && printf 'Host srv\\n    HostName 192.168.1.10\\n    User student\\n' > ~/.ssh/config");
        Assert.True(t.Run("ssh srv true").Pending);
        t.Run("yes");
        return t;
    }

    [Fact(DisplayName = "~/.ssh/config ger servern ett kort namn")]
    public void SshConfig()
    {
        var t = Connected();
        // No key yet: the password line comes first.
        Assert.EndsWith("password: (the simulator skips the password)\nserver\n", t.Run("ssh srv hostname").Out);
        Assert.EndsWith("\nstudent\n", t.Run("ssh srv whoami").Out);
        t.Run("chmod 666 ~/.ssh/config");
        Assert.Contains($"Bad owner or permissions on {Home}/.ssh/config", t.Run("ssh srv true").Out);
        t.Run("chmod 600 ~/.ssh/config && echo 'Hostnam x' >> ~/.ssh/config");
        var bad = t.Run("ssh srv true");
        Assert.Equal(255, bad.ExitCode);
        Assert.Contains("line 4: Bad configuration option: hostnam", bad.Out);
    }

    [Fact(DisplayName = "scp kopierar till och från servern")]
    public void Scp()
    {
        var t = Connected();
        var up = t.Run("scp notes.txt srv:");
        Assert.Equal(0, up.ExitCode);
        Assert.Contains("\nThings to learn", t.Run("ssh srv cat notes.txt").Out);
        Assert.Equal(0, t.Run("scp srv:welcome.txt fromserver.txt").ExitCode);
        Assert.NotNull(t.Node($"{Home}/fromserver.txt"));
        Assert.Contains("is not a regular file", t.Run("scp documents srv:").Out);
        Assert.Equal(0, t.Run("scp -r documents srv:backup").ExitCode);
        Assert.Contains("fruits.txt", t.Run("ssh srv ls backup").Out);
        Assert.Contains("No such file or directory", t.Run("scp srv:nope.txt .").Out);
        Assert.Equal(0, t.Run("scp student@192.168.1.10:notes.txt n2.txt").ExitCode);
    }

    [Fact(DisplayName = "rsync kopierar bara det som ändrats, och snedstrecket sist spelar roll")]
    public void Rsync()
    {
        var t = En();
        var first = t.Run("rsync -av documents/ backup/").Out;
        Assert.StartsWith("sending incremental file list\ncreated directory backup\n./\n", first);
        Assert.Contains("fruits.txt\n", first);
        Assert.NotNull(t.Node($"{Home}/backup/fruits.txt"));
        // Nothing changed: nothing is sent.
        var again = t.Run("rsync -av documents/ backup/").Out;
        Assert.DoesNotContain("fruits.txt", again);
        t.Run("echo lime >> documents/fruits.txt");
        Assert.Contains("\nfruits.txt\n", t.Run("rsync -av documents/ backup/").Out);
        // Without the slash the directory itself is copied.
        t.Run("rsync -a documents backup2");
        Assert.NotNull(t.Node($"{Home}/backup2/documents/fruits.txt"));
        // --delete, tried with -n first.
        t.Run("touch backup/extra.txt");
        var dry = t.Run("rsync -avn --delete documents/ backup/").Out;
        Assert.Contains("deleting extra.txt", dry);
        Assert.Contains("(DRY RUN)", dry);
        Assert.NotNull(t.Node($"{Home}/backup/extra.txt"));
        t.Run("rsync -a --delete documents/ backup/");
        Assert.Null(t.Node($"{Home}/backup/extra.txt"));
        Assert.Contains("skipping directory documents", t.Run("rsync documents backup3").Out);
    }

    [Fact(DisplayName = "rsync till servern över ssh")]
    public void RsyncToServer()
    {
        var t = Connected();
        Assert.Equal(0, t.Run("rsync -a documents/ srv:documents/").ExitCode);
        Assert.Contains("grades.csv", t.Run("ssh srv ls documents").Out);
        Assert.Contains("The source and destination cannot both be remote", t.Run("rsync srv:a srv:b").Out);
    }

    // ---------- cron ----------

    [Fact(DisplayName = "crontab installerar, visar och tar bort jobb – och säger till om fel")]
    public void Crontab()
    {
        var t = En();
        Assert.Equal("no crontab for student\n", t.Run("crontab -l").Out);
        Assert.Equal(0, t.Run("echo '*/5 * * * * date >> ~/cron.log' | crontab -").ExitCode);
        Assert.Equal("*/5 * * * * date >> ~/cron.log\n", t.Run("crontab -l").Out);
        Assert.Equal("*/5 * * * * date >> ~/cron.log\n", t.Sh.Vfs.TryLookup("/var/spool/cron/crontabs/student", t.Sh.RootUser())?.Content);
        var bad = t.Run("echo '61 * * * * date' | crontab -");
        Assert.Equal(1, bad.ExitCode);
        Assert.Equal("\"-\":1: bad minute\nerrors in crontab file, can't install.\n", bad.Out);
        Assert.Contains("bad hour", t.Run("echo '0 24 * * * date' | crontab -").Out);
        Assert.Contains("bad day-of-week", t.Run("echo '0 1 * * funday date' | crontab -").Out);
        Assert.Contains("bad command", t.Run("echo '0 1 * * *' | crontab -").Out);
        t.Run("printf '@daily ~/backup.sh\\n# a comment\\nMAILTO=\"\"\\n30 2 * * 1-5 echo hi\\n' > jobs.txt");
        Assert.Equal(0, t.Run("crontab jobs.txt").ExitCode);
        Assert.Contains("30 2 * * 1-5 echo hi", t.Run("crontab -l").Out);
        Assert.Equal(0, t.Run("(crontab -l; echo '@reboot echo up') | crontab -").ExitCode);
        Assert.Contains("@reboot echo up", t.Run("crontab -l").Out);
        Assert.Contains("crontab -e opens your crontab", t.Run("crontab -e").Out);
        Assert.Contains("must be privileged", t.Run("crontab -u root -l").Out);
        Assert.Equal(0, t.Run("crontab -r").ExitCode);
        Assert.Equal(1, t.Run("crontab -l").ExitCode);
    }

    [Fact(DisplayName = "tidsfälten: */15, intervall, listor, namn och @-genvägar")]
    public void Schedules()
    {
        CronCmd.Job Job(string line) => CronCmd.Parse(line + "\n", "student").Jobs.Single();
        var monday = new DateTime(2026, 11, 2, 2, 30, 0);
        Assert.True(CronCmd.Due(Job("30 2 * * 1-5 x"), monday));
        Assert.False(CronCmd.Due(Job("30 2 * * 0,6 x"), monday));
        Assert.True(CronCmd.Due(Job("*/15 * * * * x"), monday));
        Assert.False(CronCmd.Due(Job("*/7 * * * * x"), monday));
        Assert.True(CronCmd.Due(Job("30 2 * nov mon x"), monday));
        Assert.True(CronCmd.Due(Job("0 0 * * 7 x"), new DateTime(2026, 11, 1, 0, 0, 0)));
        Assert.True(CronCmd.Due(Job("@daily x"), new DateTime(2026, 11, 2, 0, 0, 0)));
        Assert.False(CronCmd.Due(Job("@daily x"), monday));
        Assert.True(CronCmd.Due(Job("@hourly x"), new DateTime(2026, 11, 2, 5, 0, 0)));
        // Day of month and day of week both set: either is enough.
        Assert.True(CronCmd.Due(Job("0 0 15 * 1 x"), new DateTime(2026, 11, 2, 0, 0, 0)));
        Assert.Equal("echo a  b > f", Job("1 2 3 4 5   echo a  b > f").Command);
        Assert.Equal("ls", CronCmd.Parse("1 * * * * root ls\n", "x", withUser: true).Jobs.Single().Command);
    }

    [Fact(DisplayName = "cron kör jobben när minuten är inne, bara medan tjänsten är igång")]
    public void CronRunsJobs()
    {
        long now = new DateTimeOffset(2026, 11, 3, 10, 0, 30, TimeSpan.Zero).ToUnixTimeMilliseconds();
        Js.ClockOverride = () => now;
        try
        {
            var t = En();
            t.Run("echo '* * * * * echo tick >> ~/cron.log' | crontab -");
            t.Run("(crontab -l; echo '* * * * * pwd > where.txt') | crontab -");
            Assert.Null(t.Node($"{Home}/cron.log"));
            now += 60_000;
            t.Run("true");
            Assert.Equal("tick\n", t.Content($"{Home}/cron.log"));
            Assert.Equal($"{Home}\n", t.Content($"{Home}/where.txt"));
            now += 3 * 60_000;
            t.Run("cd /tmp");
            Assert.Equal("tick\ntick\ntick\ntick\n", t.Content($"{Home}/cron.log"));
            // The job did not move the student's shell.
            Assert.Equal("/tmp\n", t.Run("pwd").Out);
            Assert.Contains("(student) CMD (echo tick >> ~/cron.log)", t.Run("journalctl -u cron").Out);
            // Stopped cron runs nothing.
            t.Run("sudo systemctl stop cron");
            now += 5 * 60_000;
            t.Run("true");
            Assert.Equal(4, t.Content($"{Home}/cron.log")!.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length);
            // Output that is not redirected is lost (and logged).
            t.Run("sudo systemctl start cron");
            t.Run("echo '* * * * * echo lost' | crontab -");
            now += 60_000;
            t.Run("true");
            Assert.Contains("No MTA installed, discarding output", t.Run("journalctl -u cron").Out);
        }
        finally
        {
            Js.ClockOverride = null;
        }
    }

    [Fact(DisplayName = "cron på Arch: installera cronie och starta tjänsten")]
    public void CronOnArch()
    {
        var t = En("arch");
        Assert.Equal(127, t.Run("crontab -l").ExitCode);
        t.Run("sudo pacman -S --noconfirm cronie");
        Assert.Equal("no crontab for student\n", t.Run("crontab -l").Out);
        Assert.Contains("disabled", t.Run("systemctl is-enabled cronie").Out);
        Assert.Equal(0, t.Run("sudo systemctl enable --now cronie").ExitCode);
        Assert.Equal("active\n", t.Run("systemctl is-active cronie").Out);
        Assert.Equal(0, t.Run("echo '0 3 * * * echo x' | crontab -").ExitCode);
        Assert.NotNull(t.Sh.Vfs.TryLookup("/var/spool/cron/student", t.Sh.RootUser()));
    }

    [Fact(DisplayName = "systemctl list-timers visar systemd:s schemalagda jobb")]
    public void ListTimers()
    {
        var r = En().Run("systemctl list-timers").Out;
        Assert.StartsWith("NEXT", r);
        Assert.Contains("logrotate.timer", r);
        Assert.Contains("timers listed.", r);
        Assert.Contains("/etc/cron.daily", En().Run("cat /etc/crontab").Out);
        Assert.Contains("logrotate", En().Run("ls /etc/cron.daily").Out);
    }
}
