using System.Security.Cryptography;

namespace Codestead.Hub.Core;

/// <summary>
/// Checks the signature of catalog.json. The release workflow signs the exact bytes of the file with an
/// ECDSA P-256 key (SHA-256, DER signature, base64 in catalog.json.sig); the hub has the public key built in
/// (build/catalog-signing.pub.pem). A catalog whose signature does not match is never used.
/// </summary>
public sealed class CatalogVerifier
{
    private readonly ECDsa? key;

    /// <param name="publicKeyPem">"-----BEGIN PUBLIC KEY-----" PEM, or null/empty when no key is configured.</param>
    public CatalogVerifier(string? publicKeyPem)
    {
        if (string.IsNullOrWhiteSpace(publicKeyPem) || !publicKeyPem.Contains("BEGIN PUBLIC KEY")) return;
        key = ECDsa.Create();
        key.ImportFromPem(publicKeyPem);
        if (key.KeySize != 256) throw new CryptographicException("The catalog key must be ECDSA P-256.");
    }

    public bool HasKey => key is not null;

    /// <summary>Throws <see cref="CatalogException"/> unless <paramref name="signatureBase64"/> is a valid signature of <paramref name="data"/>.</summary>
    public void Verify(byte[] data, string signatureBase64)
    {
        if (key is null) throw new CatalogException("This build of the hub has no catalog key, so it cannot trust any catalog.");
        byte[] sig;
        try
        {
            sig = Convert.FromBase64String(signatureBase64.Trim());
        }
        catch (FormatException)
        {
            throw new CatalogException("The catalog signature is not valid base64.");
        }
        bool ok;
        try
        {
            ok = key.VerifyData(data, sig, HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
        }
        catch (CryptographicException)
        {
            ok = false;
        }
        if (!ok) throw new CatalogException("The catalog signature is wrong – the catalog has been changed or damaged and is not used.");
    }
}
