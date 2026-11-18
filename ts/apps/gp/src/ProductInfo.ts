/// <reference types="vite/client" />
// Port of Codestead.GP/ProductInfo.cs. The C# app gets the name, id, releases repository and version from
// src/GP/Directory.Build.props (GP's own: name, id, version) and build/Codestead.props (the brand and the releases
// repository) at build time (assembly metadata); here the same files are read with Vite (as raw text), so they stay
// the only place where these live. Used by the renderer and by the Electron main process.

import type { ProductMeta } from "@codestead/common";
import repoProps from "../../../../build/Codestead.props?raw";
import gpProps from "../../../../src/GP/Directory.Build.props?raw";

/** Both files, GP's last (as MSBuild imports them). */
const props = repoProps + "\n" + gpProps;

/** A property of the props files, with its $(Other) references filled in. */
export function propsValue(xml: string, name: string): string {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  if (m === null) throw new Error(`The props files have no ${name}`);
  return m[1]!.replace(/\$\((\w+)\)/g, (_, other: string) => propsValue(xml, other));
}

/**
 * The version: the release workflow passes the full version (C#: -p:Version=x.y.z; here VITE_CODESTEAD_VERSION at
 * build time); local builds are x.y.0, as in Codestead.GP.csproj.
 */
function version(): string {
  const full = (import.meta.env as Record<string, string | undefined>)["VITE_CODESTEAD_VERSION"];
  return full !== undefined && full !== "" ? full : `${propsValue(props, "CodesteadGPVersion")}.0`;
}

/** Product name, tool id and version – they come from src/GP/Directory.Build.props. */
export const ProductInfo = {
  meta: {
    name: propsValue(props, "CodesteadGPName"),
    id: propsValue(props, "CodesteadGPId"),
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
