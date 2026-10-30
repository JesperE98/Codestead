using System.Formats.Tar;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Codestead.Hub.Core;

namespace Codestead.Hub.Tests;

/// <summary>A temporary folder with a signing key, packages and a catalog – removed after each test.</summary>
public sealed class Fixture : IDisposable
{
    public string Dir { get; } = Directory.CreateTempSubdirectory("codestead-hub-test-").FullName;
    public ECDsa Key { get; } = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    public string PublicPem => Key.ExportSubjectPublicKeyInfoPem();
    public CatalogVerifier Verifier => new(PublicPem);
    public string StoreRoot => Path.Combine(Dir, "store");

    public string Sign(byte[] data) =>
        Convert.ToBase64String(Key.SignData(data, HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence));

    /// <summary>Builds a portable package with an executable "tool" (and "tool.exe") printing the version.</summary>
    public (string Path, CatalogAsset Asset) Package(string version, bool zip, Action<string>? tweak = null)
    {
        var src = Path.Combine(Dir, $"src-{version}-{zip}");
        Directory.CreateDirectory(Path.Combine(src, "lib"));
        File.WriteAllText(Path.Combine(src, "tool"), $"#!/bin/sh\necho {version}\n");
        File.WriteAllText(Path.Combine(src, "tool.exe"), version);
        File.WriteAllText(Path.Combine(src, "lib", "data.txt"), version);
        tweak?.Invoke(src);
        var file = Path.Combine(Dir, $"tool-{version}" + (zip ? ".zip" : ".tar.gz"));
        if (zip)
        {
            ZipFile.CreateFromDirectory(src, file);
        }
        else
        {
            using var fs = File.Create(file);
            using var gz = new GZipStream(fs, CompressionLevel.Fastest);
            TarFile.CreateFromDirectory(src, gz, includeBaseDirectory: false);
        }
        var bytes = File.ReadAllBytes(file);
        return (file, new CatalogAsset
        {
            Url = new Uri(file).AbsoluteUri,
            Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes)),
            Size = bytes.Length,
            Executable = zip ? "tool.exe" : "tool",
        });
    }

    public static CatalogTool Tool(string version, CatalogAsset asset, string rid = "linux-x64") => new()
    {
        Id = "codestead-test",
        Name = "Codestead Test",
        Description = new() { ["en"] = "A test tool", ["sv"] = "Ett testverktyg" },
        Version = version,
        Assets = new() { [rid] = asset },
    };

    public byte[] CatalogBytes(string generated, params CatalogTool[] tools) =>
        JsonSerializer.SerializeToUtf8Bytes(new Catalog { Schema = 1, Generated = generated, Tools = tools.ToList() }, Catalog.Json);

    /// <summary>Writes catalog.json and its signature; returns the catalog URL.</summary>
    public Uri Publish(byte[] catalog, string? signature = null)
    {
        var dir = Path.Combine(Dir, "web");
        Directory.CreateDirectory(dir);
        File.WriteAllBytes(Path.Combine(dir, "catalog.json"), catalog);
        File.WriteAllText(Path.Combine(dir, "catalog.json.sig"), signature ?? Sign(catalog));
        return new Uri(Path.Combine(dir, "catalog.json"));
    }

    public void Dispose()
    {
        Key.Dispose();
        try { Directory.Delete(Dir, true); } catch (IOException) { }
    }
}

public class SignatureTests
{
    [Fact(DisplayName = "en korrekt signerad katalog godtas")]
    public void ValidSignature()
    {
        using var f = new Fixture();
        var data = Encoding.UTF8.GetBytes("{\"schema\":1}");
        f.Verifier.Verify(data, f.Sign(data));
    }

    [Fact(DisplayName = "en ändrad katalog, fel nyckel eller trasig signatur avvisas")]
    public void BadSignatures()
    {
        using var f = new Fixture();
        using var other = new Fixture();
        var data = Encoding.UTF8.GetBytes("{\"schema\":1}");
        var sig = f.Sign(data);
        var tampered = Encoding.UTF8.GetBytes("{\"schema\":2}");
        Assert.Throws<CatalogException>(() => f.Verifier.Verify(tampered, sig));
        Assert.Throws<CatalogException>(() => other.Verifier.Verify(data, sig));
        Assert.Throws<CatalogException>(() => f.Verifier.Verify(data, "not base64!"));
        Assert.Throws<CatalogException>(() => f.Verifier.Verify(data, Convert.ToBase64String(new byte[70])));
    }

