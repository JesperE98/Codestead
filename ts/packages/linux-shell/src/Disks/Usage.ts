// Port of Disks/Usage.cs – disk model: size, used and available space of a file system.

/** The file system's size, used and available in bytes. */
export interface Usage {
  size: number;
  used: number;
  avail: number;
}
