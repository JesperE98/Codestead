import type { ProductMeta } from "@codestead/common";
import props from "../../../../build/Codestead.props?raw";

/** A property of build/Codestead.props, with its $(Other) references filled in. */
function property(name: string): string {
  const m = props.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  if (!m) throw new Error(`build/Codestead.props has no ${name}.`);
  return m[1]!.replace(/\$\((\w+)\)/g, (_all, other: string) => property(other)).trim();
}

/** Name, id, version and releases repository – from build/Codestead.props. */
export const HubInfo = {
  meta: {
    name: property("CodesteadHubName"),
    id: property("CodesteadHubId"),
    releasesRepo: property("CodesteadReleasesRepo"),
    // Codestead.Hub.csproj: <Version>$(CodesteadHubVersion).0</Version>, unless the release passes the full version.
    version: import.meta.env.VITE_CODESTEAD_HUB_VERSION || property("CodesteadHubVersion") + ".0",
  } satisfies ProductMeta as ProductMeta,

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
