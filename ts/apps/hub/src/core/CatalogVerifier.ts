import type { KeyObject } from "node:crypto";
import { catalogPublicKey, checkCatalogSignature } from "@codestead/ui/signed-catalog";
import { CatalogException } from "./CatalogException.js";

/**
 * Checks the signature of catalog.json. The release workflow signs the exact bytes of the file with an
 * ECDSA P-256 key (SHA-256, DER signature, base64 in catalog.json.sig); the hub has the public key built in
 * (build/catalog-signing.pub.pem). A catalog whose signature does not match is never used. The check is the one the
 * apps' own native updates make (ts/packages/ui/src/electron/SignedCatalog.ts).
 */
export class CatalogVerifier {
  private readonly key: KeyObject | null;

  /** @param publicKeyPem "-----BEGIN PUBLIC KEY-----" PEM, or null/empty when no key is configured. */
  constructor(publicKeyPem: string | null | undefined) {
    this.key = catalogPublicKey(publicKeyPem);
  }

  get hasKey(): boolean {
    return this.key !== null;
  }

  /** Throws {@link CatalogException} unless `signatureBase64` is a valid signature of `data`. */
  verify(data: Uint8Array, signatureBase64: string): void {
    if (this.key === null) throw new CatalogException("This build of the hub has no catalog key, so it cannot trust any catalog.");
    const check = checkCatalogSignature(this.key, data, signatureBase64);
    if (check === "not-base64") throw new CatalogException("The catalog signature is not valid base64.");
    if (check !== "ok") throw new CatalogException("The catalog signature is wrong – the catalog has been changed or damaged and is not used.");
  }
}
