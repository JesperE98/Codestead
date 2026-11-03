using System.Text.RegularExpressions;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/repos.test.ts
public class ReposTests
{
    private const string PpaFile = "/etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources";
    private const string CoprFile = "/etc/yum.repos.d/_copr:copr.fedorainfracloud.org:lunatool:moonphase.repo";

    // ---------------------------------------------------------------- PPA (Ubuntu/Debian)

    [Fact(DisplayName = "add-apt-repository finns i Ubuntu men inte i Debian")]
    public void AddAptRepositoryInUbuntuNotDebian()
    {
        Assert.Equal(0, new TestShell("ubuntu").Run("which add-apt-repository").ExitCode);
        var t = new TestShell("debian");
        Assert.Equal(127, t.Run("add-apt-repository ppa:lunatool/moonphase").ExitCode);
        t.Run("sudo apt update");
        t.Run("sudo apt install software-properties-common");
        Assert.Equal(0, t.Run("which add-apt-repository").ExitCode);
    }

    [Fact(DisplayName = "kräver root, och okända PPA:er finns inte")]
    public void NeedsRootAndUnknownPpas()
    {
        var t = new TestShell("ubuntu");
        Assert.Contains("must run as root", t.Run("add-apt-repository ppa:lunatool/moonphase").Out);
        var r = t.Run("sudo add-apt-repository -y ppa:nobody/nothing");
        Assert.Equal(1, r.ExitCode);
        Assert.Contains("ppa 'nobody/nothing' not found", r.Out);
    }

    [Fact(DisplayName = "paketet syns först när PPA:t lagts till, och apt update körs automatiskt")]
    public void PackageVisibleAfterPpaAdded()
    {
        var t = new TestShell("ubuntu");
        var sh = t.Sh;
        t.Run("sudo apt update");
        Assert.Contains("Unable to locate package moonphase", t.Run("sudo apt install moonphase").Out);
        Assert.DoesNotContain("moonphase/", t.Run("apt search moonphase").Out);

        var add = t.Run("sudo add-apt-repository ppa:lunatool/moonphase");
        Assert.True(add.Pending);
        Assert.Contains("URIs: https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu/", add.Out);
        var enter = t.Run("");
        Assert.Matches(@"Get:\d+ https://ppa\.launchpadcontent\.net/lunatool/moonphase/ubuntu noble InRelease", enter.Out);
        Assert.Contains("Suites: noble", sh.Vfs.TryLookup(PpaFile, sh.RootUser())?.Content);

        var inst = t.Run("sudo apt install moonphase");
        Assert.Equal(0, inst.ExitCode);
        Assert.Contains("https://ppa.launchpadcontent.net/lunatool/moonphase/ubuntu noble/main amd64 moonphase", inst.Out);
        Assert.Matches("illuminated", t.Run("moonphase").Out);
        Assert.Matches(@"\*\*\* 1\.4\.2-1~ppa1~noble1 500\n\s+500 https://ppa\.launchpadcontent\.net", t.Run("apt policy moonphase").Out);
    }

    [Fact(DisplayName = "en källa som läggs till för hand syns först efter apt update")]
    public void ManualSourceNeedsAptUpdate()
    {
        var t = new TestShell("ubuntu");
        var sh = t.Sh;
        t.Run("sudo apt update");
        t.Run("sudo add-apt-repository -y -n ppa:lunatool/moonphase");
        Assert.NotNull(sh.Vfs.TryLookup(PpaFile, sh.RootUser()));
        Assert.Equal(100, t.Run("sudo apt install moonphase").ExitCode);
        Assert.Contains("ppa.launchpadcontent.net", t.Run("sudo apt update").Out);
        Assert.Equal(0, t.Run("sudo apt install moonphase").ExitCode);
    }

    [Fact(DisplayName = "--remove tar bort källan; paketet blir kvar men kan inte installeras igen")]
    public void RemoveDropsSource()
    {
        var t = new TestShell("ubuntu");
        var sh = t.Sh;
        t.Run("sudo add-apt-repository -y ppa:lunatool/moonphase");
        t.Run("sudo apt install moonphase");
        Assert.Equal(0, t.Run("sudo add-apt-repository -y --remove ppa:lunatool/moonphase").ExitCode);
        Assert.Null(sh.Vfs.TryLookup(PpaFile, sh.RootUser()));
        Assert.True(sh.Installed.ContainsKey("moonphase"));
        Assert.Matches(@"\*\*\* .* 100\n\s+100 /var/lib/dpkg/status", t.Run("apt policy moonphase").Out);
        t.Run("sudo apt remove -y moonphase");
        Assert.Equal(100, t.Run("sudo apt install moonphase").ExitCode);
    }

