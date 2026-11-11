using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Codestead.GP.Course.Ide;

/// <summary>
/// Looks at the computer's running processes for programs started from the learner's executables. Linux: the link
/// /proc/&lt;pid&gt;/exe of every process. Windows: processes with the executable's name, then their image path
/// (QueryFullProcessImageName). macOS: processes with the name, then their path (proc_pidpath). A process matches
/// by path, or – when the folder is reached through a link (/var → /private/var, a symlinked home) – by name, size
/// and time of the file it runs. Programs that end within a poll interval can be missed: "I ran it" covers them.
/// </summary>
public sealed class SystemProcessProbe : IProcessProbe
{
    public IReadOnlyList<DateTime> StartTimes(IReadOnlyList<ExecutableFile> executables)
    {
        if (executables.Count == 0) return [];
        try
        {
            return OperatingSystem.IsLinux() ? Linux(executables) : ByName(executables);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or InvalidOperationException or System.ComponentModel.Win32Exception or PlatformNotSupportedException or DllNotFoundException or EntryPointNotFoundException)
        {
            return [];
        }
    }

    private static List<DateTime> Linux(IReadOnlyList<ExecutableFile> executables)
    {
        var names = new HashSet<string>(executables.Select(e => Path.GetFileName(e.Path)), StringComparer.Ordinal);
        var found = new List<DateTime>();
        foreach (var dir in Directory.EnumerateDirectories("/proc"))
        {
            var pid = Path.GetFileName(dir);
            if (pid.Length == 0 || !char.IsAsciiDigit(pid[0]) || !int.TryParse(pid, out var id)) continue;
            string? image;
            try
            {
                image = new FileInfo(Path.Combine(dir, "exe")).LinkTarget;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                continue;
            }
            // A program rebuilt while it runs: the process runs the old, deleted file.
            if (image is null || image.EndsWith(" (deleted)", StringComparison.Ordinal) || !names.Contains(Path.GetFileName(image))) continue;
            if (Matches(image, executables) && StartTime(id) is { } start) found.Add(start);
        }
        return found;
    }

    private static List<DateTime> ByName(IReadOnlyList<ExecutableFile> executables)
    {
        var names = executables.Select(e => Path.GetFileNameWithoutExtension(e.Path)).ToList();
        var found = new List<DateTime>();
        foreach (var p in Process.GetProcesses())
        {
            using (p)
            {
                string name;
                try
                {
                    name = p.ProcessName;
                }
                catch (InvalidOperationException)
                {
                    continue;
                }
                // macOS shortens process names (to 15 or 31 characters).
                bool candidate = OperatingSystem.IsWindows()
                    ? names.Any(n => string.Equals(n, name, StringComparison.OrdinalIgnoreCase))
                    : name.Length > 0 && names.Any(n => n.StartsWith(name, StringComparison.Ordinal));
                if (!candidate) continue;
                var image = ImagePath(p);
                if (image is not null && Matches(image, executables) && StartTime(p.Id) is { } start) found.Add(start);
            }
        }
        return found;
    }

    private static string? ImagePath(Process p)
    {
        try
        {
            if (OperatingSystem.IsWindows()) return WindowsImage(p.Id) ?? p.MainModule?.FileName;
            if (OperatingSystem.IsMacOS()) return MacImage(p.Id) ?? p.MainModule?.FileName;
            return p.MainModule?.FileName;
        }
        catch (Exception e) when (e is InvalidOperationException or System.ComponentModel.Win32Exception or NotSupportedException or DllNotFoundException or EntryPointNotFoundException)
        {
            return null;
        }
    }

    private static DateTime? StartTime(int pid)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            return p.StartTime.ToUniversalTime();
        }
        catch (Exception e) when (e is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception or NotSupportedException)
        {
            return null;
        }
    }

    /// <summary>The process runs one of the executables: the same path, or a file with the same name, size and time.</summary>
    public static bool Matches(string image, IReadOnlyList<ExecutableFile> executables)
    {
        var comparison = OperatingSystem.IsLinux() ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
        if (executables.Any(e => string.Equals(e.Path, image, comparison))) return true;
        var name = Path.GetFileName(image);
        var sameName = executables.Where(e => string.Equals(Path.GetFileName(e.Path), name, comparison)).ToList();
        if (sameName.Count == 0) return false;
        try
        {
            var info = new FileInfo(image);
            return info.Exists && sameName.Any(e => e.Size == info.Length && e.Modified == info.LastWriteTimeUtc);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException)
        {
            return false;
        }
    }

    // ---------- Windows ----------

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inherit, int pid);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool QueryFullProcessImageNameW(IntPtr process, int flags, StringBuilder name, ref int size);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static string? WindowsImage(int pid)
    {
        const uint QueryLimitedInformation = 0x1000;
        var handle = OpenProcess(QueryLimitedInformation, false, pid);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var name = new StringBuilder(1024);
            int size = name.Capacity;
            return QueryFullProcessImageNameW(handle, 0, name, ref size) ? name.ToString(0, size) : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    // ---------- macOS ----------

    [DllImport("/usr/lib/libproc.dylib")]
    private static extern int proc_pidpath(int pid, byte[] buffer, uint size);

    private static string? MacImage(int pid)
    {
        var buffer = new byte[4096];
        int n = proc_pidpath(pid, buffer, (uint)buffer.Length);
        return n > 0 ? Encoding.UTF8.GetString(buffer, 0, n) : null;
    }
}
