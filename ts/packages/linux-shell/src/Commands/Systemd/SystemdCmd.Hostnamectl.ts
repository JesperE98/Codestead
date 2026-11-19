// Port of Commands/Systemd/SystemdCmd.Hostnamectl.cs – the hostnamectl command: show or change the computer's
// hostname and system information.

import type { CommandDef } from "../../Types/CommandDef.js";
import { Auth, isRoot, sudoTip, tip } from "./SystemdCmd.js";

const hostnameRe = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})$/;
const prettyNameRe = /PRETTY_NAME="([^"]+)"/;

export const hostnamectl: CommandDef = {
  name: "hostnamectl",
  summary: "Visar eller ändrar datorns namn och systeminformation",
  summaryEn: "Show or change the computer's hostname and system information",
  man: `NAMN
       hostnamectl - visa eller ändra datorns namn

SYNOPSIS
       hostnamectl [status]
       sudo hostnamectl set-hostname NAMN

BESKRIVNING
       Utan argument visas datorns namn, operativsystem, kärna och
       arkitektur. set-hostname skriver det nya namnet till /etc/hostname.`,
  manEn: `NAME
       hostnamectl - show or change the computer's hostname

SYNOPSIS
       hostnamectl [status]
       sudo hostnamectl set-hostname NAME

DESCRIPTION
       Without arguments the hostname, operating system, kernel and
       architecture are shown. set-hostname writes the new name to
       /etc/hostname.`,
  run: (ctx) => {
    const sh = ctx.sh;
    const ops = ctx.args.filter((a) => !a.startsWith("-"));
    const verb = ops.length > 0 ? ops[0]! : "status";
    const root = sh.rootUser();
    const hostname = (sh.vfs.tryLookup("/etc/hostname", root)?.content ?? sh.distro.hostname).trim();
    const arg1 = ops.length > 1 ? ops[1]! : null;
    if (verb === "hostname" && (arg1 === null || arg1 === "")) {
      ctx.out(hostname + "\n");
      return 0;
    }
    if (verb === "set-hostname" || verb === "hostname") {
      const name = arg1;
      if (name === null || name === "") {
        ctx.err("Too few arguments.\n");
        return 1;
      }
      if (!hostnameRe.test(name)) {
        ctx.err(`Invalid static hostname '${name}'\n`);
        return 1;
      }
      if (!isRoot(ctx)) {
        ctx.err(`Could not set static hostname: ${Auth}\n`);
        sudoTip(ctx);
        return 1;
      }
      sh.vfs.writeFile("/etc/hostname", name + "\n", root);
      tip(ctx, "systemd.hostnameSaved");
      return 0;
    }
    if (verb !== "status") {
      ctx.err(`Unknown command verb '${verb}'.\n`);
      return 1;
    }
    const pm = prettyNameRe.exec(sh.distro.osRelease);
    const pretty = pm !== null ? pm[1]! : sh.distro.name;
    const boot = sh.services.boots.length > 0 ? sh.services.boots.at(-1)! : null;
    ctx.out(
      ` Static hostname: ${hostname}\n` +
        "       Icon name: computer-vm\n" +
        "         Chassis: vm\n" +
        `      Machine ID: ${sh.services.machineId}\n` +
        `         Boot ID: ${boot?.id ?? ""}\n` +
        "  Virtualization: kvm\n" +
        `Operating System: ${pretty}\n` +
        `          Kernel: Linux ${sh.distro.kernel}\n` +
        "    Architecture: x86-64\n" +
        " Hardware Vendor: QEMU\n" +
        "  Hardware Model: Standard PC _Q35 + ICH9, 2009_\n",
    );
    return 0;
  },
};
