namespace Codestead.Shell.Tests;

// Tests for the base modules initfs/packages/extrarepo (they have no TypeScript tests of their own).
public class BaseTests
{
    public static readonly TheoryData<string> Distros = new() { "ubuntu", "debian", "arch", "fedora" };

    [Theory(DisplayName = "coreutils installeras i /usr/bin")]
    [MemberData(nameof(Distros))]
    public void CoreutilsInstalled(string distro)
    {
        var sh = Shell.Create(distro, "sv");
        var root = sh.RootUser();
        var coreutils = PackagesLib.FindPackage(sh.Distro.Family, "coreutils")!;
        Assert.True(PackagesLib.IsInstalled(sh, coreutils));
        foreach (var cmd in coreutils.Provides)
        {
            var node = sh.Vfs.TryLookup($"/usr/bin/{cmd}", root);
            Assert.NotNull(node);
            Assert.Equal("file", node!.Type);
            Assert.StartsWith(VfsLib.Elf, node.Content);
            Assert.Equal(Js.Oct(755), node.Mode);
        }
        Assert.Equal(Js.Oct(4755), sh.Vfs.Lookup("/usr/bin/sudo", root).Mode);
        Assert.Equal(30_000 + (2 * 7919 % 150_000), sh.Vfs.Lookup("/usr/bin/ls", root).Size);
    }

    [Theory(DisplayName = "övningsfilerna finns i hemkatalogen")]
    [MemberData(nameof(Distros))]
    public void ExerciseFiles(string distro)
    {
        var sh = Shell.Create(distro, "sv");
        var root = sh.RootUser();
        var fruits = sh.Vfs.Lookup("/home/elev/dokument/frukter.txt", root);
        Assert.Equal("äpple\nbanan\nkiwi\näpple\napelsin\nbanan\npäron\nkiwi\näpple\nmango\n", fruits.Content);
        Assert.Equal("elev", fruits.Owner);
        Assert.Equal("elev", fruits.Group);
        Assert.Equal(Js.Oct(644), fruits.Mode);
        Assert.Equal(Js.Oct(750), sh.Vfs.Lookup("/home/elev", root).Mode);
        Assert.StartsWith("namn,ämne,poäng\nAlva,matte,87\n", sh.Vfs.Lookup("/home/elev/dokument/betyg.csv", root).Content);
        Assert.Equal("gammal logg\n", sh.Vfs.Lookup("/home/elev/gammalt/arkiv/logg-2019.txt", root).Content);
        Assert.NotNull(sh.Vfs.TryLookup("/home/elev/projekt-webb/index.html", root));
        Assert.NotNull(sh.Vfs.TryLookup("/home/elev/Nedladdningar/Kalkylator.AppImage", root));
        Assert.Equal(Js.Oct(1777), sh.Vfs.Lookup("/tmp", root).Mode);
        Assert.Equal(Js.Oct(440), sh.Vfs.Lookup("/etc/sudoers", root).Mode);
    }

    [Fact(DisplayName = "användare, grupper och shadow per familj")]
    public void UsersAndGroups()
    {
        var ubuntu = Shell.Create("ubuntu", "sv");
        var root = ubuntu.RootUser();
        Assert.EndsWith("elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash\n", ubuntu.Vfs.ReadFile("/etc/passwd", root));
        Assert.Contains("\nsudo:x:27:elev\n", ubuntu.Vfs.ReadFile("/etc/group", root));
        var shadow = ubuntu.Vfs.Lookup("/etc/shadow", root);
        Assert.Equal(Js.Oct(640), shadow.Mode);
        Assert.Equal("shadow", shadow.Group);
        Assert.StartsWith("root:*:20000:0:99999:7:::\n", shadow.Content);
        Assert.EndsWith("elev:$y$j9T$Qm1x...simulated...hash:20000:0:99999:7:::\n", shadow.Content);
        Assert.Contains("ubuntu.sources", ubuntu.Vfs.ListDir("/etc/apt/sources.list.d", root));

        var arch = Shell.Create("arch", "sv");
        Assert.Contains("\nwheel:x:998:elev\n", arch.Vfs.ReadFile("/etc/group", root));
        Assert.Equal(Js.Oct(600), arch.Vfs.Lookup("/etc/shadow", root).Mode);
        Assert.NotNull(arch.Vfs.TryLookup("/etc/pacman.d/mirrorlist", root));
        Assert.NotNull(arch.Vfs.TryLookup("/var/log/pacman.log", root));

        var fedora = Shell.Create("fedora", "sv");
        Assert.Equal(0, fedora.Vfs.Lookup("/etc/shadow", root).Mode);
        Assert.EndsWith("ENCRYPT_METHOD YESCRYPT\nCREATE_HOME\tyes\n", fedora.Vfs.ReadFile("/etc/login.defs", root));
        Assert.NotNull(fedora.Vfs.TryLookup("/etc/yum.repos.d/fedora.repo", root));
    }

