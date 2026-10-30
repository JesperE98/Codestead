namespace Codestead.Shell;

// Port of src/shell/packages.ts (type only so far – data and functions go in PackagesLib).

public partial class PackageDef
{
    public string Id { get; set; } = "";
    /// <summary>Package name per family. If the family is missing, the package does not exist there.</summary>
    public OrderedDictionary<Family, string> Names { get; set; } = Js.Obj<string>();
    public OrderedDictionary<Family, string> Version { get; set; } = Js.Obj<string>();
    /// <summary>Version that becomes available after the package lists have been updated.</summary>
    public OrderedDictionary<Family, string>? NewVersion { get; set; }
    public string Description { get; set; } = "";
    public long SizeKb { get; set; }
    /// <summary>Commands the package installs in /usr/bin.</summary>
    public List<string> Provides { get; set; } = new();
    /// <summary>Preinstalled in these families.</summary>
    public List<Family>? Base { get; set; }
    /// <summary>System critical – the package manager refuses to remove it.</summary>
    public bool? Essential { get; set; }
    /// <summary>Arch repository ("core"/"extra").</summary>
    public string? ArchRepo { get; set; }
    /// <summary>Shells the package adds to /etc/shells.</summary>
    public List<string>? Shells { get; set; }
    /// <summary>Preinstalled only in these distributions (e.g. snapd in Ubuntu but not in Debian).</summary>
    public List<string>? BaseDistros { get; set; }
    /// <summary>
    /// Exists only in an extra repository: "ppa:user/name" (Debian/Ubuntu), "aur" (Arch)
    /// or "copr:user/project" (Fedora). See Extrarepo.cs and Commands/ReposCmd.cs.
    /// </summary>
    public OrderedDictionary<Family, string>? ExtraRepo { get; set; }
}
