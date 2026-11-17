// Port of Commands/Ssh/SshCmd.SshKeygen.cs – the ssh-keygen command: generate an SSH key pair.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import { FsError } from "../../Vfs/FsError.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { ensureSshDir, sshDir } from "./SshCmd.js";

const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function randomB64(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += b64[Math.floor(Js.random() * 64)];
  return s;
}

/** The "randomart" ssh-keygen draws (the drunken bishop algorithm). */
function randomArt(type: string, bits: number, fp: string): string {
  const field: number[][] = Array.from({ length: 9 }, () => new Array<number>(17).fill(0));
  let x = 8;
  let y = 4;
  for (const ch of fp.slice(7)) {
    let b = ch.charCodeAt(0);
    for (let i = 0; i < 4; i++) {
      x = Math.max(0, Math.min(16, x + ((b & 1) !== 0 ? 1 : -1)));
      y = Math.max(0, Math.min(8, y + ((b & 2) !== 0 ? 1 : -1)));
      field[y]![x]!++;
      b >>= 2;
    }
  }
  const chars = " .o+=*BOX@%&#/^";
  const rows: string[] = [];
  for (let ry = 0; ry < 9; ry++) {
    let row = "";
    for (let rx = 0; rx < 17; rx++) row += rx === 8 && ry === 4 ? "S" : rx === x && ry === y ? "E" : chars[Math.min(field[ry]![rx]!, chars.length - 1)];
    rows.push(row);
  }
  const title = `[${type.toUpperCase()} ${Js.num(bits)}]`;
  const top = "+" + title.padStart(Math.trunc((17 + title.length) / 2), "-").padEnd(17, "-") + "+";
  return [top, ...rows.map((r) => `|${r}|`), "+----[SHA256]-----+"].join("\n") + "\n";
}

