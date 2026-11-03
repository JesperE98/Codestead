namespace Codestead.Shell;

// Disk model: size, used and available space of a file system.

public partial class Usage
{
    /// <summary>The file system's size, used and available in bytes.</summary>
    public double Size { get; set; }
    public double Used { get; set; }
    public double Avail { get; set; }
}
