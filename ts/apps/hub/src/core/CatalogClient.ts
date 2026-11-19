import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog } from "./Catalog.js";
import { CatalogException } from "./CatalogException.js";
import type { CatalogVerifier } from "./CatalogVerifier.js";
import { messageOf } from "./Errors.js";
import type { HttpClient } from "./Http.js";

/** The result of {@link CatalogClient.load}. */
export interface CatalogResult {
  catalog: Catalog;
  fromCache: boolean;
  problem: string | null;
}

/**
 * Fetches catalog.json and its signature, checks the signature and keeps the last good catalog on disk,
 * so the hub can still show and start installed tools when it is offline.
 */
export class CatalogClient {
  /** Where the release workflow publishes the catalog (a fixed release "catalog" in the releases repo). */
  static defaultUrl(releasesRepo: string): URL {
    return new URL(`https://github.com/${releasesRepo}/releases/download/catalog/catalog.json`);
  }

  private readonly url: URL;

  constructor(
    private readonly http: HttpClient,
    private readonly verifier: CatalogVerifier,
    private readonly cacheDir: string,
    url: URL | string,
  ) {
    this.url = typeof url === "string" ? new URL(url) : url;
  }

  private get cachedCatalog(): string {
    return join(this.cacheDir, "catalog.json");
  }

  private get cachedSignature(): string {
    return join(this.cacheDir, "catalog.json.sig");
  }

  /**
   * Loads the catalog. Network problems fall back to the cached copy (fromCache = true, problem says why).
   * A catalog with a wrong signature is never used; if there is no usable cached copy either, it throws.
   */
  async load(): Promise<CatalogResult> {
    const cached = this.tryCached();
    let data: Uint8Array;
    let sig: string;
    try {
      data = await this.read(this.url);
      sig = Buffer.from(await this.read(new URL(this.url.href + ".sig"))).toString("ascii");
    } catch (e) {
      // HttpRequestException, IOException or a timeout: the network (or the file) could not be read.
      if (cached !== null) return { catalog: cached, fromCache: true, problem: messageOf(e) };
      throw new CatalogException("The tool list could not be downloaded. Check the internet connection.", e);
    }

    let fresh: Catalog;
    try {
      this.verifier.verify(data, sig);
      fresh = Catalog.parse(data);
    } catch (e) {
      if (e instanceof CatalogException && cached !== null) return { catalog: cached, fromCache: true, problem: e.message };
      throw e;
    }
    // An older catalog than the one already seen (replayed by someone) is not allowed to go back in time.
    if (cached !== null && compareOrdinal(fresh.generated, cached.generated) < 0) return { catalog: cached, fromCache: true, problem: null };

    await mkdir(this.cacheDir, { recursive: true });
    await writeFile(this.cachedCatalog, data);
    await writeFile(this.cachedSignature, sig, "utf8");
    return { catalog: fresh, fromCache: false, problem: null };
  }

  private tryCached(): Catalog | null {
    try {
      if (!existsSync(this.cachedCatalog) || !existsSync(this.cachedSignature)) return null;
      const data = readFileSync(this.cachedCatalog);
      this.verifier.verify(data, readFileSync(this.cachedSignature, "utf8"));
      return Catalog.parse(data);
    } catch (e) {
      if (e instanceof CatalogException || isIOError(e)) return null;
      throw e;
    }
  }

  private async read(u: URL): Promise<Uint8Array> {
    return u.protocol === "file:" ? await readFile(fileURLToPath(u)) : await this.http.getBytes(u.href);
  }
}

/** string.CompareOrdinal: by UTF-16 code units. */
export function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A Node file system error (IOException in .NET). */
export function isIOError(e: unknown): boolean {
  return e instanceof Error && typeof (e as NodeJS.ErrnoException).code === "string";
}
