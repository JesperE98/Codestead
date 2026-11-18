import { type ProductMeta, Products } from "@codestead/common";

/** Name, id, version and releases repository – from packaging/products.json (the release build passes the full version). */
export const HubInfo = {
  meta: Products.meta("hub", import.meta.env.VITE_CODESTEAD_HUB_VERSION) satisfies ProductMeta as ProductMeta,

  get name(): string {
    return this.meta.name;
  },
  get id(): string {
    return this.meta.id;
  },
  get releasesRepo(): string {
    return this.meta.releasesRepo;
  },
  get version(): string {
    return this.meta.version;
  },
};
