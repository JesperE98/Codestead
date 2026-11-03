using System.Diagnostics;
using System.Formats.Tar;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

namespace Codestead.Hub.Core;

/// <summary>
/// Installs tools per user, without administrator rights:
/// <c>&lt;root&gt;/tools/&lt;id&gt;/&lt;version&gt;/…</c> plus <c>&lt;root&gt;/tools/&lt;id&gt;/current.json</c>.
/// A new version is downloaded, checked (size and SHA-256 from the signed catalog), unpacked next to the
/// old one and only then made current, so an interrupted update never breaks the installed tool.
/// The previous version is kept so it can be restored. The tools' own data (progress, settings) lives
/// elsewhere and is not touched by uninstalling.
/// </summary>
public sealed class ToolStore
{
    private const string CurrentFile = "current.json";

    public string Root { get; }
    private string ToolsDir => Path.Combine(Root, "tools");

    public ToolStore(string root)
    {
        Root = root;
    }

    /// <summary>Ids become folder names: lower-case letters, digits and dashes only.</summary>
    public static bool IsSafeId(string id) =>
        System.Text.RegularExpressions.Regex.IsMatch(id, @"\A[a-z0-9][a-z0-9-]{0,63}\z");

    private string ToolDir(string id)
    {
        if (!IsSafeId(id)) throw new ArgumentException($"Invalid tool id \"{id}\".", nameof(id));
        return Path.Combine(ToolsDir, id);
    }

