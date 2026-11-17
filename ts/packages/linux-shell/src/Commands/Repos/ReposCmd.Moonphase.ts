// Port of Commands/Repos/ReposCmd.Moonphase.cs – the moonphase command: shows the phase of the moon (made-up
// program from a PPA, the AUR and COPR).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { moonAge, Synodic } from "./ReposCmd.js";

const phases = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];

function moonArt(age: number): string {
  const angle = (2 * Math.PI * age) / Synodic;
  const waxing = age < Synodic / 2;
  const R = 5;
  const rows: string[] = [];
  for (let yi = 0; yi < 2 * R; yi++) {
    const y = yi - R + 0.5;
    const w = Math.sqrt(R * R - y * y);
    let row = "";
    for (let xi = -2 * R; xi <= 2 * R; xi++) {
      const x = xi / 2.0;
      if (Math.abs(x) > w + 0.25) {
        row += " ";
        continue;
      }
      const t = w * Math.cos(angle);
      const lit = waxing ? x > t : x < -t;
      row += lit ? "@" : ".";
    }
    rows.push(row.trimEnd());
  }
  return rows.join("\n") + "\n";
}

export const moonphase: CommandDef = {
  name: "moonphase",
  summary: "Visar månens fas (påhittat program från PPA, AUR och COPR)",
  summaryEn: "Shows the phase of the moon (made-up program from a PPA, the AUR and COPR)",
  man: `NAMN
       moonphase - visa månens fas i terminalen

SYNOPSIS
       moonphase [--version]

BESKRIVNING
       Ritar månen som den ser ut i dag och berättar hur stor del som är
       upplyst. Ett påhittat program som finns i de extra förråden
       ppa:lunatool/moonphase, AUR och COPR-projektet lunatool/moonphase.`,
  manEn: `NAME
       moonphase - show the phase of the moon in the terminal

SYNOPSIS
       moonphase [--version]

DESCRIPTION
       Draws the moon as it looks today and tells you how much of it is
       lit. A made-up program that lives in the extra repositories
       ppa:lunatool/moonphase, the AUR and the COPR project
       lunatool/moonphase.`,
  run: (ctx) => {
    if (ctx.args.length > 0 && (ctx.args[0] === "--version" || ctx.args[0] === "-V")) {
      ctx.out(`moonphase ${(ctx.sh.installed.get("moonphase") ?? "1.4.2").split("-")[0]}\n`);
      return 0;
    }
    if (ctx.args.length !== 0) {
      ctx.err(`moonphase: unknown option '${ctx.args[0]}'\nUsage: moonphase [--version]\n`);
      return 2;
    }
    const now = Js.now();
    const age = moonAge(now);
    const illum = Math.floor(((1 - Math.cos((2 * Math.PI * age) / Synodic)) / 2) * 100 + 0.5);
    const name = phases[Math.floor(((age + Synodic / 16) % Synodic) / (Synodic / 8))];
    const toFull = (Synodic / 2 - age + Synodic) % Synodic;
    // DateTimeOffset.FromUnixTimeMilliseconds(...).UtcDateTime.ToString("yyyy-MM-dd")
    const full = new Date(Math.trunc(now + toFull * 86_400_000)).toISOString().slice(0, 10);
    ctx.out(`${moonArt(age)}\n${name}, ${Js.num(illum)}% illuminated (day ${Js.toFixed(age, 1)} of ${Js.toFixed(Synodic, 1)})\nNext full moon: ${full}\n`);
    return 0;
  },
};
