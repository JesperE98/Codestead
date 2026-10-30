using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/archive.test.ts
public class ArchiveTests
{
    private static TestShell NewShell(string distro = "ubuntu")
    {
        var t = new TestShell(distro);
        // The tests were written for ~/dokument with two files (frukter.txt and server.log).
        t.Sh.Execute("rm ~/dokument/betyg.csv");
        return t;
    }

    // describe('tar')

    [Fact(DisplayName = "innehåll och rättigheter överlever tar -c följt av tar -x")]
    public void TarRoundTrip()
    {
        var t = NewShell();
        t.Run("mkdir -p projekt/hemligt && echo \"echo hej\" > projekt/kör.sh && echo topphemligt > projekt/hemligt/nyckel");
        t.Run("chmod 755 projekt/kör.sh && chmod 600 projekt/hemligt/nyckel && chmod 700 projekt/hemligt");
        Assert.Equal(0, t.Run("tar -cf projekt.tar projekt dokument/frukter.txt").ExitCode);
        t.Run("mkdir ut");
        Assert.Equal(0, t.Run("tar -xf projekt.tar -C ut").ExitCode);

        Assert.Equal("echo hej\n", t.Node("~/ut/projekt/kör.sh")?.Content);
        Assert.Equal("topphemligt\n", t.Node("~/ut/projekt/hemligt/nyckel")?.Content);
        Assert.Equal(t.Node("~/dokument/frukter.txt")?.Content, t.Node("~/ut/dokument/frukter.txt")?.Content);
        Assert.Equal(Js.Oct(755), t.Node("~/ut/projekt/kör.sh")!.Mode & Js.Oct(777));
        Assert.Equal(Js.Oct(600), t.Node("~/ut/projekt/hemligt/nyckel")!.Mode & Js.Oct(777));
        Assert.Equal(Js.Oct(700), t.Node("~/ut/projekt/hemligt")!.Mode & Js.Oct(777));
        Assert.Equal(t.Node("~/projekt/kör.sh")!.Mtime, t.Node("~/ut/projekt/kör.sh")!.Mtime);
        Assert.Equal("hej\n", t.Run("ut/projekt/kör.sh").Out);
    }

    [Fact(DisplayName = "ihopskrivna flaggor, med och utan bindestreck")]
    public void TarBundledFlags()
    {
        var t = NewShell();
        Assert.Equal("dokument/\ndokument/frukter.txt\ndokument/server.log\n", t.Run("tar czvf d.tar.gz dokument").Out);
        Assert.Equal("dokument/\ndokument/frukter.txt\ndokument/server.log\n", t.Run("tar -tzf d.tar.gz").Out);
        Assert.Equal(0, t.Run("tar -c -z -f d2.tgz dokument anteckningar.txt").ExitCode);
        Assert.Contains("anteckningar.txt\n", t.Run("tar --list --file=d2.tgz").Out);
        t.Run("rm -r dokument");
        Assert.Equal(0, t.Run("tar -xzf d.tar.gz").ExitCode);
        Assert.Contains("Servern startar", t.Node("~/dokument/server.log")?.Content);
    }

    [Fact(DisplayName = "tar -tv visar rättigheter, ägare och storlek som ls -l")]
    public void TarVerboseList()
    {
        var t = NewShell();
        t.Run("tar -cf d.tar dokument");
        var lines = t.Run("tar -tvf d.tar").Out.Split('\n');
        Assert.Matches(@"^drwxr-xr-x elev/elev {9}0 [0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9] dokument/\z", lines[0]);
        Assert.Matches(@"^-rw-r--r-- elev/elev {8}64 .* dokument/frukter\.txt\z", lines[1]);
    }

    [Fact(DisplayName = "gzip-komprimerade arkiv är mindre och ser binära ut")]
    public void TarGzSmallerAndBinary()
    {
        var t = NewShell();
        t.Run("tar -cf d.tar dokument && tar -czf d.tar.gz dokument");
        Assert.Equal(10240, VfsLib.NodeSize(t.Node("~/d.tar")!));
        Assert.True(VfsLib.NodeSize(t.Node("~/d.tar.gz")!) < 1000);
        Assert.Contains(" 10240 ", t.Run("ls -l d.tar").Out);
        Assert.Equal("12K\td.tar\n4.0K\td.tar.gz\n", t.Run("du -h d.tar d.tar.gz").Out);
        var cat = t.Run("cat d.tar.gz").Out;
        Assert.DoesNotContain("Servern startar", cat);
        Assert.DoesNotContain("frukter", cat);
        Assert.Equal("tar.gz", ArchiveCmd.ReadArchive(t.Node("~/d.tar.gz")!.Content!)?.Format);
    }