    /// <summary>The installed version of a tool, or null.</summary>
    public InstalledTool? Installed(string id)
    {
        var file = Path.Combine(ToolDir(id), CurrentFile);
        if (!File.Exists(file)) return null;
        try
        {
            var t = JsonSerializer.Deserialize<InstalledTool>(File.ReadAllBytes(file), Catalog.Json);
            if (t is null || t.Id != id || SemVer.Parse(t.Version) is null) return null;
            var dir = Path.Combine(ToolDir(id), t.Version);
            return System.IO.Directory.Exists(dir) ? t with { Directory = dir } : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public IEnumerable<InstalledTool> All() =>
        System.IO.Directory.Exists(ToolsDir)
            ? System.IO.Directory.GetDirectories(ToolsDir).Select(Path.GetFileName).Where(n => n is not null && IsSafeId(n)).Select(n => Installed(n!)).OfType<InstalledTool>()
            : Enumerable.Empty<InstalledTool>();

    /// <summary>Downloads, checks and installs <paramref name="asset"/> as the current version of <paramref name="tool"/>.</summary>
    /// <param name="progress">Download progress 0..1.</param>
    public async Task<InstalledTool> InstallAsync(CatalogTool tool, CatalogAsset asset, HttpClient http, IProgress<double>? progress = null, CancellationToken ct = default)
    {
        var toolDir = ToolDir(tool.Id);
        System.IO.Directory.CreateDirectory(toolDir);
        var token = Guid.NewGuid().ToString("N");
        var download = Path.Combine(toolDir, $".download-{token}");
        var staging = Path.Combine(toolDir, $".staging-{token}");
        try
        {
            await DownloadAsync(asset, http, download, progress, ct);

            System.IO.Directory.CreateDirectory(staging);
            await using (var file = File.OpenRead(download))
            {
                if (asset.Url.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    ZipFile.ExtractToDirectory(file, staging);
                }
                else
                {
                    await using var gz = new GZipStream(file, CompressionMode.Decompress);
                    await TarFile.ExtractToDirectoryAsync(gz, staging, overwriteFiles: false, ct);
                }
            }
            var exe = Path.Combine(staging, asset.Executable);
            if (!File.Exists(exe)) throw new InvalidDataException($"The package does not contain {asset.Executable}.");
            if (!OperatingSystem.IsWindows())
                File.SetUnixFileMode(exe, File.GetUnixFileMode(exe) | UnixFileMode.UserExecute | UnixFileMode.GroupExecute | UnixFileMode.OtherExecute);

            var previous = Installed(tool.Id);
            var versionDir = Path.Combine(toolDir, tool.Version);
            if (System.IO.Directory.Exists(versionDir)) MoveAside(versionDir);
            System.IO.Directory.Move(staging, versionDir);

            var installed = new InstalledTool(tool.Id, tool.Version, asset.Executable,
                previous is not null && previous.Version != tool.Version ? previous.Version : previous?.Previous);
            WriteCurrent(toolDir, installed);
            Cleanup(toolDir, installed);
            return installed with { Directory = versionDir };
        }
        finally
        {
            TryDelete(download);
            TryDelete(staging);
        }
    }

    private static async Task DownloadAsync(CatalogAsset asset, HttpClient http, string target, IProgress<double>? progress, CancellationToken ct)
    {
        var uri = new Uri(asset.Url);
        await using var input = uri.IsFile ? File.OpenRead(uri.LocalPath) : await http.GetStreamAsync(uri, ct);
        await using var output = File.Create(target);
        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[81920];
        long total = 0;
        int n;
        while ((n = await input.ReadAsync(buffer, ct)) > 0)
        {
            total += n;
            if (total > asset.Size) throw new InvalidDataException("The download is larger than the catalog says – it is not used.");
            sha.AppendData(buffer, 0, n);
            await output.WriteAsync(buffer.AsMemory(0, n), ct);
            progress?.Report((double)total / asset.Size);
        }
        if (total != asset.Size) throw new InvalidDataException($"The download is incomplete ({total} of {asset.Size} bytes).");
        var hash = Convert.ToHexStringLower(sha.GetHashAndReset());
        if (!string.Equals(hash, asset.Sha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("The download's checksum (SHA-256) is wrong – the file has been changed or damaged and is not used.");
    }

    /// <summary>Makes the previous version current again (after a bad update).</summary>
    public InstalledTool? RollBack(string id)
    {
        var current = Installed(id);
        if (current?.Previous is null) return null;
        var dir = Path.Combine(ToolDir(id), current.Previous);
        if (!System.IO.Directory.Exists(dir)) return null;
        var rolled = new InstalledTool(id, current.Previous, current.Executable, null);
        WriteCurrent(ToolDir(id), rolled);
        return rolled with { Directory = dir };
    }

    /// <summary>Removes a tool and all of its versions. Throws IOException if it is running (Windows).</summary>
    public void Uninstall(string id)
    {
        var dir = ToolDir(id);
        if (!System.IO.Directory.Exists(dir)) return;
        // Removing current.json first means a half-finished uninstall leaves the tool "not installed".
        File.Delete(Path.Combine(dir, CurrentFile));
        // Right after the tool has exited, Windows (or a virus scanner) may still hold its files for a moment.
        for (int attempt = 1; ; attempt++)
        {
            try
            {
                System.IO.Directory.Delete(dir, recursive: true);
                return;
            }
            catch (Exception e) when ((e is IOException or UnauthorizedAccessException) && attempt < UninstallAttempts)
            {
                Thread.Sleep(UninstallRetryDelay);
            }
        }
    }

    private const int UninstallAttempts = 10;
    private static readonly TimeSpan UninstallRetryDelay = TimeSpan.FromMilliseconds(300);

    /// <summary>Starts the installed tool (with <paramref name="captureOutput"/>: standard output can be read, for tests).</summary>
    public Process Launch(string id, string[] args, bool captureOutput = false)
    {
        var t = Installed(id) ?? throw new InvalidOperationException($"{id} is not installed.");
        var psi = new ProcessStartInfo(t.ExecutablePath) { WorkingDirectory = t.Directory, UseShellExecute = false, RedirectStandardOutput = captureOutput };
        foreach (var a in args) psi.ArgumentList.Add(a);
        return Process.Start(psi) ?? throw new InvalidOperationException($"Could not start {t.ExecutablePath}.");
    }

    private static void WriteCurrent(string toolDir, InstalledTool tool)
    {
        var tmp = Path.Combine(toolDir, CurrentFile + ".tmp");
        File.WriteAllBytes(tmp, JsonSerializer.SerializeToUtf8Bytes(tool with { Directory = "" }, Catalog.Json));
        File.Move(tmp, Path.Combine(toolDir, CurrentFile), overwrite: true);
    }

    /// <summary>Removes versions other than the current and the previous one, and leftovers of interrupted runs.</summary>
    private static void Cleanup(string toolDir, InstalledTool keep)
    {
        foreach (var dir in System.IO.Directory.GetDirectories(toolDir))
        {
            var name = Path.GetFileName(dir);
            if (name == keep.Version || name == keep.Previous) continue;
            TryDelete(dir);
        }
    }

    private static void MoveAside(string dir)
    {
        var aside = dir + $".old-{Guid.NewGuid():N}";
        System.IO.Directory.Move(dir, aside);
        TryDelete(aside);
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (System.IO.Directory.Exists(path)) System.IO.Directory.Delete(path, recursive: true);
            else if (File.Exists(path)) File.Delete(path);
        }
        catch (IOException)
        {
            // In use (e.g. an old version still running on Windows) – removed next time.
        }
        catch (UnauthorizedAccessException)
        {
        }
    }
}
