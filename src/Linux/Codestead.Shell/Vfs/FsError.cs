namespace Codestead.Shell;

// Virtual file system: an error with an errno-like code (ENOENT, EACCES ...).

public partial class FsError : Exception
{
    private static readonly Dictionary<string, string> Messages = new()
    {
        ["ENOENT"] = "No such file or directory",
        ["EACCES"] = "Permission denied",
        ["ENOTDIR"] = "Not a directory",
        ["EISDIR"] = "Is a directory",
        ["EEXIST"] = "File exists",
        ["ENOTEMPTY"] = "Directory not empty",
        ["EPERM"] = "Operation not permitted",
        ["EINVAL"] = "Invalid argument",
        ["ELOOP"] = "Too many levels of symbolic links",
    };

    /// <summary>ENOENT, EACCES, ENOTDIR, EISDIR, EEXIST, ENOTEMPTY, EPERM, EINVAL or ELOOP.</summary>
    public string Code { get; }

    public FsError(string code) : base(Messages[code]) => Code = code;
}