    [Fact(DisplayName = "felmeddelanden som i GNU tar")]
    public void TarErrors()
    {
        var t = NewShell();
        Assert.Equal(
            "tar: Cowardly refusing to create an empty archive\nTry 'tar --help' or 'tar --usage' for more information.\n",
            t.Run("tar -cf x.tar").Out);
        Assert.Equal(
            "tar: finnsinte.tar: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now\n",
            t.Run("tar -xf finnsinte.tar").Out);
        var missing = t.Run("tar -cf x.tar dokument finnsinte");
        Assert.Equal("tar: finnsinte: Cannot stat: No such file or directory\ntar: Exiting with failure status due to previous errors\n", missing.Out);
        Assert.Equal(2, missing.ExitCode);
        t.Run("tar -cf okomprimerad.tar dokument");
        Assert.Contains("gzip: stdin: not in gzip format", t.Run("tar -xzf okomprimerad.tar").Out);
        Assert.Contains("This does not look like a tar archive", t.Run("tar -tf anteckningar.txt").Out);
        Assert.Contains("You must specify one of the '-Acdtrux'", t.Run("tar -f x.tar").Out);
        Assert.Contains("Refusing to write archive contents to terminal", t.Run("tar -c dokument").Out);
        Assert.Contains("/etc/x.tgz: Cannot open: Permission denied", t.Run("tar -czf /etc/x.tgz dokument").Out);
        Assert.Contains("finnsinte: Cannot chdir: No such file or directory", t.Run("tar -xf okomprimerad.tar -C finnsinte").Out);
    }

    [Fact(DisplayName = "absoluta sökvägar görs relativa")]
    public void TarAbsolutePaths()
    {
        var t = NewShell();
        Assert.Equal("tar: Removing leading `/' from member names\n", t.Run("tar -cf abs.tar ~/dokument").Out);
        Assert.Contains("home/elev/dokument/frukter.txt\n", t.Run("tar -tf abs.tar").Out);
    }

    [Fact(DisplayName = "tar genom pipes och utvalda filer")]
    public void TarPipesAndSelection()
    {
        var t = NewShell();
        t.Run("mkdir kopia");
        Assert.Equal("dokument/\ndokument/frukter.txt\ndokument/server.log\n", t.Run("tar -cf - dokument | tar -xvf - -C kopia").Out);
        Assert.NotNull(t.Node("~/kopia/dokument/frukter.txt"));
        t.Run("tar -cf d.tar dokument");
        t.Run("mkdir bara");
        t.Run("tar -xf d.tar -C bara dokument/server.log");
        Assert.NotNull(t.Node("~/bara/dokument/server.log"));
        Assert.Null(t.Node("~/bara/dokument/frukter.txt"));
        Assert.Contains("tar: saknas: Not found in archive", t.Run("tar -tf d.tar saknas").Out);
    }

    [Fact(DisplayName = "root behåller ägaren, vanliga användare blir ägare själva")]
    public void TarOwnership()
    {
        var t = NewShell();
        t.Run("sudo tar -cf /tmp/etc.tar /etc/hostname");
        t.Run("mkdir som-elev");
        t.Run("tar -xf /tmp/etc.tar -C som-elev");
        Assert.Equal("elev", t.Node("~/som-elev/etc/hostname")?.Owner);
        t.Run("sudo mkdir /tmp/som-root");
        t.Run("sudo tar -xf /tmp/etc.tar -C /tmp/som-root");
        Assert.Equal("root", t.Node("/tmp/som-root/etc/hostname")?.Owner);
    }

    [Fact(DisplayName = "filer som inte går att läsa hoppas över")]
    public void TarUnreadableFiles()
    {
        var t = NewShell();
        var r = t.Run("tar -cf shadow.tar /etc/shadow");
        Assert.Contains("tar: etc/shadow: Cannot open: Permission denied", r.Out);
        Assert.Equal(2, r.ExitCode);
    }

    // describe('gzip')

