import productsFile from "../../../../packaging/products.json" with { type: "json" };

/** A product's name, id, version and releases repository, as the app shows and uses them. */
export interface ProductMeta {
  readonly name: string;
  readonly id: string;
  readonly releasesRepo: string;
  readonly version: string;
}

/**
 * A product of packaging/products.json – the only place where the products' names, ids, executables and versions
 * (major.minor; the release adds the patch number) live. The release workflow (packaging/plan.py) and the build
 * scripts read the same file.
 */
export interface ProductEntry {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  /** The title of its releases in the releases repository ("Codestead hub"). */
  readonly title: string;
  readonly summary: string;
  /** "0.6": the release workflow gives every release the next patch number (0.6.0, 0.6.1 …); local builds are x.y.0. */
  readonly majorMinor: string;
  /** The executable's name (Codestead.Linux), in the packages, the installations and the hub's catalog. */
  readonly exe: string;
  /** The app's folder in the repository (ts/apps/linux). */
  readonly app: string;
  /** The product's own folder: content, changelog.json, description.json, release-notes.md. */
  readonly dir: string;
}

const file = productsFile as { releasesRepo: string; products: ProductEntry[] };

export const Products = {
  /** The public repository the apps are released in and update from. */
  releasesRepo: file.releasesRepo,

  all: file.products as readonly ProductEntry[],

  get(key: string): ProductEntry {
    const p = file.products.find((x) => x.key === key);
    if (p === undefined) throw new Error(`packaging/products.json has no product "${key}".`);
    return p;
  },

  /**
   * The product's name, id, releases repository and version. `fullVersion` is the version the release build passes
   * (VITE_CODESTEAD_VERSION); without it (local builds, tests) the version is major.minor.0.
   */
  meta(key: string, fullVersion?: string): ProductMeta {
    const p = Products.get(key);
    return {
      name: p.name,
      id: p.id,
      releasesRepo: file.releasesRepo,
      version: fullVersion !== undefined && fullVersion !== "" ? fullVersion : `${p.majorMinor}.0`,
    };
  },
};