    [Fact(DisplayName = "utan inbyggd nyckel litar hubben inte på någon katalog")]
    public void NoKey()
    {
        var v = new CatalogVerifier(null);
        Assert.False(v.HasKey);
        Assert.Throws<CatalogException>(() => v.Verify(new byte[] { 1 }, "AA=="));
    }
}

public class CatalogTests
{
    private static byte[] Json(string tools) => Encoding.UTF8.GetBytes($"{{\"schema\":1,\"generated\":\"2026-01-01T00:00:00Z\",\"tools\":[{tools}]}}");

    private const string Sha = "0000000000000000000000000000000000000000000000000000000000000000";

    [Fact(DisplayName = "katalogen läses och beskrivningen följer språket")]
    public void Parses()
    {
        var c = Catalog.Parse(Json($"{{\"id\":\"codestead-linux\",\"name\":\"Codestead Linux\",\"version\":\"0.4.0\",\"description\":{{\"en\":\"Learn\",\"sv\":\"Lär dig\"}},\"assets\":{{\"linux-x64\":{{\"url\":\"https://example.org/a.tar.gz\",\"sha256\":\"{Sha}\",\"size\":10,\"executable\":\"Codestead.Linux\"}}}}}}"));
        var t = Assert.Single(c.Tools);
        Assert.Equal("Lär dig", t.DescriptionFor("sv"));
        Assert.Equal("Learn", t.DescriptionFor("ja"));
        Assert.NotNull(t.AssetFor("linux-x64"));
        Assert.Null(t.AssetFor("win-x64"));
    }

    [Theory(DisplayName = "farliga eller trasiga kataloger avvisas")]
    [InlineData("../evil", "0.1.0", "https://example.org/a.tar.gz", "tool")]
    [InlineData("ok", "latest", "https://example.org/a.tar.gz", "tool")]
    [InlineData("ok", "0.1.0", "http://example.org/a.tar.gz", "tool")]
    [InlineData("ok", "0.1.0", "https://example.org/a.tar.gz", "../../bin/sh")]
    [InlineData("ok", "0.1.0", "https://example.org/a.tar.gz", "/bin/sh")]
    public void Rejects(string id, string version, string url, string exe)
    {
        var json = Json($"{{\"id\":\"{id}\",\"version\":\"{version}\",\"assets\":{{\"linux-x64\":{{\"url\":\"{url}\",\"sha256\":\"{Sha}\",\"size\":10,\"executable\":\"{exe}\"}}}}}}");
        Assert.Throws<CatalogException>(() => Catalog.Parse(json));
    }

    [Fact(DisplayName = "okänt katalogformat avvisas")]
    public void RejectsSchema() =>
        Assert.Throws<CatalogException>(() => Catalog.Parse(Encoding.UTF8.GetBytes("{\"schema\":99,\"tools\":[]}")));

    [Fact(DisplayName = "versioner jämförs som siffror")]
    public void Versions()
    {
        Assert.True(SemVer.IsNewer("0.10.0", "0.9.9"));
        Assert.False(SemVer.IsNewer("0.4.0", "0.4.0"));
        Assert.False(SemVer.IsNewer("1.0", "0.1.0"));
    }
}

public class ToolStoreTests
{
    private static readonly HttpClient Http = new();

