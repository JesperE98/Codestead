// Port of Commands/System/SystemCmd.Uname.cs – the uname command: shows information about the system and the kernel.

import { simple } from "./SystemCmd.js";

export const uname = simple(
  "uname",
  "Visar information om systemet och kärnan",
  (ctx) => {
    const d = ctx.sh.distro;
    const flags = new Set<string>(ctx.args.flatMap((a) => (a.startsWith("-") ? [...a.slice(1)] : [])));
    const parts: string[] = [];
    const all = flags.has("a");
    if (all || flags.has("s") || flags.size === 0) parts.push("Linux");
    if (all || flags.has("n")) parts.push(d.hostname);
    if (all || flags.has("r")) parts.push(d.kernel);
    if (all || flags.has("v")) parts.push("#1 SMP PREEMPT_DYNAMIC");
    if (all || flags.has("m")) parts.push("x86_64");
    if (all || flags.has("o")) parts.push("GNU/Linux");
    ctx.out(parts.join(" ") + "\n");
    return 0;
  },
  `NAMN
       uname - visa systeminformation

FLAGGOR
       -a    allt
       -r    kärnans version (kernel release)
       -n    värdnamnet
       -m    hårdvaruarkitektur (t.ex. x86_64)`,
);
