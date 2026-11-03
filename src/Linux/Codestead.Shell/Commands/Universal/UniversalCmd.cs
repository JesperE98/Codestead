namespace Codestead.Shell.Commands;

// Port of src/shell/commands/universal.ts
// Universal package formats that work on every distribution: Flatpak, Snap and AppImage.
// All state lives in the virtual file system, just like on a real system:
//   Flatpak: /var/lib/flatpak (system) and ~/.local/share/flatpak (--user)
//   Snap:    /snap/<name>/<revision> and /snap/bin
//   AppImage: a single executable file, e.g. ~/Downloads/Calculator.AppImage
// Graphical programs cannot be shown in the simulator – they print a dimmed line instead.

public static partial class UniversalCmd
{
    private static bool IsRoot(Shell sh) => sh.CurrentUser().Uid == 0;
    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";
    private static bool Flag(Shell sh, string key) => sh.Flags.TryGetValue(key, out var v) && v;

    /// <summary>The line shown instead of a window.</summary>
    private static string WindowNote(Shell sh, string app) =>
        Dim(sh, "universal.graphicalApp", ("app", app));

    private static FsNode SimBinary(string impl, string owner = "root", int mode = -1, string? group = null, string extra = "")
    {
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: {impl})\n{extra}", owner, mode < 0 ? Js.Oct(755) : mode, group ?? owner);
        node.Size = 40_000;
        return node;
    }

    private static FsNode? TryNode(Shell sh, string path) => sh.Vfs.TryLookup(path, sh.RootUser());
    private static List<string> Children(Shell sh, string path) => (TryNode(sh, path)?.Children?.Keys ?? Enumerable.Empty<string>()).ToList().SortJs();

    private static OrderedDictionary<string, FsNode> Kids(params (string Name, FsNode Node)[] items)
    {
        var d = Js.Obj<FsNode>();
        foreach (var (name, node) in items) d[name] = node;
        return d;
    }

    // ================================================================ AppImage

    /// <summary>
    /// A downloaded AppImage (as in the initial file system): a single file, not yet executable.
    /// Its name is the world's {{calculator}} in {{downloads}}, e.g. ~/Downloads/Calculator.AppImage.
    /// </summary>
    public static FsNode AppImageNode(World w, string owner, string? group = null)
    {
        var desktop = w["calculator"].Replace(".AppImage", "", StringComparison.Ordinal).ToLowerInvariant();
        var node = SimBinary("appimage-runtime", owner, Js.Oct(644), group ?? owner, $"AppImage: {w["calcName"]} 2.3.1\nDesktop: {desktop}.desktop\nType 2 AppImage (squashfs)\n");
        node.Size = 48_312_832;
        return node;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Flatpak, Snap, AppImageRuntime };
}
