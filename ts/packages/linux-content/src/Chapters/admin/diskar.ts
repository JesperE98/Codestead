// Port of Chapters/admin/diskar.cs – the chapter "diskar" (part "admin"). Its place in the course is set by defineChapters() in
// ChapterDefinitions.ts.

import { DisksLib } from "@codestead/linux-shell";
import { cmds, content, outLines, ran, re, w } from "../../Checks.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

export function diskar(): Chapter {
  return new Chapter({
    id: "diskar",
    part: "admin",
    title: "Diskar och filsystem",
    tasks: [
      new ChapterTask({
        id: "df",
        text: "Visa hur mycket plats som är använd och ledig på de monterade filsystemen – med läsbara storlekar (G, M).",
        hint: "`df` visar filsystemen, flaggan `-h` gör storlekarna läsbara: `df -h`.",
        solution: cmds("df -h"),
        check: (c) => ran(c, re(String.raw`^df\b`)) && re(String.raw`\s-\w*h|--human`).test(c.line) && c.output.includes("Mounted on"),
      }),
      new ChapterTask({
        id: "lsblk-f",
        text: "Visa alla diskar och partitioner tillsammans med filsystemens typ, etikett och UUID.",
        hint: "`lsblk` visar diskarna som ett träd. Med `-f` kommer filsystemen med: `lsblk -f`.",
        solution: cmds("lsblk -f"),
        check: (c) => ran(c, re(String.raw`^lsblk\b`)) && c.output.includes("FSTYPE") && c.output.includes("USBSTICK"),
      }),
      new ChapterTask({
        id: "fstab",
        text: "Visa filen `/etc/fstab`, som talar om vad som ska monteras när datorn startar.",
        solution: cmds("cat /etc/fstab"),
        check: (c) => ran(c, re(String.raw`\/etc\/fstab`)) && c.output.includes("UUID="),
      }),
      new ChapterTask({
        id: "uuid",
        text: "Ta reda på UUID för filsystemet som är monterat på `/` – och bara det.",
        hint: "`lsblk -f` visar att `/` ligger på `/dev/sda2`. Fråga sedan `blkid /dev/sda2` – eller låt `findmnt -n -o UUID /` göra allt på en gång.",
        solution: cmds("blkid /dev/sda2"),
        check: (c) => c.exitCode === 0 && outLines(c).length <= 2 && c.output.includes(DisksLib.rootUuid(c.distro)),
      }),
      new ChapterTask({
        id: "montera",
        text: "Skapa monteringspunkten `/mnt/usb` och montera USB-stickan (`/dev/sdb1`) där.",
        hint: "Både att skapa kataloger i `/mnt` och att montera kräver root: `sudo mkdir -p /mnt/usb` och sedan `sudo mount /dev/sdb1 /mnt/usb`.",
        solution: cmds("sudo mkdir -p /mnt/usb", "sudo mount /dev/sdb1 /mnt/usb"),
        check: (c) => c.sh.disks.mounts.some((m) => m.dev === DisksLib.UsbPart && m.target === "/mnt/usb"),
      }),
      new ChapterTask({
        id: "fran-usb",
        text: "Kopiera `{{report}}` från USB-stickan till din hemkatalog.",
        hint: "Stickans filer finns nu i `/mnt/usb`: `cp /mnt/usb/{{report}} ~`.",
        solution: cmds("cp /mnt/usb/{{report}} ~"),
        check: (c) => content(c, "~/{{report}}").startsWith("%PDF"),
      }),
      new ChapterTask({
        id: "till-usb",
        text: "Spara en kopia av `~/{{documents}}/{{fruits}}` på USB-stickan.",
        hint: "Filerna på stickan ägs av root – FAT har inga Linux-rättigheter – så du behöver `sudo`: `sudo cp ~/{{documents}}/{{fruits}} /mnt/usb/`.",
        solution: cmds("sudo cp ~/{{documents}}/{{fruits}} /mnt/usb/"),
        check: (c) => (DisksLib.partitionRoot(c.sh.vfs, c.sh.disks, DisksLib.UsbPart, c.sh.rootUser())?.children?.get(w(c).get("fruits")) ?? null) !== null,
      }),
      new ChapterTask({
        id: "avmontera",
        text: "Avmontera USB-stickan, så att den är säker att dra ut.",
        hint: "`sudo umount /mnt/usb` – utan n! Får du *target is busy* står ditt skal i katalogen: gå därifrån med `cd ~` först.",
        solution: cmds("cd ~", "sudo umount /mnt/usb"),
        check: (c) => ran(c, re(String.raw`\bumount\b`)) && !c.sh.disks.mounts.some((m) => m.dev === DisksLib.UsbPart),
      }),
    ],
  });
}
