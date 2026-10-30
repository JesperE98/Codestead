namespace Codestead.Hub.Core;

/// <summary>
/// Fetches catalog.json and its signature, checks the signature and keeps the last good catalog on disk,
/// so the hub can still show and start installed tools when it is offline.
/// </summary>
public sealed class CatalogClient
{
    /// <summary>Where the release workflow publishes the catalog (a fixed release "catalog" in the releases repo).</summary>
    public static Uri DefaultUrl(string releasesRepo) => new($"https://github.com/{releasesRepo}/releases/download/catalog/catalog.json");

    private readonly HttpClient http;
    private readonly CatalogVerifier verifier;
    private readonly string cacheDir;
    private readonly Uri url;

    public CatalogClient(HttpClient http, CatalogVerifier verifier, string cacheDir, Uri url)
    {
        this.http = http;
        this.verifier = verifier;
        this.cacheDir = cacheDir;
        this.url = url;
    }

    private string CachedCatalog => Path.Combine(cacheDir, "catalog.json");
    private string CachedSignature => Path.Combine(cacheDir, "catalog.json.sig");

    public sealed record Result(Catalog Catalog, bool FromCache, string? Problem);

    /// <summary>
    /// Loads the catalog. Network problems fall back to the cached copy (FromCache = true, Problem says why).
    /// A catalog with a wrong signature is never used; if there is no usable cached copy either, it throws.
    /// </summary>
    public async Task<Result> LoadAsync(CancellationToken ct = default)
    {
        var cached = TryCached();
        byte[] data;
        string sig;
        try
        {
            data = await ReadAsync(url, ct);
            sig = System.Text.Encoding.ASCII.GetString(await ReadAsync(new Uri(url + ".sig"), ct));
        }
        catch (Exception e) when (e is HttpRequestException or IOException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            if (cached is not null) return new Result(cached, true, e.Message);
            throw new CatalogException("The tool list could not be downloaded. Check the internet connection.", e);
        }

        Catalog fresh;
        try
        {
            verifier.Verify(data, sig);
            fresh = Catalog.Parse(data);
        }
        catch (CatalogException e)
        {
            if (cached is not null) return new Result(cached, true, e.Message);
            throw;
        }
        // An older catalog than the one already seen (replayed by someone) is not allowed to go back in time.
        if (cached is not null && string.CompareOrdinal(fresh.Generated, cached.Generated) < 0)
            return new Result(cached, true, null);

        Directory.CreateDirectory(cacheDir);
        await File.WriteAllBytesAsync(CachedCatalog, data, ct);
        await File.WriteAllTextAsync(CachedSignature, sig, ct);
        return new Result(fresh, false, null);
    }

    private Catalog? TryCached()
    {
        try
        {
            if (!File.Exists(CachedCatalog) || !File.Exists(CachedSignature)) return null;
            var data = File.ReadAllBytes(CachedCatalog);
            verifier.Verify(data, File.ReadAllText(CachedSignature));
            return Catalog.Parse(data);
        }
        catch (Exception e) when (e is CatalogException or IOException)
        {
            return null;
        }
    }

    private async Task<byte[]> ReadAsync(Uri u, CancellationToken ct) =>
        u.IsFile ? await File.ReadAllBytesAsync(u.LocalPath, ct) : await http.GetByteArrayAsync(u, ct);
}
