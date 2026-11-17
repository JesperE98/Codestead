// Port of Distros/DistrosLib.cs (src/shell/distros.ts) – the distributions the simulator can pretend to be.
// A "family" shares package manager and package format.

import type { Distro, Family } from "./Distro.js";
import type { FamilyInfo } from "./FamilyInfo.js";

export const families = new Map<Family, FamilyInfo>([
  [
    "debian",
    {
      id: "debian",
      name: "Debian-familjen",
      packageManager: "apt",
      packageFormat: ".deb",
      members: "Debian, Ubuntu, Linux Mint, Pop!_OS, Raspberry Pi OS",
    },
  ],
  [
    "arch",
    {
      id: "arch",
      name: "Arch-familjen",
      packageManager: "pacman",
      packageFormat: ".pkg.tar.zst",
      members: "Arch Linux, Manjaro, EndeavourOS, CachyOS, SteamOS",
    },
  ],
  [
    "redhat",
    {
      id: "redhat",
      name: "Red Hat-familjen",
      packageManager: "dnf",
      packageFormat: ".rpm",
      members: "Fedora, Red Hat Enterprise Linux, Rocky Linux, AlmaLinux, CentOS Stream",
    },
  ],
]);

export const distros: Distro[] = [
  {
    id: "ubuntu",
    name: "Ubuntu 24.04 LTS",
    family: "debian",
    hostname: "ubuntu",
    version: "24.04",
    codename: "noble",
    kernel: "6.8.0-71-generic",
    packageManager: "apt",
    adminGroup: "sudo",
    adminGid: 27,
    promptStyle: "ubuntu",
    accent: "#e95420",
    mirrors: ["http://archive.ubuntu.com/ubuntu noble InRelease", "http://archive.ubuntu.com/ubuntu noble-updates InRelease", "http://security.ubuntu.com/ubuntu noble-security InRelease"],
    osRelease: "PRETTY_NAME=\"Ubuntu 24.04.3 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nVERSION=\"24.04.3 LTS (Noble Numbat)\"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL=\"https://www.ubuntu.com/\"\nSUPPORT_URL=\"https://help.ubuntu.com/\"\nBUG_REPORT_URL=\"https://bugs.launchpad.net/ubuntu/\"\nUBUNTU_CODENAME=noble\n",
    motd: "Welcome to Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-71-generic x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n",
  },
  {
    id: "debian",
    name: "Debian 13 (trixie)",
    family: "debian",
    hostname: "debian",
    version: "13",
    codename: "trixie",
    kernel: "6.12.48+deb13-amd64",
    packageManager: "apt",
    adminGroup: "sudo",
    adminGid: 27,
    promptStyle: "debian",
    accent: "#d70a53",
    mirrors: ["http://deb.debian.org/debian trixie InRelease", "http://deb.debian.org/debian trixie-updates InRelease", "http://security.debian.org/debian-security trixie-security InRelease"],
    osRelease: "PRETTY_NAME=\"Debian GNU/Linux 13 (trixie)\"\nNAME=\"Debian GNU/Linux\"\nVERSION_ID=\"13\"\nVERSION=\"13 (trixie)\"\nVERSION_CODENAME=trixie\nID=debian\nHOME_URL=\"https://www.debian.org/\"\nSUPPORT_URL=\"https://www.debian.org/support\"\nBUG_REPORT_URL=\"https://bugs.debian.org/\"\n",
    motd: "Linux debian 6.12.48+deb13-amd64 #1 SMP PREEMPT_DYNAMIC Debian x86_64\n\nThe programs included with the Debian GNU/Linux system are free software;\nthe exact distribution terms for each program are described in the\nindividual files in /usr/share/doc/*/copyright.\n",
  },
  {
    id: "arch",
    name: "Arch Linux",
    family: "arch",
    hostname: "archlinux",
    version: "rolling",
    kernel: "6.17.5-arch1-1",
    packageManager: "pacman",
    adminGroup: "wheel",
    adminGid: 998,
    promptStyle: "bracket",
    accent: "#1793d1",
    mirrors: [],
    osRelease: "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\nBUILD_ID=rolling\nANSI_COLOR=\"38;2;23;147;209\"\nHOME_URL=\"https://archlinux.org/\"\nDOCUMENTATION_URL=\"https://wiki.archlinux.org/\"\nSUPPORT_URL=\"https://bbs.archlinux.org/\"\nBUG_REPORT_URL=\"https://gitlab.archlinux.org/groups/archlinux/-/issues\"\nLOGO=archlinux-logo\n",
    motd: "",
  },
  {
    id: "fedora",
    name: "Fedora Linux 43",
    family: "redhat",
    hostname: "fedora",
    version: "43",
    kernel: "6.17.4-300.fc43.x86_64",
    packageManager: "dnf",
    adminGroup: "wheel",
    adminGid: 10,
    promptStyle: "bracket",
    accent: "#51a2da",
    mirrors: [],
    osRelease: "NAME=\"Fedora Linux\"\nVERSION=\"43 (Workstation Edition)\"\nID=fedora\nVERSION_ID=43\nPRETTY_NAME=\"Fedora Linux 43 (Workstation Edition)\"\nHOME_URL=\"https://fedoraproject.org/\"\nDOCUMENTATION_URL=\"https://docs.fedoraproject.org/\"\nSUPPORT_URL=\"https://ask.fedoraproject.org/\"\nBUG_REPORT_URL=\"https://bugzilla.redhat.com/\"\nVARIANT=\"Workstation Edition\"\nVARIANT_ID=workstation\n",
    motd: "",
  },
];

export function getDistro(id: string): Distro {
  return distros.find((d) => d.id === id) ?? distros[0]!;
}
