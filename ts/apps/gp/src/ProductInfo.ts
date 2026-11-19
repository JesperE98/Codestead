/// <reference types="vite/client" />
// The product's name, id, releases repository and version, from packaging/products.json (@codestead/common's
// Products). The release build passes the full version (VITE_CODESTEAD_VERSION, set by packaging/ts/package-app.mjs);
// local builds are x.y.0. Used by the renderer and by the Electron main process.

import { type ProductMeta, Products } from "@codestead/common";

/** Product name, tool id and version – they come from packaging/products.json. */
export const ProductInfo = {
  meta: Products.meta("gp", (import.meta.env as Record<string, string | undefined>)["VITE_CODESTEAD_VERSION"]) satisfies ProductMeta as ProductMeta,

  get name(): string {
    return ProductInfo.meta.name;
  },
  get toolId(): string {
    return ProductInfo.meta.id;
  },
  get releasesRepo(): string {
    return ProductInfo.meta.releasesRepo;
  },
  get version(): string {
    return ProductInfo.meta.version;
  },
};
