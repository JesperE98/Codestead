// Port of Distros/Distro.cs – a distribution the simulator can pretend to be.

/** "debian" | "arch" | "redhat" (a plain string in C#, a global alias for the TypeScript string union). */
export type Family = string;

export interface Distro {
  id: string;
  name: string;
  family: Family;
  hostname: string;
  version: string;
  codename?: string | null;
  kernel: string;
  /** "apt", "pacman" or "dnf". */
  packageManager: string;
  /** The group that may use sudo: "sudo" or "wheel". */
  adminGroup: string;
  adminGid: number;
  /** What the prompt looks like by default: "ubuntu", "debian" or "bracket". */
  promptStyle: string;
  osRelease: string;
  motd: string;
  /** Mirror servers shown by apt update. */
  mirrors: string[];
  accent: string;
}