    [Fact(DisplayName = "gzip ersätter filen, gunzip återställer den")]
    public void GzipAndGunzip()
    {
        var t = NewShell();
        var original = t.Node("~/dokument/server.log")!.Content;
        t.Run("chmod 640 dokument/server.log");
        Assert.Matches(@"^dokument/server\.log:\t +[0-9]+\.[0-9]% -- replaced with dokument/server\.log\.gz\n\z", t.Run("gzip -v dokument/server.log").Out);
        Assert.Null(t.Node("~/dokument/server.log"));
        var gz = t.Node("~/dokument/server.log.gz")!;
        Assert.True(VfsLib.NodeSize(gz) < original!.Length);
        Assert.Equal(Js.Oct(640), gz.Mode & Js.Oct(777));
        Assert.Equal(original, t.Run("zcat dokument/server.log.gz").Out);
        Assert.Matches(@"compressed\s+uncompressed\s+ratio uncompressed_name\n\s+[0-9]+\s+848\s+[0-9]+\.[0-9]% dokument/server\.log\n", t.Run("gzip -l dokument/server.log.gz").Out);
        t.Run("gunzip dokument/server.log.gz");
        Assert.Equal(original, t.Node("~/dokument/server.log")?.Content);
        Assert.Null(t.Node("~/dokument/server.log.gz"));
        Assert.Equal(Js.Oct(640), t.Node("~/dokument/server.log")!.Mode & Js.Oct(777));
    }

    [Fact(DisplayName = "-k behåller originalet, små filer blir större")]
    public void GzipKeep()
    {
        var t = NewShell();
        t.Run("gzip -k dokument/frukter.txt");
        Assert.NotNull(t.Node("~/dokument/frukter.txt"));
        Assert.True(VfsLib.NodeSize(t.Node("~/dokument/frukter.txt.gz")!) > VfsLib.NodeSize(t.Node("~/dokument/frukter.txt")!));
        Assert.Equal("gzip: dokument/frukter.txt.gz already exists; not overwritten\n", t.Run("gzip dokument/frukter.txt").Out);
        Assert.Equal(0, t.Run("gzip -f dokument/frukter.txt").ExitCode);
    }

    [Fact(DisplayName = "felfall")]
    public void GzipErrors()
    {
        var t = NewShell();
        Assert.Equal("gzip: finnsinte: No such file or directory\n", t.Run("gzip finnsinte").Out);
        Assert.Equal("gzip: dokument is a directory -- ignored\n", t.Run("gzip dokument").Out);
        Assert.Equal("gzip: anteckningar.txt: unknown suffix -- ignored\n", t.Run("gunzip anteckningar.txt").Out);
        t.Run("cp anteckningar.txt falsk.gz");
        Assert.Equal("gzip: falsk.gz: not in gzip format\n", t.Run("gunzip falsk.gz").Out);
        Assert.Contains("compressed data not written to a terminal", t.Run("gzip").Out);
        t.Run("gzip anteckningar.txt");
        Assert.Equal("gzip: anteckningar.txt.gz already has .gz suffix -- unchanged\n", t.Run("gzip anteckningar.txt.gz").Out);
    }

    [Fact(DisplayName = "gzip och gunzip i pipes")]
    public void GzipPipes()
    {
        var t = NewShell();
        Assert.Equal("hej\n", t.Run("echo hej | gzip | gunzip").Out);
        Assert.Equal("apelsin\n", t.Run("gzip -c dokument/frukter.txt > f.gz && zcat f.gz | sort | head -1").Out);
        t.Run("tar -cf - dokument | gzip > pipe.tar.gz");
        Assert.Contains("dokument/server.log\n", t.Run("tar -tzf pipe.tar.gz").Out);
    }

    [Fact(DisplayName = "gunzip på en .tar.gz ger en .tar")]
    public void GunzipTgz()
    {
        var t = NewShell();
        t.Run("tar -czf d.tgz dokument");
        t.Run("gunzip d.tgz");
        Assert.NotNull(t.Node("~/d.tar"));
        Assert.Equal(10240, VfsLib.NodeSize(t.Node("~/d.tar")!));
        Assert.Contains("dokument/frukter.txt", t.Run("tar -tf d.tar").Out);
    }

    // describe('zip och unzip')