    [Fact(DisplayName = "paketnamn skiljer sig mellan familjerna")]
    public void PackageNamesPerFamily()
    {
        var awk = PackagesLib.Packages.Single(p => p.Id == "awk");
        Assert.Equal("mawk", PackagesLib.PackageName(awk, "debian"));
        Assert.Equal("gawk", PackagesLib.PackageName(awk, "arch"));
        Assert.Equal("gawk", PackagesLib.PackageName(awk, "redhat"));

        Assert.Equal("shadow", PackagesLib.FindPackage("debian", "passwd")?.Id);
        Assert.Equal("shadow", PackagesLib.FindPackage("arch", "shadow")?.Id);
        Assert.Equal("shadow", PackagesLib.FindPackage("redhat", "shadow-utils")?.Id);
        Assert.Equal("vim", PackagesLib.FindPackage("redhat", "vim-enhanced")?.Id);
        Assert.Null(PackagesLib.FindPackage("redhat", "vim"));
        Assert.Equal("openssh", PackagesLib.FindPackage("debian", "openssh-client")?.Id);
        Assert.Equal("openssh", PackagesLib.FindPackage("redhat", "openssh-clients")?.Id);

        Assert.Null(PackagesLib.FindPackage("arch", "adduser"));
        Assert.Null(PackagesLib.PackageProviding("redhat", "adduser"));
        Assert.Equal("adduser", PackagesLib.PackageProviding("debian", "adduser")?.Id);
        Assert.Equal("dnsutils", PackagesLib.PackageProviding("arch", "dig")?.Id);
        Assert.Equal("bind", PackagesLib.PackageName(PackagesLib.PackageProviding("arch", "dig")!, "arch"));
        // yay only exists in AUR – no hint for it.
        Assert.Null(PackagesLib.PackageProviding("arch", "yay"));
        Assert.True(PackagesLib.IsForeign("arch", PackagesLib.Packages.Single(p => p.Id == "yay")));
        Assert.Equal(54, PackagesLib.Packages.Count);
    }

    [Fact(DisplayName = "förinstallerade paket per distribution")]
    public void PreinstalledPackages()
    {
        static bool Has(Shell sh, string cmd) => sh.Vfs.TryLookup($"/usr/bin/{cmd}", sh.RootUser()) is not null;
        var ubuntu = Shell.Create("ubuntu", "sv");
        var debian = Shell.Create("debian", "sv");
        var arch = Shell.Create("arch", "sv");
        var fedora = Shell.Create("fedora", "sv");
        Assert.True(Has(ubuntu, "apt") && Has(ubuntu, "adduser") && Has(ubuntu, "wget") && Has(ubuntu, "snap"));
        Assert.False(Has(debian, "snap"));
        Assert.True(Has(arch, "pacman") && Has(arch, "curl"));
        Assert.False(Has(arch, "nano") || Has(arch, "ssh") || Has(arch, "apt"));
        Assert.True(Has(fedora, "dnf") && Has(fedora, "python3") && Has(fedora, "flatpak"));
        Assert.False(Has(fedora, "vim"));
        Assert.Equal("9.4-3ubuntu6", ubuntu.Installed["coreutils"]);
        Assert.Equal("9.4-3+deb13u6", debian.Installed["coreutils"]);
        Assert.Equal("9.7-6.fc43", fedora.Installed["coreutils"]);
    }

    [Fact(DisplayName = "installera och ta bort paket med skal")]
    public void InstallAndRemoveShellPackage()
    {
        var sh = Shell.Create("fedora", "sv");
        var root = sh.RootUser();
        var zsh = PackagesLib.FindPackage("redhat", "zsh", sh)!;
        Assert.DoesNotContain(zsh, PackagesLib.Upgradable(sh));
        PackagesLib.InstallPackage(sh, zsh);
        Assert.Equal("5.9-18.fc43", sh.Installed["zsh"]);
        Assert.NotNull(sh.Vfs.TryLookup("/usr/bin/zsh", root));
        Assert.Equal("/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/zsh\n", sh.Vfs.ReadFile("/etc/shells", root));
        PackagesLib.RemovePackage(sh, zsh);
        Assert.False(sh.Installed.ContainsKey("zsh"));
        Assert.Null(sh.Vfs.TryLookup("/usr/bin/zsh", root));
        Assert.Equal("/bin/sh\n/bin/bash\n/usr/bin/bash\n", sh.Vfs.ReadFile("/etc/shells", root));

        // After `dnf check-update` the new version is available.
        sh.Flags["repoSynced"] = true;
        Assert.Contains(PackagesLib.Packages.Single(p => p.Id == "coreutils"), PackagesLib.Upgradable(sh));
        Assert.DoesNotContain(PackagesLib.Packages.Single(p => p.Id == "grep"), PackagesLib.Upgradable(sh));
    }

