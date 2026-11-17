// Port of Disks/DiskState.cs – disk model: the saved state of all disks and mounts.

import type { Disk } from "./Disk.js";
import type { Mount } from "./Mount.js";

export interface DiskState {
  disks: Disk[];
  mounts: Mount[];
}