    [Fact(DisplayName = "i Debian varnar simulatorn för PPA:er")]
    public void DebianWarnsAboutPpas()
    {
        var t = new TestShell("debian");
        t.Run("sudo apt update");
        t.Run("sudo apt install software-properties-common");
        var r = t.Run("sudo add-apt-repository -y ppa:lunatool/moonphase");
        Assert.Contains("Debian 13", r.Out);
        Assert.Equal(0, t.Run("sudo apt install moonphase").ExitCode);
    }

    // ---------------------------------------------------------------- COPR (Fedora)

    [Fact(DisplayName = "dnf hittar inte paketet förrän förrådet aktiverats")]
    public void DnfNeedsEnabledCopr()
    {
        var t = new TestShell("fedora");
        Assert.Contains("No match for argument: moonphase", t.Run("sudo dnf install -y moonphase").Out);
        Assert.Contains("superuser privileges", t.Run("dnf copr enable lunatool/moonphase").Out);
    }

    [Fact(DisplayName = "enable frågar med Nej som standard och skapar en .repo-fil")]
    public void EnableAsksDefaultNo()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        Assert.True(t.Run("sudo dnf copr enable lunatool/moonphase").Pending);
        Assert.Contains("Operation aborted", t.Run("").Out);
        Assert.Null(sh.Vfs.TryLookup(CoprFile, sh.RootUser()));

        t.Run("sudo dnf copr enable lunatool/moonphase");
        t.Run("y");
        Assert.Contains("enabled=1", sh.Vfs.TryLookup(CoprFile, sh.RootUser())?.Content);
        Assert.Equal("copr.fedorainfracloud.org/lunatool/moonphase\n", t.Run("dnf copr list").Out);
        Assert.Contains("copr:copr.fedorainfracloud.org:lunatool:moonphase", t.Run("dnf repolist").Out);

        var inst = t.Run("sudo dnf install -y moonphase");
        Assert.Contains("copr:copr.fedorainfracloud.org:lunatool:moonphase", inst.Out);
        Assert.Contains("From repository : copr:copr.fedorainfracloud.org:lunatool:moonphase", t.Run("dnf info moonphase").Out);

