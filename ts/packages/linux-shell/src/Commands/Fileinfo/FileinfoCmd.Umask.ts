// Port of Commands/Fileinfo/FileinfoCmd.Umask.cs – the umask command: show or set which permissions new files do
// not get.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as FsCmd from "../Fs/FsCmd.js";
import { octal } from "./FileinfoCmd.js";

const umaskOctalRe = /^[0-7]{1,4}$/;

/** The umask as symbols: u=rwx,g=rx,o=rx (what new files may have). */
function symbolicUmask(umask: number): string {
  const part = (who: string, shift: number): string => {
    const allowed = ~(umask >> shift) & 7;
    return `${who}=${(allowed & 4) !== 0 ? "r" : ""}${(allowed & 2) !== 0 ? "w" : ""}${(allowed & 1) !== 0 ? "x" : ""}`;
  };
  return `${part("u", 6)},${part("g", 3)},${part("o", 0)}`;
}

export const umask: CommandDef = {
  name: "umask",
  builtin: true,
  summary: "Visar eller ändrar vilka rättigheter nya filer inte får",
  summaryEn: "Show or set which permissions new files do not get",
  man: `NAMN
       umask - rättigheter som tas bort från nya filer

SYNOPSIS
       umask [-S] [MASK]

BESKRIVNING
       Nya filer skapas med rw-rw-rw- (666) och nya kataloger med
       rwxrwxrwx (777), minus de bitar som står i umask. Med den vanliga
       umask 022 tas skrivrätten bort för gruppen och övriga: filer får
       644 och kataloger 755. Med umask 077 får bara du komma åt det du
       skapar (600 och 700).

       Ändringen gäller bara skalet du står i. Lägg umask-raden i
       ~/.bashrc för att den ska gälla varje gång.

FLAGGOR
       -S   visa masken som symboler (vad nya filer får): u=rwx,g=rx,o=rx

EXEMPEL
       umask
       umask 077
       umask -S`,
  manEn: `NAME
       umask - permissions removed from new files

SYNOPSIS
       umask [-S] [MASK]

DESCRIPTION
       New files are created with rw-rw-rw- (666) and new directories with
       rwxrwxrwx (777), minus the bits in the umask. With the usual umask
       022, write permission is removed for the group and others: files
       get 644 and directories 755. With umask 077 only you can access
       what you create (600 and 700).

       The change only applies to the shell you are in. Put the umask line
       in ~/.bashrc to make it apply every time.

OPTIONS
       -S   show the mask as symbols (what new files get): u=rwx,g=rx,o=rx

EXAMPLES
       umask
       umask 077
       umask -S`,
  run: (ctx) => {
    const sh = ctx.sh;
    const args = [...ctx.args];
    let symbolic = false;
    while (args.length > 0 && args[0]!.startsWith("-") && args[0]!.length > 1) {
      if (args[0] === "-S") symbolic = true;
      else if (args[0] !== "-p") {
        ctx.err(`bash: umask: ${args[0]}: invalid option\numask: usage: umask [-p] [-S] [mode]\n`);
        return 2;
      }
      args.shift();
    }
    if (args.length === 0) {
      ctx.out(symbolic ? symbolicUmask(sh.vfs.umask) + "\n" : octal(sh.vfs.umask).padStart(4, "0") + "\n");
      return 0;
    }
    const spec = args[0]!;
    if (umaskOctalRe.test(spec)) {
      sh.vfs.umask = Number.parseInt(spec, 8) & Js.oct(777);
      return 0;
    }
    if (/^\p{Nd}*$/u.test(spec)) {
      ctx.err(`bash: umask: ${spec}: octal number out of range\n`);
      return 1;
    }
    // Symbolic: what new files may get, e.g. u=rwx,g=rx,o= (the umask is the opposite).
    const allowed = FsCmd.applyMode(~sh.vfs.umask & Js.oct(777), spec, true);
    if (allowed === null) {
      ctx.err(`bash: umask: \`${spec[0]}': invalid symbolic mode character\n`);
      return 1;
    }
    sh.vfs.umask = ~allowed & Js.oct(777);
    return 0;
  },
};
