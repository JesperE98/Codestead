/// <reference types="vite/client" />
// Port of Codestead.Linux/ProductInfo.cs. The C# app gets the name, id, releases repository and version from
// build/Codestead.props at build time (assembly metadata); here the same file is read with Vite (as raw text), so
// it stays the only place where they live. Used by the renderer and by the Electron main process.

import type { ProductMeta } from "@codestead/common";
import props from "../../../../build/Codestead.props?raw";

/** A property of build/Codestead.props, with its $(Other) references filled in. */
export function propsValue(xml: string, name: string): string {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  if (m === null) throw new Error(`build/Codestead.props has no ${name}`);
  return m[1]!.replace(/\$\((\w+)\)/g, (_, other: string) => propsValue(xml, other));
}

/**
 * The version: the release workflow passes the full version (C#: -p:Version=x.y.z; here VITE_CODESTEAD_VERSION at
 * build time); local builds are x.y.0, as in Codestead.Linux.csproj.
 */
function version(): string {
  const full = (import.meta.env as Record<string, string | undefined>)["VITE_CODESTEAD_VERSION"];
  return full !== undefined && full !== "" ? full : `${propsValue(props, "CodesteadLinuxVersion")}.0`;
}

/** Product name, tool id and version – they come from build/Codestead.props. */
export const ProductInfo = {
  meta: {
    name: propsValue(props, "CodesteadLinuxName"),
    id: propsValue(props, "CodesteadLinuxId"),
    releasesRepo: propsValue(props, "CodesteadReleasesRepo"),
    version: version(),
  } satisfies ProductMeta as ProductMeta,

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
