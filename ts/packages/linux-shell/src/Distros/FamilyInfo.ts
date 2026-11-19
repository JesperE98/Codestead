// Port of Distros/FamilyInfo.cs – a distribution family: package manager and package format.

import type { Family } from "./Distro.js";

export interface FamilyInfo {
  id: Family;
  name: string;
  packageManager: string;
  packageFormat: string;
  members: string;
}
