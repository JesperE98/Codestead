// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/commands/archive.ts.
// Delete when the real ArchiveCmd has been ported (see docs/PORTING.md).
namespace Codestead.Shell.Commands;

public partial class ArchiveEntry
{
    public string Path { get; set; } = "";
    public string Type { get; set; } = "file";
    public int Mode { get; set; }
    public string Owner { get; set; } = "";
    public string Group { get; set; } = "";
    public long Mtime { get; set; }
    public string? Content { get; set; }
    public long? Size { get; set; }
}

public partial class GzPayload
{
    public string? N { get; set; }
    public long? S { get; set; }
    public string D { get; set; } = "";
}

public static partial class ArchiveCmd
{
    public static GzPayload? GunzipString(string content) => throw new NotImplementedException();
    public static (string Format, List<ArchiveEntry> Entries)? ReadArchive(string content) => throw new NotImplementedException();
}
