namespace Codestead.Hub.Core;

// One downloadable file of a tool in the catalog.

public sealed class CatalogAsset
{
    /// <summary>Portable archive: .zip on Windows, .tar.gz on Linux.</summary>
    public string Url { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Size { get; set; }
    /// <summary>The program to start, relative to the archive root (e.g. "Codestead.Linux.exe").</summary>
    public string Executable { get; set; } = "";
}