export const sshKeygen: CommandDef = {
  name: "ssh-keygen",
  summary: "Skapar ett SSH-nyckelpar",
  summaryEn: "Generate an SSH key pair",
  man: `NAMN
       ssh-keygen - skapa och hantera SSH-nycklar

SYNOPSIS
       ssh-keygen [-t ed25519|rsa] [-f FIL] [-N LÖSENFRAS] [-C KOMMENTAR]
       ssh-keygen -R VÄRD

BESKRIVNING
       Skapar ett nyckelpar: en privat nyckel (t.ex. ~/.ssh/id_ed25519)
       som aldrig får lämna datorn, och en publik nyckel (.pub) som du
       lägger på servrar du vill logga in på, t.ex. med ssh-copy-id.

FLAGGOR
       -t TYP     nyckeltyp, ed25519 (standard) eller rsa
       -f FIL     var den privata nyckeln sparas
       -N FRAS    lösenfras ('' för ingen)
       -C TEXT    kommentar i den publika nyckeln
       -R VÄRD    ta bort VÄRD ur ~/.ssh/known_hosts

EXEMPEL
       ssh-keygen
       ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519`,
  manEn: `NAME
       ssh-keygen - generate and manage SSH keys

SYNOPSIS
       ssh-keygen [-t ed25519|rsa] [-f FILE] [-N PASSPHRASE] [-C COMMENT]
       ssh-keygen -R HOST

DESCRIPTION
       Creates a key pair: a private key (e.g. ~/.ssh/id_ed25519) that must
       never leave the computer, and a public key (.pub) that you put on
       servers you want to log in to, for example with ssh-copy-id.

OPTIONS
       -t TYPE    key type, ed25519 (default) or rsa
       -f FILE    where the private key is saved
       -N PHRASE  passphrase ('' for none)
       -C TEXT    comment in the public key
       -R HOST    remove HOST from ~/.ssh/known_hosts

EXAMPLES
       ssh-keygen
       ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "qy", values: "tfNCbR" });
    if (o.error !== null) {
      ctx.err(
        `ssh-keygen: ${o.error}\nusage: ssh-keygen [-q] [-a rounds] [-b bits] [-C comment] [-f output_keyfile]\n                  [-m format] [-N new_passphrase] [-O option]\n                  [-t dsa | ecdsa | ecdsa-sk | ed25519 | ed25519-sk | rsa]\n`,
      );
      return 1;
    }
    const user = sh.currentUser();
    const removeHost = o.values.get("R");
    if (removeHost !== undefined) {
      const file = `${sshDir(sh)}/known_hosts`;
      const node = sh.vfs.tryLookup(file, user);
      if (node === null) {
        ctx.err(`do_known_hosts: hostkeys_foreach failed for ${file}: No such file or directory\n`);
        return 255;
      }
      const lines = (node.content ?? "").split("\n").filter((l) => l !== "");
      const keep = lines.filter((l) => !l.split(" ")[0]!.split(",").includes(removeHost));
      sh.vfs.writeFile(file, keep.map((l) => l + "\n").join(""), user);
      if (keep.length !== lines.length) {
        ctx.out(`# Host ${removeHost} found: line 1\n${file} updated.\nOriginal contents retained as ${file}.old\n`);
        sh.vfs.writeFile(file + ".old", lines.map((l) => l + "\n").join(""), user);
      }
      return 0;
    }
    const type = (o.values.get("t") ?? "ed25519").toLowerCase();
    if (!["ed25519", "rsa", "ecdsa"].includes(type)) {
      ctx.err(`unknown key type ${type}\n`);
      return 1;
    }
    const bits = type === "rsa" ? Js.number(o.values.get("b") ?? "3072") : 256;
    const defFile = `${sshDir(sh)}/id_${type}`;
    const quiet = o.flags.has("q");
    const interactive = sh.canAskInteractively() && ctx.isTTY;
    const comment = o.values.get("C") ?? `${user.name}@${sh.distro.hostname}`;

    const generate = (file: string, io: Sink): number => {
      if (file.startsWith(sshDir(sh) + "/") && !ensureSshDir(sh, io, !quiet)) return 1;
      const fp = `SHA256:${randomB64(43)}`;
      const pubBody =
        type === "rsa"
          ? `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ${randomB64(180)}`
          : type === "ecdsa"
            ? `ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBB${randomB64(86)}=`
            : `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${randomB64(43)}`;
      const priv = `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n${randomB64(70)}\n${randomB64(70)}\n(simulated private key - never show it to anyone!)\n-----END OPENSSH PRIVATE KEY-----\n`;
      try {
        const path = sh.resolve(file);
        sh.vfs.writeFile(path, priv, user);
        sh.vfs.lookup(path, user).mode = Js.oct(600);
        sh.vfs.writeFile(path + ".pub", `${pubBody} ${comment}\n`, user);
        sh.vfs.lookup(path + ".pub", user).mode = Js.oct(644);
      } catch (e) {
        if (!(e instanceof FsError)) throw e;
        io.err(`Saving key "${file}" failed: ${e.message}\n`);
        return 1;
      }
      if (!quiet) {
        io.out(
          `Your identification has been saved in ${file}\nYour public key has been saved in ${file}.pub\n` +
            `The key fingerprint is:\n${fp} ${comment}\nThe key's randomart image is:\n${randomArt(type, bits, fp)}`,
        );
      }
      return 0;
    };

    const askPassphrase = (file: string, io: Sink): number => {
      if (o.values.has("N") || !interactive) return generate(file, io);
      sh.askText(`Enter passphrase for "${file}" (empty for no passphrase): `, (first) => {
        sh.askText("Enter same passphrase again: ", (second, io2) => {
          if (first !== second) {
            io2.err("Passphrases do not match.  Try again.\n");
            return 1;
          }
          return generate(file, io2);
        });
        return 0;
      });
      return 0;
    };

    const checkExisting = (file: string, io: Sink): number => {
      if (sh.vfs.tryLookup(sh.resolve(file), user) === null) return askPassphrase(file, io);
      if (!interactive) {
        io.err(`${file} already exists.\n`);
        return 1;
      }
      io.out(`${file} already exists.\n`);
      sh.ask("Overwrite (y/n)? ", false, (yes, io2) => (yes ? askPassphrase(file, io2) : 1));
      return 0;
    };

    if (!quiet) ctx.out(`Generating public/private ${type} key pair.\n`);
    if (o.values.has("f") || !interactive) return checkExisting(o.values.get("f") ?? defFile, ctx);
    sh.askText(`Enter file in which to save the key (${defFile}): `, (text, io) => {
      const t = text.trim();
      return checkExisting(t.length > 0 ? t : defFile, io);
    });
    return 0;
  },
};
