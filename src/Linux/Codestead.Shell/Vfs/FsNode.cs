using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Virtual file system: a file, directory or symbolic link (plain data, saved as JSON).

public partial class FsNode
{
    /// <summary>"file", "dir" or "link" (a symbolic link: <see cref="Content"/> is the path it points to).</summary>
    public string Type { get; set; } = "file";
    /// <summary>Permission bits, e.g. 0o755. Includes setuid (0o4000) and the sticky bit (0o1000).</summary>
    public int Mode { get; set; }
    public string Owner { get; set; } = "root";
    public string Group { get; set; } = "root";
    public long Mtime { get; set; }
    public string? Content { get; set; }
    public OrderedDictionary<string, FsNode>? Children { get; set; }
    /// <summary>Pretend size of "binaries" in /usr/bin.</summary>
    public long? Size { get; set; }
    /// <summary>
    /// The inode number, given the first time something shows it (ls -i, stat) or when the file gets a
    /// hard link. Hard links are the same node in several directories; they share the inode number, which
    /// is how they are joined again when a saved terminal is loaded (see <see cref="VFS.JoinHardLinks"/>).
    /// </summary>
    public long? Ino { get; set; }
    /// <summary>The number of hard links (names) when there are more than one.</summary>
    public int? Nlink { get; set; }

    [JsonIgnore] public bool IsDir => Type == "dir";
    [JsonIgnore] public bool IsFile => Type == "file";
    [JsonIgnore] public bool IsLink => Type == "link";
}