    [Fact(DisplayName = "måste installeras med pakethanteraren")]
    public void ZipMustBeInstalled()
    {
        var t = NewShell();
        Assert.Equal(127, t.Run("zip -r d.zip dokument").ExitCode);
        Assert.Equal(127, t.Run("unzip d.zip").ExitCode);
        Assert.Equal(0, t.Run("tar --help").ExitCode);
        Assert.Equal(0, t.Run("which tar gzip gunzip zcat du").ExitCode);
    }

    [Theory(DisplayName = "zip -r och unzip -d i %s")]
    [InlineData("debian")]
    [InlineData("arch")]
    [InlineData("fedora")]
    public void ZipAndUnzip(string distro)
    {
        var t = NewShell(distro);
        var install = distro switch
        {
            "debian" => new[] { "sudo apt update", "sudo apt install zip unzip" },
            "arch" => new[] { "sudo pacman -S --noconfirm zip unzip" },
            _ => new[] { "sudo dnf install -y zip unzip" },
        };
        foreach (var line in install) t.Run(line);
        Assert.Equal("  adding: dokument/ (stored 0%)\n", t.Run("zip d.zip dokument").Out);
        Assert.Matches(
            @"^ {2}updating: dokument/ \(stored 0%\)\n {2}adding: dokument/frukter\.txt \((deflated [0-9]+%|stored 0%)\)\n {2}adding: dokument/server\.log \(deflated [0-9]+%\)\n\z",
            t.Run("zip -r d.zip dokument").Out);
        Assert.Contains("      848  ", t.Run("unzip -l d.zip").Out);
        var r = t.Run("unzip d.zip -d ut");
        Assert.Contains("Archive:  d.zip\n   creating: ut/dokument/\n", r.Out);
        Assert.Contains("  inflating: ut/dokument/server.log\n", r.Out);
        Assert.Equal(t.Node("~/dokument/server.log")?.Content, t.Node("~/ut/dokument/server.log")?.Content);
        Assert.Contains("skipping: ut/dokument/server.log", t.Run("unzip d.zip -d ut").Out);
        Assert.Contains("inflating: ut/dokument/server.log", t.Run("unzip -o d.zip -d ut").Out);
        Assert.Equal("unzip:  cannot find or open finnsinte.zip, finnsinte.zip.zip or finnsinte.zip.ZIP.\n", t.Run("unzip finnsinte.zip").Out);
        Assert.Equal(12, t.Run("zip tom.zip finnsinte").ExitCode);
    }

    // describe('du')

    [Fact(DisplayName = "-s, -h och -a")]
    public void Du()
    {
        var t = NewShell();
        Assert.Equal("12K\tdokument\n", t.Run("du -sh dokument").Out);
        Assert.Equal("12\tdokument\n", t.Run("du -s dokument").Out);
        Assert.Equal("4\tdokument/frukter.txt\n4\tdokument/server.log\n12\tdokument\n", t.Run("du -a dokument").Out);
        Assert.Equal($"{4096 + 64 + 848}\tdokument\n", t.Run("du -sb dokument").Out);
        Assert.Equal("du: cannot access 'finnsinte': No such file or directory\n", t.Run("du finnsinte").Out);
    }

    // describe('spara och återställa med arkiv')

    [Fact(DisplayName = "snapshot (JSON) fungerar med arkiv i filsystemet")]
    public void SnapshotWithArchives()
    {
        var t = NewShell("fedora");
        var sh = t.Sh;
        t.Run("tar -czf d.tar.gz dokument");
        t.Run("gzip -k anteckningar.txt");
        var json = sh.SnapshotJson();
        var restored = Shell.RestoreJson(json)!;
        string Out(string line) => UtilCmd.StripAnsi(restored.Execute(line).Output);
        Assert.Matches(@" [0-9]{3} .* d\.tar\.gz\n\z", Out("ls -l d.tar.gz"));
        Assert.Equal("dokument/\ndokument/frukter.txt\ndokument/server.log\n", Out("tar -tzf d.tar.gz"));
        Out("mkdir ut && tar -xzf d.tar.gz -C ut");
        var user = restored.RootUser();
        Assert.Equal(
            sh.Vfs.ReadFile("/home/elev/dokument/server.log", user),
            restored.Vfs.ReadFile("/home/elev/ut/dokument/server.log", user));
        Assert.Equal(sh.Vfs.ReadFile("/home/elev/anteckningar.txt", user), Out("zcat anteckningar.txt.gz"));
    }
}