        t.Run("sudo dnf copr disable lunatool/moonphase");
        Assert.Contains("(disabled)", t.Run("dnf copr list").Out);
        Assert.DoesNotContain("copr:", t.Run("dnf repolist").Out);
        t.Run("sudo dnf remove -y moonphase");
        Assert.Equal(1, t.Run("sudo dnf install -y moonphase").ExitCode);
        t.Run("sudo dnf copr remove lunatool/moonphase");
        Assert.Equal("", t.Run("dnf copr list").Out);
    }

    [Fact(DisplayName = "okända projekt")]
    public void UnknownProjects()
    {
        var t = new TestShell("fedora");
        Assert.Equal(1, t.Run("sudo dnf copr enable -y someone/nothing").ExitCode);
    }

    // ---------------------------------------------------------------- AUR (Arch)

    private static TestShell Prepared()
    {
        var s = new TestShell("arch");
        s.Run("sudo pacman -S --needed --noconfirm git base-devel");
        s.Run("cd ~");
        return s;
    }

    [Fact(DisplayName = "pacman känner inte till AUR")]
    public void PacmanDoesNotKnowAur()
    {
        var t = new TestShell("arch");
        Assert.Contains("target not found: moonphase", t.Run("sudo pacman -S moonphase").Out);
        Assert.Contains("bara i AUR", t.Run("sudo pacman -S yay").Out);
        Assert.Equal(1, t.Run("pacman -Ss moonphase").ExitCode);
    }

    [Fact(DisplayName = "git clone hämtar PKGBUILD; fel namn ger ett tomt förråd")]
    public void GitCloneFetchesPkgbuild()
    {
        var t = Prepared();
        var sh = t.Sh;
        var r = t.Run("git clone https://aur.archlinux.org/moonphase.git");
        Assert.Equal(0, r.ExitCode);
        Assert.Contains("Cloning into 'moonphase'...", r.Out);
        Assert.Contains("pkgname=moonphase", sh.Vfs.ReadFile("/home/elev/moonphase/PKGBUILD", sh.RootUser()));
        Assert.Equal(128, t.Run("git clone https://aur.archlinux.org/moonphase.git").ExitCode);

        Assert.Contains("cloned an empty repository", t.Run("git clone https://aur.archlinux.org/moonfase.git").Out);
        t.Run("cd moonfase");
        Assert.Contains("PKGBUILD does not exist", t.Run("makepkg -si").Out);
    }

    [Fact(DisplayName = "makepkg vägrar root och behöver base-devel")]
    public void MakepkgRefusesRoot()
    {
        var t = new TestShell("arch");
        t.Run("sudo pacman -S --noconfirm git");
        t.Run("cd ~");
        t.Run("git clone https://aur.archlinux.org/moonphase.git");
        t.Run("cd moonphase");
        var root = t.Run("sudo makepkg -si");
        Assert.Equal(10, root.ExitCode);
        Assert.Contains("Running makepkg as root is not allowed", root.Out);
        Assert.Contains("Cannot find the fakeroot binary", t.Run("makepkg -si").Out);
    }

    [Fact(DisplayName = "makepkg -si bygger, frågar och installerar – paketet blir \"foreign\"")]
    public void MakepkgBuildsAndInstalls()
    {
        var t = Prepared();
        var sh = t.Sh;
        t.Run("git clone https://aur.archlinux.org/moonphase.git");
        t.Run("cd moonphase");
        var build = t.Run("makepkg -si");
        Assert.Contains("==> Finished making: moonphase 1.4.2-1", build.Out);
        Assert.True(build.Pending);
        t.Run("y");
        Assert.Equal("1.4.2-1", sh.Installed.Get("moonphase"));
        Assert.Contains("moonphase-1.4.2-1-x86_64.pkg.tar.zst", t.Run("ls").Out);
        Assert.Equal("moonphase 1.4.2\n", t.Run("moonphase --version").Out);
        Assert.Equal("moonphase 1.4.2-1\n", t.Run("pacman -Qm").Out);
        Assert.DoesNotContain("moonphase", t.Run("pacman -Qn").Out);
        Assert.Contains("A package has already been built", t.Run("makepkg").Out);
        Assert.Equal(0, t.Run("sudo pacman -R --noconfirm moonphase").ExitCode);
        Assert.Equal(1, t.Run("pacman -Qm").ExitCode);
    }

    [Fact(DisplayName = "makepkg -s installerar byggberoenden (go för yay) innan bygget")]
    public void MakepkgInstallsBuildDeps()
    {
        var t = Prepared();
        var sh = t.Sh;
        t.Run("git clone https://aur.archlinux.org/yay.git");
        t.Run("cd yay");
        Assert.Contains("Missing dependencies:\n  -> go>=1.24", t.Run("makepkg -i").Out);
        Assert.Contains("Packages (1) go-", t.Run("makepkg -si").Out);
        var built = t.Run("y");
        Assert.Contains("==> Finished making: yay", built.Out);
        Assert.True(built.Pending);
        t.Run("y");
        Assert.True(sh.Installed.ContainsKey("go") && sh.Installed.ContainsKey("yay"));
    }

    [Fact(DisplayName = "yay söker i AUR och installerar därifrån, men inte som root")]
    public void YaySearchesAndInstalls()
    {
        var t = Prepared();
        var sh = t.Sh;
        t.Run("git clone https://aur.archlinux.org/yay-bin.git");
        t.Run("cd yay-bin");
        t.Run("makepkg -si --noconfirm");
        Assert.Contains("yay v12.5.2", t.Run("yay --version").Out);
        Assert.Contains("aur/snowfall 2.0.1-1", t.Run("yay -Ss snow").Out);
        Assert.Contains("Refusing to install AUR packages as root", t.Run("sudo yay -S snowfall").Out);
        t.Run("yay -S snowfall");
        t.Run("y");
        Assert.True(sh.Installed.ContainsKey("snowfall"));
        Assert.NotNull(sh.Vfs.TryLookup("/home/elev/.cache/yay/snowfall/PKGBUILD", sh.RootUser()));
        Assert.Equal("snowfall 2.0.1-1\nyay-bin 12.5.2-1\n", t.Run("pacman -Qm").Out);
        // Normal packages are installed with pacman.
        t.Run("yay -S --noconfirm tree");
        Assert.True(sh.Installed.ContainsKey("tree"));
    }

    // ---------------------------------------------------------------- Flatpak

    [Fact(DisplayName = "förinstallerat i Fedora med fedora-källan")]
    public void FlatpakPreinstalledInFedora()
    {
        var t = new TestShell("fedora");
        Assert.Equal("Flatpak 1.16.1\n", t.Run("flatpak --version").Out);
        Assert.Contains("fedora", t.Run("flatpak remotes").Out);
        Assert.Equal(127, new TestShell("ubuntu").Run("flatpak --version").ExitCode);
    }

    [Fact(DisplayName = "Flathub, installation, körning och avinstallation")]
    public void FlathubInstallRunUninstall()
    {
        var t = new TestShell("arch");
        var sh = t.Sh;
        t.Run("sudo pacman -S --noconfirm flatpak");
        var noRemote = t.Run("flatpak install flathub org.gimp.GIMP");
        Assert.Equal(1, noRemote.ExitCode);
        Assert.Contains("No remote refs found", noRemote.Out);

        const string add = "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo";
        Assert.Equal(0, t.Run(add).ExitCode);
        Assert.Equal(0, t.Run(add).ExitCode);
        Assert.Contains("Remote flathub already exists", t.Run(add.Replace("--if-not-exists ", "")).Out);

        Assert.Contains("org.gimp.GIMP", t.Run("flatpak search gimp").Out);
        var inst = t.Run("flatpak install flathub org.gimp.GIMP");
        Assert.Contains("org.gnome.Platform", inst.Out);
        Assert.True(inst.Pending);
        Assert.Contains("Installation complete.", t.Run("y").Out);
        Assert.NotNull(sh.Vfs.TryLookup("/var/lib/flatpak/app/org.gimp.GIMP", sh.RootUser()));
        Assert.Contains("org.gimp.GIMP", t.Run("flatpak list --app").Out);
        Assert.Contains("GNU Image Manipulation Program", t.Run("flatpak run org.gimp.GIMP").Out);
        Assert.Equal(1, t.Run("flatpak run org.videolan.VLC").ExitCode);

        t.Run("flatpak uninstall -y org.gimp.GIMP");
        Assert.Contains("org.gnome.Platform", t.Run("flatpak list --runtime").Out);
        t.Run("flatpak uninstall -y --unused");
        Assert.Equal("", t.Run("flatpak list").Out);
    }

    [Fact(DisplayName = "--user har egna källor och hamnar i hemkatalogen")]
    public void UserInstallationHasOwnRemotes()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        Assert.Equal(1, t.Run("flatpak install --user -y flathub org.videolan.VLC").ExitCode);
        t.Run("flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo");
        Assert.Equal(0, t.Run("flatpak install --user -y flathub org.videolan.VLC").ExitCode);
        Assert.Equal("elev", sh.Vfs.TryLookup("/home/elev/.local/share/flatpak/app/org.videolan.VLC", sh.CurrentUser())?.Owner);
        Assert.Matches(@"org\.videolan\.VLC.*user", t.Run("flatpak list").Out);
    }

    // ---------------------------------------------------------------- Snap

    [Fact(DisplayName = "Ubuntu har snaps från början, Debian inte")]
    public void UbuntuHasSnaps()
    {
        Assert.Matches(@"firefox\s+144", new TestShell("ubuntu").Run("snap list").Out);
        Assert.Equal(127, new TestShell("debian").Run("snap list").ExitCode);
    }

    [Fact(DisplayName = "installera kräver root; hello-world körs från /snap/bin")]
    public void SnapInstallNeedsRoot()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        t.Run("sudo dnf install -y snapd");
        Assert.Contains("No snaps are installed yet", t.Run("snap list").Out);
        Assert.Contains("access denied (try with sudo)", t.Run("snap install hello-world").Out);
        Assert.Contains("hello-world 6.4 from canonical✓ installed", t.Run("sudo snap install hello-world").Out);
        Assert.Equal("Hello World!\n", t.Run("hello-world").Out);
        Assert.Equal("Hello World!\n", t.Run("/snap/bin/hello-world").Out);
        Assert.Equal("Hello World!\n", t.Run("snap run hello-world").Out);
        Assert.Matches(@"core22\s+.*base", t.Run("snap list").Out);
        t.Run("sudo snap remove hello-world");
        Assert.Equal(1, t.Run("snap run hello-world").ExitCode);
        Assert.Null(sh.Vfs.TryLookup("/snap/bin/hello-world", sh.RootUser()));
    }

    [Fact(DisplayName = "classic confinement måste godkännas")]
    public void ClassicConfinementMustBeAccepted()
    {
        var t = new TestShell("ubuntu");
        var r = t.Run("sudo snap install code");
        Assert.Equal(1, r.ExitCode);
        Assert.Contains("classic confinement", r.Out);
        Assert.Equal(0, t.Run("sudo snap install code --classic").ExitCode);
        Assert.Matches(@"code\s+.*classic", t.Run("snap list").Out);
    }

    // ---------------------------------------------------------------- AppImage

    private const string App = "/home/elev/Nedladdningar/Kalkylator.AppImage";

    [Fact(DisplayName = "måste göras körbar och behöver FUSE 2")]
    public void AppImageNeedsExecAndFuse()
    {
        foreach (var (distro, pkgCmd) in new[]
                 {
                     ("ubuntu", "sudo apt update && sudo apt install libfuse2t64"),
                     ("arch", "sudo pacman -S --noconfirm fuse2"),
                     ("fedora", "sudo dnf install -y fuse-libs"),
                 })
        {
            var t = new TestShell(distro);
            Assert.Contains("Permission denied", t.Run(App).Out);
            t.Run($"chmod +x {App}");
            var fuse = t.Run(App);
            Assert.Equal(127, fuse.ExitCode);
            Assert.Contains("AppImages require FUSE to run", fuse.Out);
            t.Run(pkgCmd);
            var ok = t.Run(App);
            Assert.True(ok.ExitCode == 0, distro);
            Assert.Contains("Kalkylator", ok.Out);
        }
    }

    [Fact(DisplayName = "--appimage-extract och omdöpt fil")]
    public void AppImageExtractAndRenamed()
    {
        var t = new TestShell("debian");
        var sh = t.Sh;
        t.Run("cd ~/Nedladdningar");
        t.Run("chmod +x Kalkylator.AppImage");
        Assert.Contains("squashfs-root/AppRun", t.Run("./Kalkylator.AppImage --appimage-extract").Out);
        Assert.NotNull(sh.Vfs.TryLookup("/home/elev/Nedladdningar/squashfs-root/kalkylator.desktop", sh.RootUser()));
        Assert.Equal(0, t.Run("./squashfs-root/AppRun").ExitCode);
        Assert.Equal(0, t.Run("./Kalkylator.AppImage --appimage-extract-and-run").ExitCode);
        t.Run("mv Kalkylator.AppImage kalk");
        Assert.Contains("AppImages require FUSE", t.Run("./kalk").Out);
    }

    // ---------------------------------------------------------------- övrigt

    [Fact(DisplayName = "gamla sparade terminaler får makepkg och ~/Nedladdningar")]
    public void OldSnapshotsGetMakepkgAndDownloads()
    {
        var sh = new TestShell("arch").Sh;
        var snap = Js.Parse<ShellSnapshot>(sh.SnapshotJson())!;
        snap.Fs.Children!["usr"].Children!["bin"].Children!.Remove("makepkg");
        snap.Fs.Children!["home"].Children!["elev"].Children!.Remove("Nedladdningar");
        foreach (var k in snap.Flags.Keys.ToList()) if (k == "default:cmd:makepkg" || k.Contains("Nedladdningar")) snap.Flags.Remove(k);
        var restored = Shell.Restore(snap)!;
        Assert.NotNull(restored.Vfs.TryLookup("/usr/bin/makepkg", restored.RootUser()));
        Assert.NotNull(restored.Vfs.TryLookup("/home/elev/Nedladdningar/Kalkylator.AppImage", restored.RootUser()));
    }

    [Fact(DisplayName = "moonphase räknar månens ålder")]
    public void MoonphaseComputesAge()
    {
        double newMoon = new DateTimeOffset(2000, 1, 6, 18, 14, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
        // toBeCloseTo: |expected - actual| < 0.005
        Assert.True(Math.Abs(ReposCmd.MoonAge(newMoon) - 0) < 0.005);
        // Half a synodic month after a new moon it is full moon.
        Assert.True(Math.Abs(ReposCmd.MoonAge(newMoon + (29.530588853 / 2) * 86_400_000) - 29.530588853 / 2) < 0.005);
        Assert.True(ReposCmd.MoonAge(new DateTimeOffset(1999, 12, 1, 0, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds()) > 0);
    }

    // preprocess() from src/content/render.ts: keeps only :::family blocks for the chosen family and fills in {{placeholders}}.
    // The test calls preprocess(md, d) without a language, so the family names are always the Swedish ones.
    private static readonly Dictionary<string, Dictionary<string, string>> FamilyNames = new()
    {
        ["sv"] = new() { ["debian"] = "Debian-familjen", ["arch"] = "Arch-familjen", ["redhat"] = "Red Hat-familjen" },
        ["en"] = new() { ["debian"] = "Debian family", ["arch"] = "Arch family", ["redhat"] = "Red Hat family" },
    };

    private static readonly Regex FamilyBlock = new(@"^:::(debian|arch|redhat)[ \t]*\n([\s\S]*?)\n:::[ \t]*$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex Placeholder = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);
    private static readonly Regex ShBlock = new(@"```sh\n([\s\S]*?)```", RegexOptions.CultureInvariant);

    private static string Preprocess(string md, Distro d, string lang = "sv")
    {
        var values = new Dictionary<string, string>
        {
            ["distro"] = d.Name,
            ["hostname"] = d.Hostname,
            ["family"] = FamilyNames[lang][d.Family],
            ["pm"] = d.PackageManager,
            ["adminGroup"] = d.AdminGroup,
        };
        md = Regex.Replace(md, @"\r\n?", "\n");
        md = FamilyBlock.Replace(md, m =>
            m.Groups[1].Value == d.Family ? $"<div class=\"distro-block\" data-family=\"{m.Groups[1].Value}\" data-label=\"{values["family"]}\">\n\n{m.Groups[2].Value}\n\n</div>" : "");
        return Placeholder.Replace(md, m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "src", "Linux", "content", "chapters"))) dir = dir.Parent;
        return dir?.FullName ?? throw new DirectoryNotFoundException("src/Linux/content/chapters");
    }

    [Fact(DisplayName = "alla klickbara kommandon i kapiteltexterna fungerar")]
    public void ChapterCommandsWork()
    {
        // Intentional failures: "snap install code" without --classic, an AppImage before FUSE exists and
        // "dnf check-update", which exits with 100 when there are updates.
        Regex[] ExpectedFailures(World w) => new[] { new Regex(@"^sudo snap install code\z"), new Regex($@"^\./{Regex.Escape(w["calculator"])}\z"), new Regex(@"^dnf check-update\z") };
        var root = RepoRoot();
        foreach (var lang in World.Languages.OrderBy(l => l, StringComparer.Ordinal))
        {
            var world = World.Get(lang);
            var expectedFailures = ExpectedFailures(world);
            foreach (var d in DistrosLib.Distros)
            {
                var t = new TestShell(d.Id, lang, lang);
                // The family chapter of the distro (apt/pacman/dnf and PPA/AUR/COPR), then the universal formats.
                foreach (var id in new[] { $"familj-{d.Family}", "universella-paket" })
                {
                    var path = Path.Combine(root, "src", "Linux", "content", "chapters", lang, $"{id}.md");
                    // A translation that hasn't been written yet is reported by the content tests, not here.
                    if (lang != "en" && !File.Exists(path)) continue;
                    var md = world.Expand(Preprocess(File.ReadAllText(path), d));
                    var lines = ShBlock.Matches(md).SelectMany(m => m.Groups[1].Value.Split('\n').Where(l => l != "")).ToList();
                    foreach (var line in lines)
                    {
                        var r = t.Run(line);
                        for (int i = 0; r.Pending && i < 5; i++) r = t.Run("y");
                        if (r.ExitCode != 0 && !expectedFailures.Any(re => re.IsMatch(line)))
                        {
                            Assert.Fail($"{lang}/{id} i {d.Id}: \"{line}\" gav {r.ExitCode}\n{r.Out}");
                        }
                    }
                }
            }
        }
    }
}
