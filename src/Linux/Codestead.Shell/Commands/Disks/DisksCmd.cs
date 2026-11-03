namespace Codestead.Shell.Commands;

// Port of src/shell/commands/disks.ts – commands for disks and file systems: df, lsblk, blkid,
// mount, umount, findmnt, fdisk, swapon, sync and mkfs (mkfs.ext4, mkfs.vfat ...).
// The disk model itself is in ../Disks.cs.

public static partial class DisksCmd
{
    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    private static void Tip(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    /// <summary>
    /// Writes a table with columns. Cells may have several lines (\n), e.g. when a partition is
    /// mounted in several places. The last column is not padded. align is 'l' or 'r'.
    /// </summary>
    private static string Table(List<List<string>> rows, IReadOnlyList<char> align, IReadOnlyList<int>? minWidths = null)
    {
        const string sep = " ";
        minWidths ??= Array.Empty<int>();
        var widths = align.Select((_, i) =>
        {
            int w = i < minWidths.Count ? minWidths[i] : 0;
            foreach (var r in rows)
            {
                var cell = i < r.Count ? r[i] ?? "" : "";
                foreach (var s in cell.Split('\n')) w = Math.Max(w, s.Length);
            }
            return w;
        }).ToList();
        var @out = new StringBuilder();
        foreach (var row in rows)
        {
            var cells = row.Select(c => (c ?? "").Split('\n')).ToList();
            int height = cells.Count == 0 ? 0 : cells.Max(c => c.Length);
            for (int line = 0; line < height; line++)
            {
                var parts = align.Select((a, i) =>
                {
                    var text = i < cells.Count && line < cells[i].Length ? cells[i][line] : "";
                    if (i == align.Count - 1 && a == 'l') return text;
                    return a == 'r' ? text.PadLeft(widths[i]) : text.PadRight(widths[i]);
                });
                @out.Append(string.Join(sep, parts).TrimEnd()).Append('\n');
            }
        }
        return @out.ToString();
    }

    /// <summary>Tree branches drawn by lsblk and findmnt.</summary>
    private static string Branch(bool isLast) => isLast ? "└─" : "├─";

    private static Dictionary<string, string> Long(params (string Key, string Value)[] pairs) =>
        pairs.ToDictionary(p => p.Key, p => p.Value);

    private sealed record Column<T>(char Align, Func<T, bool, string> Get);

    private static readonly Regex LabelUuidPrefix = new(@"^(LABEL|UUID)=", RegexOptions.CultureInvariant);

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        Df,
        Lsblk,
        Blkid,
        MountCmd,
        Umount,
        Findmnt,
        Fdisk,
        Swapon,
        Sync,
        Mkfs,
        MkfsDef("mkfs.ext4", MkfsExt("ext4")),
        MkfsDef("mke2fs", MkfsExt()),
        MkfsDef("mkfs.vfat", MkfsVfatRun),
        MkfsDef("mkfs.fat", MkfsVfatRun),
    };
}
