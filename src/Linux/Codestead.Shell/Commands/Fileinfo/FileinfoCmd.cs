namespace Codestead.Shell.Commands;

// Links and information about files: ln, readlink, realpath, stat, file and umask.

public static partial class FileinfoCmd
{
    private static string JoinPath(string dir, string name) => dir == "/" ? $"/{name}" : $"{dir}/{name}";

    /// <summary>The path from directory <paramref name="from"/> to <paramref name="to"/>, e.g. "../docs/a.txt".</summary>
    public static string RelativePath(string from, string to)
    {
        var a = from.Split('/').Where(s => s != "").ToList();
        var b = to.Split('/').Where(s => s != "").ToList();
        int i = 0;
        while (i < a.Count && i < b.Count && a[i] == b[i]) i++;
        var parts = Enumerable.Repeat("..", a.Count - i).Concat(b.Skip(i)).ToList();
        return parts.Count == 0 ? "." : string.Join("/", parts);
    }

    // ---------- readlink and realpath ----------

    /// <summary>The path without symbolic links, "." or "..". With <paramref name="lastMayBeMissing"/> the last part need not exist.</summary>
    private static string? Canonical(Shell sh, string arg, bool lastMayBeMissing)
    {
        var user = sh.CurrentUser();
        var path = sh.Resolve(arg);
        try
        {
            return sh.Vfs.RealPath(path, user);
        }
        catch (FsError)
        {
            if (!lastMayBeMissing || path == "/") return null;
            try
            {
                var dir = sh.Vfs.RealPath(VfsLib.Dirname(path), user);
                if (sh.Vfs.Lookup(dir, user).Type != "dir") return null;
                // The last part may be a broken symbolic link: follow it as far as it goes.
                var link = sh.Vfs.TryLookupLink(JoinPath(dir, VfsLib.Basename(path)), user);
                if (link?.Type == "link") return VfsLib.ResolvePath(dir, link.Content ?? "");
                return JoinPath(dir, VfsLib.Basename(path));
            }
            catch (FsError)
            {
                return null;
            }
        }
    }

    /// <summary>A time the way stat shows it: 2026-11-03 10:15:22.000000000 +0100.</summary>
    public static string StatTime(long ms)
    {
        var local = Js.LocalDate(ms);
        var off = TimeZoneInfo.Local.GetUtcOffset(local);
        var sign = off < TimeSpan.Zero ? "-" : "+";
        var abs = off.Duration();
        return local.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) +
            $".{(ms % 1000 + 1000) % 1000:D3}000000 {sign}{abs.Hours:D2}{abs.Minutes:D2}";
    }

    private static string Octal(int mode) => Convert.ToString(mode & Js.Oct(7777), 8);

    // ---------- file ----------

    private static readonly Regex ShebangRe = new(@"^#!\s*(\S+)(?:\s+(\S+))?", RegexOptions.CultureInvariant);

    /// <summary>What `file` says about some content (without the name).</summary>
    public static string Describe(string content, bool executable)
    {
        if (content == "") return "empty";
        if (content.StartsWith(VfsLib.Elf, StringComparison.Ordinal))
            return "ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, stripped";
        var archive = ArchiveCmd.ReadArchive(content);
        if (archive?.Format == "tar") return "POSIX tar archive (GNU)";
        if (archive?.Format == "zip") return "Zip archive data, at least v2.0 to extract, compression method=deflate";
        if (content.StartsWith("\u001f\u008b", StringComparison.Ordinal)) return "gzip compressed data, from Unix";
        if (content.StartsWith("-----BEGIN OPENSSH PRIVATE KEY-----", StringComparison.Ordinal)) return "OpenSSH private key";
        if (content.StartsWith("ssh-ed25519 ", StringComparison.Ordinal)) return "OpenSSH ED25519 public key";
        if (content.StartsWith("ssh-rsa ", StringComparison.Ordinal)) return "OpenSSH RSA public key";
        bool ascii = content.All(ch => ch < 128);
        var text = ascii ? "ASCII text" : "Unicode text, UTF-8 text";
        var m = ShebangRe.Match(content);
        if (m.Success)
        {
            var prog = VfsLib.Basename(m.Groups[1].Value == "/usr/bin/env" && m.Groups[2].Success ? m.Groups[2].Value : m.Groups[1].Value);
            var kind = prog switch
            {
                "bash" => "Bourne-Again shell script",
                "sh" or "dash" => "POSIX shell script",
                "zsh" => "Paul Falstad's zsh script",
                "fish" => "fish shell script",
                _ when prog.StartsWith("python", StringComparison.Ordinal) => "Python script",
                _ => $"a {m.Groups[1].Value} script",
            };
            return $"{kind}, {text}{(executable ? " executable" : "")}";
        }
        var trimmed = content.TrimStart();
        if (trimmed.StartsWith("<!DOCTYPE html", StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith("<html", StringComparison.OrdinalIgnoreCase)) return $"HTML document, {text}";
        if ((trimmed.StartsWith('{') || trimmed.StartsWith('[')) && IsJson(trimmed)) return "JSON text data";
        var lines = content.Split('\n').Where(l => l != "").ToList();
        if (lines.Count >= 2 && lines[0].Contains(',') && lines.All(l => l.Count(ch => ch == ',') == lines[0].Count(ch => ch == ','))) return $"CSV {text}";
        return text;
    }

    private static bool IsJson(string s)
    {
        try
        {
            using var _ = System.Text.Json.JsonDocument.Parse(s);
            return true;
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Ln, Readlink, Realpath, Stat, File, Umask };
}
