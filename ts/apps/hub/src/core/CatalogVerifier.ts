import { createPublicKey, type KeyObject, verify } from "node:crypto";
import { CatalogException } from "./CatalogException.js";

/**
 * Checks the signature of catalog.json. The release workflow signs the exact bytes of the file with an
 * ECDSA P-256 key (SHA-256, DER signature, base64 in catalog.json.sig); the hub has the public key built in
 * (build/catalog-signing.pub.pem). A catalog whose signature does not match is never used.
 */
export class CatalogVerifier {
  private readonly key: KeyObject | null = null;

  /** @param publicKeyPem "-----BEGIN PUBLIC KEY-----" PEM, or null/empty when no key is configured. */
  constructor(publicKeyPem: string | null | undefined) {
    if (publicKeyPem == null || publicKeyPem.trim() === "" || !publicKeyPem.includes("BEGIN PUBLIC KEY")) return;
    const key = createPublicKey(publicKeyPem);
    // C#: ECDsa.ImportFromPem (which refuses other key types) and KeySize == 256.
    const curve = key.asymmetricKeyDetails?.namedCurve ?? "";
    if (key.asymmetricKeyType !== "ec" || !curve.includes("256")) throw new Error("The catalog key must be ECDSA P-256.");
    this.key = key;
  }

  get hasKey(): boolean {
    return this.key !== null;
  }

  /** Throws {@link CatalogException} unless `signatureBase64` is a valid signature of `data`. */
  verify(data: Uint8Array, signatureBase64: string): void {
    if (this.key === null) throw new CatalogException("This build of the hub has no catalog key, so it cannot trust any catalog.");
    const sig = fromBase64Strict(signatureBase64.trim());
    if (sig === null) throw new CatalogException("The catalog signature is not valid base64.");
    let ok: boolean;
    try {
      ok = verify("sha256", data, { key: this.key, dsaEncoding: "der" }, sig);
    } catch {
      ok = false;
    }
    if (!ok) throw new CatalogException("The catalog signature is wrong – the catalog has been changed or damaged and is not used.");
  }
}

/**
 * Convert.FromBase64String: white space is ignored, the rest must be base64 characters with at most two "=" at the
 * end and a length that is a multiple of 4 (Buffer.from(…, "base64") would quietly skip anything else).
 */
function fromBase64Strict(s: string): Buffer | null {
  const compact = s.replace(/[ \t\r\n]/g, "");
  if (compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  return Buffer.from(compact, "base64");
}
