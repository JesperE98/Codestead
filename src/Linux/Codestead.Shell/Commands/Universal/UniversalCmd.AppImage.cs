namespace Codestead.Shell.Commands;

// The appimage-runtime command: the launcher inside an AppImage.

public static partial class UniversalCmd
{
    private const string FuseError =
        "dlopen(): error loading libfuse.so.2\n\nAppImages require FUSE to run. \nYou might still be able to extract the contents of this AppImage \n" +
        "if you run it with the --appimage-extract option. \nSee https://github.com/AppImage/AppImageKit/wiki/FUSE \nfor more information\n";

    private static readonly Dictionary<string, string> FusePkg = new() { ["debian"] = "libfuse2t64", ["arch"] = "fuse2", ["redhat"] = "fuse-libs" };

    private static readonly Regex AppImageHeader = new(@"^AppImage: (.+?)(?: [0-9][0-9.]*)?$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex DesktopHeader = new(@"^Desktop: (\S+)\.desktop$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex AppImageExt = new(@"\.AppImage\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Runs when an AppImage (or its extracted AppRun) is started.</summary>
    private static readonly CommandDef AppImageRuntime = new()
    {
        Name = "appimage-runtime",
        Summary = "Startprogrammet inuti en AppImage",
        SummaryEn = "The launcher inside an AppImage",
        Man = """
NAMN
       AppImage - ett helt program i en enda körbar fil

BESKRIVNING
       En AppImage startas som vilket program som helst: gör filen körbar
       med chmod +x och kör den med ./Fil.AppImage. Den monterar sig själv
       med FUSE (biblioteket libfuse.so.2).

FLAGGOR
       --appimage-extract           packa upp innehållet till squashfs-root/
       --appimage-extract-and-run   packa upp tillfälligt och kör (utan FUSE)
""",
        ManEn = """
NAME
       AppImage - a whole program in a single executable file

DESCRIPTION
       An AppImage is started like any program: make the file executable
       with chmod +x and run it with ./File.AppImage. It mounts itself
       with FUSE (the library libfuse.so.2).

OPTIONS
       --appimage-extract           unpack the contents to squashfs-root/
       --appimage-extract-and-run   unpack temporarily and run (no FUSE)
""",
        Run = RunAppImage,
    };

    private static int RunAppImage(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var path = sh.Resolve(ctx.Name);
        var self = sh.Vfs.TryLookup(path, sh.CurrentUser())?.Content ?? "";
        var hm = AppImageHeader.Match(self);
        var appName = hm.Success ? hm.Groups[1].Value : AppImageExt.Replace(VfsLib.Basename(path), "", 1).Split('-')[0];
        var extracted = VfsLib.Basename(path) == "AppRun" || path.Contains("/squashfs-root/");
        var arg = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        if (arg == "--appimage-version")
        {
            ctx.Out("AppImage runtime version: continuous build\n");
            return 0;
        }
        if (arg == "--appimage-help")
        {
            ctx.Out("AppImage options:\n\n  --appimage-extract [<pattern>]  Extract content from embedded filesystem image\n  --appimage-extract-and-run      Temporarily extract and run without FUSE\n  --appimage-help                 Print this help\n  --appimage-version              Print version of AppImage runtime\n");
            return 0;
        }
        if (arg == "--appimage-extract" && !extracted)
        {
            var user = sh.CurrentUser();
            var g = user.Groups.FirstOrDefault();
            // File names come from the desktop id (ASCII), not from the app's name in the student's language.
            var dm = DesktopHeader.Match(self);
            var lower = dm.Success ? dm.Groups[1].Value : appName.ToLowerInvariant();
            var files = new List<(string Name, FsNode Node)>
            {
                ("AppRun", SimBinary("appimage-runtime", user.Name, Js.Oct(755), g, $"AppImage: {appName}\nDesktop: {lower}.desktop\n")),
                ($"{lower}.desktop", VfsLib.MakeFile($"[Desktop Entry]\nType=Application\nName={appName}\nExec={lower}\nIcon={lower}\nCategories=Utility;Calculator;\n", user.Name, Js.Oct(644), g)),
                ($"{lower}.png", VfsLib.MakeFile("\u0089PNG (simulated icon)\n", user.Name, Js.Oct(644), g)),
                (".DirIcon", VfsLib.MakeFile("\u0089PNG (simulated icon)\n", user.Name, Js.Oct(644), g)),
            };
            var tree = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(files.ToArray()), g);
            tree.Children!["usr"] = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(
                ("bin", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids((lower, SimBinary("appimage-runtime", user.Name, Js.Oct(755), g, $"AppImage: {appName}\nDesktop: {lower}.desktop\n"))), g)),
                ("lib", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(("libQt6Core.so.6", VfsLib.MakeFile("(simulated library)\n", user.Name, Js.Oct(644), g))), g))), g);
            try
            {
                sh.Vfs.Insert(sh.Resolve("squashfs-root"), tree, user);
            }
            catch (FsError e)
            {
                ctx.Err($"Failed to create squashfs-root: {e.Message}\n");
                return 1;
            }
            foreach (var (n, _) in files) ctx.Out($"squashfs-root/{n}\n");
            ctx.Out($"squashfs-root/usr\nsquashfs-root/usr/bin\nsquashfs-root/usr/bin/{lower}\nsquashfs-root/usr/lib\nsquashfs-root/usr/lib/libQt6Core.so.6\n");
            return 0;
        }
        if (!extracted && arg != "--appimage-extract-and-run" && string.IsNullOrEmpty(sh.Installed.Get("fuse2")))
        {
            ctx.Err(FuseError);
            var fusePkg = FusePkg.GetValueOrDefault(sh.Distro.Family);
            ctx.Err(Dim(sh, "universal.appImageFuse", ("distro", sh.Distro.Name), ("pkg", fusePkg)));
            return 127;
        }
        ctx.Out(WindowNote(sh, appName));
        return 0;
    }
}
