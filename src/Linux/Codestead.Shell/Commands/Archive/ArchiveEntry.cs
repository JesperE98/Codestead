namespace Codestead.Shell.Commands;

/// <summary>A file or directory in a tar or zip archive.</summary>
public partial class ArchiveEntry
{
    /// <summary>Relative path, without a trailing /.</summary>
    public string Path { get; set; } = "";
    /// <summary>"file", "dir" or "link" (a symbolic link: <see cref="Content"/> is where it points).</summary>
    public string Type { get; set; } = "file";
    public int Mode { get; set; }
    public string Owner { get; set; } = "";
    public string Group { get; set; } = "";
    public long Mtime { get; set; }
    public string? Content { get; set; }
    /// <summary>Pretend size, for simulated binaries (e.g. /usr/bin/ls).</summary>
    public long? Size { get; set; }
}