    [Fact(DisplayName = "sökning och storlekar")]
    public void SearchAndSizes()
    {
        var hits = PackagesLib.SearchPackages("debian", "SHELL").Select(p => p.Names["debian"]).ToList();
        Assert.Equal(new[] { "bash", "debianutils", "fish", "openssh-client", "zsh" }, hits);
        Assert.Equal("17.4 MB", PackagesLib.FormatKb(17_400));
        Assert.Equal("1 MB", PackagesLib.FormatKb(1_000));
        Assert.Equal("640 kB", PackagesLib.FormatKb(640));
        Assert.Equal("16.99 MiB", PackagesLib.FormatMiB(17_400));
    }

    [Fact(DisplayName = "PPA och COPR")]
    public void ExtraRepos()
    {
        var ppa = ExtrarepoLib.ParsePpa("ppa:LunaTool")!;
        Assert.Equal("lunatool", ppa.User);
        Assert.Equal("ppa", ppa.Name);
        Assert.Null(ExtrarepoLib.ParsePpa("ppa:/x"));
        ppa = ExtrarepoLib.ParsePpa("ppa:lunatool/moonphase")!;
        Assert.Equal("https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu/", ExtrarepoLib.PpaUri(ppa));
        Assert.Equal("/etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources", ExtrarepoLib.PpaSourcesPath(ppa));

        var copr = ExtrarepoLib.ParseCopr("copr:@grp/proj")!;
        Assert.Equal("@grp", copr.Owner);
        Assert.Equal("copr:copr.fedorainfracloud.org:group_grp:proj", ExtrarepoLib.CoprId(copr));
        Assert.Equal("lunatool", ExtrarepoLib.ParseCopr("copr.fedorainfracloud.org/lunatool/moonphase")?.Owner);
        Assert.Null(ExtrarepoLib.ParseCopr("bara-ett-ord"));

        // The PPA package shows up when the PPA has been added and apt update has run.
        var sh = Shell.Create("ubuntu", "sv");
        var root = sh.RootUser();
        Assert.Null(PackagesLib.FindPackage("debian", "moonphase", sh));
        Assert.Null(PackagesLib.FindPackage("debian", "moonphase"));
        ExtrarepoLib.EnsureDir(sh, "/var/lib/apt/lists");
        sh.Vfs.WriteFile(ExtrarepoLib.PpaSourcesPath(ppa), "Types: deb\n", root);
        Assert.False(ExtrarepoLib.ExtraRepoEnabled(sh, "ppa:lunatool/moonphase"));
        sh.Vfs.WriteFile(ExtrarepoLib.PpaListPath(ppa), "", root);
        Assert.True(ExtrarepoLib.ExtraRepoEnabled(sh, "ppa:lunatool/moonphase"));
        Assert.Equal("moonphase", PackagesLib.FindPackage("debian", "moonphase", sh)?.Id);

        // COPR: enabled once the .repo file says enabled=1.
        var fedora = Shell.Create("fedora", "sv");
        var c = ExtrarepoLib.ParseCopr("lunatool/moonphase")!;
        Assert.Null(PackagesLib.FindPackage("redhat", "moonphase", fedora));
        fedora.Vfs.WriteFile(ExtrarepoLib.CoprRepoPath(c), "[x]\nname=x\nenabled=0\n", root);
        Assert.False(ExtrarepoLib.CoprEnabled(fedora, c));
        fedora.Vfs.WriteFile(ExtrarepoLib.CoprRepoPath(c), "[x]\nname=x\nEnabled = True\n", root);
        Assert.True(ExtrarepoLib.CoprEnabled(fedora, c));
        Assert.Equal("moonphase", PackagesLib.FindPackage("redhat", "moonphase", fedora)?.Id);

        // AUR packages are never in the repositories.
        var arch = Shell.Create("arch", "sv");
        Assert.Null(PackagesLib.FindPackage("arch", "moonphase", arch));
        Assert.False(ExtrarepoLib.ExtraRepoEnabled(arch, "aur"));
    }
}