    [Theory(DisplayName = "installerar, uppdaterar, återställer och avinstallerar")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Lifecycle(bool zip)
    {
        using var f = new Fixture();
        var store = new ToolStore(f.StoreRoot);
        Assert.Null(store.Installed("codestead-test"));

        var (_, a1) = f.Package("0.1.0", zip);
        var progress = new List<double>();
        var p = new Progress<double>(progress.Add);
        var t1 = await store.InstallAsync(Fixture.Tool("0.1.0", a1), a1, Http, p);
        Assert.Equal("0.1.0", t1.Version);
        Assert.True(File.Exists(t1.ExecutablePath));
        Assert.Equal("0.1.0", File.ReadAllText(Path.Combine(t1.Directory, "lib", "data.txt")));
        if (!OperatingSystem.IsWindows() && !zip)
            Assert.True(File.GetUnixFileMode(t1.ExecutablePath).HasFlag(UnixFileMode.UserExecute));
        Assert.Equal("0.1.0", store.Installed("codestead-test")!.Version);

        var (_, a2) = f.Package("0.2.0", zip);
        var t2 = await store.InstallAsync(Fixture.Tool("0.2.0", a2), a2, Http);
        Assert.Equal("0.1.0", t2.Previous);
        Assert.True(Directory.Exists(t1.Directory), "the previous version is kept");

        var (_, a3) = f.Package("0.3.0", zip);
        var t3 = await store.InstallAsync(Fixture.Tool("0.3.0", a3), a3, Http);
        Assert.Equal("0.2.0", t3.Previous);
        Assert.False(Directory.Exists(t1.Directory), "older versions are removed");
        Assert.Empty(Directory.GetFileSystemEntries(Path.Combine(f.StoreRoot, "tools", "codestead-test"), ".*"));

        var back = store.RollBack("codestead-test");
        Assert.Equal("0.2.0", back!.Version);
        Assert.Equal("0.2.0", store.Installed("codestead-test")!.Version);

        Assert.Single(store.All());
        store.Uninstall("codestead-test");
        Assert.Null(store.Installed("codestead-test"));
        Assert.Empty(store.All());
    }

    [Fact(DisplayName = "fel kontrollsumma eller storlek installerar ingenting och rör inte den gamla versionen")]
    public async Task RejectsBadDownloads()
    {
        using var f = new Fixture();
        var store = new ToolStore(f.StoreRoot);
        var (_, good) = f.Package("0.1.0", false);
        await store.InstallAsync(Fixture.Tool("0.1.0", good), good, Http);

        var (_, a2) = f.Package("0.2.0", false);
        var wrongHash = new CatalogAsset { Url = a2.Url, Sha256 = new string('a', 64), Size = a2.Size, Executable = a2.Executable };
        await Assert.ThrowsAsync<InvalidDataException>(() => store.InstallAsync(Fixture.Tool("0.2.0", wrongHash), wrongHash, Http));
        var tooSmall = new CatalogAsset { Url = a2.Url, Sha256 = a2.Sha256, Size = a2.Size - 1, Executable = a2.Executable };
        await Assert.ThrowsAsync<InvalidDataException>(() => store.InstallAsync(Fixture.Tool("0.2.0", tooSmall), tooSmall, Http));
        var tooBig = new CatalogAsset { Url = a2.Url, Sha256 = a2.Sha256, Size = a2.Size + 1, Executable = a2.Executable };
        await Assert.ThrowsAsync<InvalidDataException>(() => store.InstallAsync(Fixture.Tool("0.2.0", tooBig), tooBig, Http));
        var noExe = new CatalogAsset { Url = a2.Url, Sha256 = a2.Sha256, Size = a2.Size, Executable = "missing" };
        await Assert.ThrowsAsync<InvalidDataException>(() => store.InstallAsync(Fixture.Tool("0.2.0", noExe), noExe, Http));

        var current = store.Installed("codestead-test");
        Assert.Equal("0.1.0", current!.Version);
        Assert.True(File.Exists(current.ExecutablePath));
        Assert.Equal(new[] { "0.1.0", "current.json" }, Directory.GetFileSystemEntries(Path.Combine(f.StoreRoot, "tools", "codestead-test")).Select(Path.GetFileName).Order());
    }

    [Fact(DisplayName = "arkiv som försöker skriva utanför installationsmappen stoppas")]
    public async Task RejectsPathTraversal()
    {
        using var f = new Fixture();
        var file = Path.Combine(f.Dir, "evil.zip");
        using (var zip = ZipFile.Open(file, ZipArchiveMode.Create))
        {
            zip.CreateEntry("tool.exe");
            zip.CreateEntry("../../evil.txt");
        }
        var bytes = File.ReadAllBytes(file);
        var asset = new CatalogAsset { Url = new Uri(file).AbsoluteUri, Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes)), Size = bytes.Length, Executable = "tool.exe" };
        var store = new ToolStore(f.StoreRoot);
        await Assert.ThrowsAnyAsync<IOException>(() => store.InstallAsync(Fixture.Tool("0.1.0", asset), asset, Http));
        Assert.False(File.Exists(Path.Combine(f.StoreRoot, "evil.txt")));
        Assert.False(File.Exists(Path.Combine(f.StoreRoot, "tools", "evil.txt")));
        Assert.Null(store.Installed("codestead-test"));
    }

    [Fact(DisplayName = "ogiltiga id:n blir aldrig mappnamn")]
    public void SafeIds()
    {
        Assert.True(ToolStore.IsSafeId("codestead-linux"));
        foreach (var bad in new[] { "", "..", "a/b", "A", "-x", "a b", "a\\b" }) Assert.False(ToolStore.IsSafeId(bad), bad);
        Assert.Throws<ArgumentException>(() => new ToolStore("x").Installed("../x"));
    }
}

