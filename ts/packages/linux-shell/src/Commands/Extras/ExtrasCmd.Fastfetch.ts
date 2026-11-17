// Port of Commands/Extras/ExtrasCmd.Fastfetch.cs – the fastfetch command: shows system information with the distro logo.

import { Js } from "../../Js.js";
import * as PackagesLib from "../../Packages/PackagesLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";

const logos = new Map<string, string[]>([
  [
    "ubuntu",
    [
      "            .-/+oossssoo+/-.     ",
      "        `:+ssssssssssssssssss+:` ",
      "      -+ssssssssssssssssssyyssss+-",
      "    .ossssssssssssssssssdMMMNysssso.",
      "   /ssssssssssshdmmNNmmyNMMMMhssssss/",
      "  +ssssssssshmydMMMMMMMNddddyssssssss+",
      " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/",
      " +sssshhhyNMMNyssssssssssssyNMMMysssssss+",
    ],
  ],
  [
    "debian",
    [
      "       _,met$$$$$gg.       ",
      "    ,g$$$$$$$$$$$$$$$P.    ",
      "  ,g$$P\"     \"\"\"Y$$.\".     ",
      " ,$$P'              `$$$.  ",
      "',$$P       ,ggs.     `$$b:",
      "`d$$'     ,$P\"'   .    $$$ ",
      " $$P      d$'     ,    $$P ",
      " $$:      $$.   -    ,d$$' ",
    ],
  ],
  [
    "arch",
    [
      "                  -`                ",
      "                 .o+`               ",
      "                `ooo/               ",
      "               `+oooo:              ",
      "              `+oooooo:             ",
      "              -+oooooo+:            ",
      "            `/:-:++oooo+:           ",
      "           `/++++/+++++++:          ",
    ],
  ],
  [
    "fedora",
    [
      "             .',;::::;,'.          ",
      "         .';:cccccccccccc:;,.      ",
      "      .;cccccccccccccccccccccc;.   ",
      "    .:cccccccccccccccccccccccccc:. ",
      "  .;ccccccccccccc;.:dddl:.;ccccccc;.",
      " .:ccccccccccccc;OWMKOOXMWd;ccccccc:.",
      ".:ccccccccccccc;KMMc;cc;xMMc;ccccccc:.",
      ",cccccccccccccc;MMM.;cc;;WW:;cccccccc,",
    ],
  ],
]);

export const fastfetch: CommandDef = {
  name: "fastfetch",
  summary: "Visar systeminformation med distro-logga",
  man: `NAMN
       fastfetch - visa systeminformation tillsammans med distributionens logga

BESKRIVNING
       En snabb efterföljare till neofetch. Populär i skärmdumpar!`,
  run: (ctx) => {
    const sh = ctx.sh;
    const d = sh.distro;
    const u = sh.currentUser().name;
    const count = PackagesLib.packages.filter((p) => PackagesLib.isInstalled(sh, p)).length;
    const pm = d.family === "debian" ? "dpkg" : d.family === "arch" ? "pacman" : "rpm";
    const info = [
      `${UtilCmd.Color.bold}${u}@${d.hostname}${UtilCmd.Color.reset}`,
      Js.repeat("-", u.length + d.hostname.length + 1),
      `OS: ${d.name} x86_64`,
      `Kernel: Linux ${d.kernel}`,
      "Uptime: 2 hours, 14 mins",
      `Packages: ${Js.num(count + 600)} (${pm})`,
      "Shell: bash 5.2",
      "Terminal: Codestead Linux",
    ];
    const logo = logos.get(d.id) ?? logos.get("debian")!;
    const width = Math.max(...logo.map((l) => l.length));
    const color = `\x1b[1;3${d.family === "arch" ? "6" : d.family === "redhat" ? "4" : "1"}m`;
    for (let i = 0; i < Math.max(logo.length, info.length); i++) {
      ctx.out(`${color}${(i < logo.length ? logo[i]! : "").padEnd(width)}${UtilCmd.Color.reset}  ${i < info.length ? info[i] : ""}\n`);
    }
    return 0;
  },
};
