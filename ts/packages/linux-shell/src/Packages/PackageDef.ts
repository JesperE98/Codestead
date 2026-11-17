// Port of Packages/PackageDef.cs – one package in the package database.

import type { Family } from "../Distros/Distro.js";
import type { Obj } from "../Js.js";

export interface PackageDef {
  id: string;
  /** Package name per family. If the family is missing, the package does not exist there. */
  names: Obj<string>;
  version: Obj<string>;
  /** Version that becomes available after the package lists have been updated. */
  newVersion?: Obj<string> | null;
  description: string;
  sizeKb: number;
  /** Commands the package installs in /usr/bin. */
  provides: string[];
  /** Preinstalled in these families. */
  base?: Family[] | null;
  /** System critical – the package manager refuses to remove it. */
  essential?: boolean | null;
  /** Arch repository ("core"/"extra"). */
  archRepo?: string | null;
  /** Shells the package adds to /etc/shells. */
  shells?: string[] | null;
  /** Preinstalled only in these distributions (e.g. snapd in Ubuntu but not in Debian). */
  baseDistros?: string[] | null;
  /**
   * Exists only in an extra repository: "ppa:user/name" (Debian/Ubuntu), "aur" (Arch)
   * or "copr:user/project" (Fedora). See Extrarepo/ExtrarepoLib.ts and Commands/Repos/.
   */
  extraRepo?: Obj<string> | null;
}