public class CatalogClientTests
{
    private static readonly HttpClient Http = new();

    private static (Fixture F, CatalogTool Tool) Setup()
    {
        var f = new Fixture();
        var (_, a) = f.Package("0.1.0", false);
        return (f, Fixture.Tool("0.1.0", a));
    }

    [Fact(DisplayName = "hämtar, kontrollerar och sparar katalogen")]
    public async Task Loads()
    {
        var (f, tool) = Setup();
        using var _ = f;
        var url = f.Publish(f.CatalogBytes("2026-01-01T00:00:00Z", tool));
        var client = new CatalogClient(Http, f.Verifier, Path.Combine(f.Dir, "cache"), url);
        var r = await client.LoadAsync();
        Assert.False(r.FromCache);
        Assert.Equal("codestead-test", Assert.Single(r.Catalog.Tools).Id);
        Assert.True(File.Exists(Path.Combine(f.Dir, "cache", "catalog.json")));
    }

    [Fact(DisplayName = "en manipulerad katalog används aldrig")]
    public async Task RejectsTampered()
    {
        var (f, tool) = Setup();
        using var _ = f;
        var good = f.CatalogBytes("2026-01-01T00:00:00Z", tool);
        var evil = f.CatalogBytes("2026-01-02T00:00:00Z", Fixture.Tool("9.9.9", tool.Assets["linux-x64"]));
        var url = f.Publish(evil, f.Sign(good));
        var client = new CatalogClient(Http, f.Verifier, Path.Combine(f.Dir, "cache"), url);
        await Assert.ThrowsAsync<CatalogException>(() => client.LoadAsync());

        // With a good cached copy, the hub keeps using it and reports the problem.
        f.Publish(good);
        await client.LoadAsync();
        f.Publish(evil, f.Sign(good));
        var r = await client.LoadAsync();
        Assert.True(r.FromCache);
        Assert.NotNull(r.Problem);
        Assert.Equal("0.1.0", r.Catalog.Tools[0].Version);
    }

    [Fact(DisplayName = "offline används den senaste kontrollerade katalogen")]
    public async Task Offline()
    {
        var (f, tool) = Setup();
        using var _ = f;
        var url = f.Publish(f.CatalogBytes("2026-01-01T00:00:00Z", tool));
        var client = new CatalogClient(Http, f.Verifier, Path.Combine(f.Dir, "cache"), url);
        await client.LoadAsync();
        File.Delete(url.LocalPath);
        var r = await client.LoadAsync();
        Assert.True(r.FromCache);
        Assert.Single(r.Catalog.Tools);
    }

    [Fact(DisplayName = "en äldre katalog än den senast sedda godtas inte")]
    public async Task NoRollback()
    {
        var (f, tool) = Setup();
        using var _ = f;
        var url = f.Publish(f.CatalogBytes("2026-02-01T00:00:00Z", tool));
        var client = new CatalogClient(Http, f.Verifier, Path.Combine(f.Dir, "cache"), url);
        await client.LoadAsync();
        f.Publish(f.CatalogBytes("2026-01-01T00:00:00Z"));
        var r = await client.LoadAsync();
        Assert.True(r.FromCache);
        Assert.Single(r.Catalog.Tools);
    }
}

public class UninstallTests
{
    [Fact(DisplayName = "avinstallation väntar en stund på filer som fortfarande är öppna (Windows)")]
    public async Task WaitsForLockedFiles()
    {
        // Only Windows refuses to delete a file that is open (that is what happens right after a tool exits).
        Assert.SkipUnless(OperatingSystem.IsWindows(), "Open files only block deletion on Windows.");
        using var f = new Fixture();
        var store = new ToolStore(f.StoreRoot);
        var (_, a) = f.Package("0.1.0", true);
        var t = await store.InstallAsync(Fixture.Tool("0.1.0", a, "win-x64"), a, new HttpClient());
        var stream = File.Open(Path.Combine(t.Directory, "lib", "data.txt"), FileMode.Open, FileAccess.Read, FileShare.None);
        var release = Task.Run(async () =>
        {
            await Task.Delay(700);
            stream.Dispose();
        });
        store.Uninstall("codestead-test");
        await release;
        Assert.Null(store.Installed("codestead-test"));
        Assert.False(Directory.Exists(t.Directory));
    }
}
