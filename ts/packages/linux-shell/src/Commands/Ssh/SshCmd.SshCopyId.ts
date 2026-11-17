// Port of Commands/Ssh/SshCmd.SshCopyId.cs – the ssh-copy-id command: install your public SSH key on a server.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { addAuthorizedKey, authenticate, keyFlag, parseDest, publicKey, serverFor, sshConnect, sshDir } from "./SshCmd.js";

export const sshCopyId: CommandDef = {
  name: "ssh-copy-id",
  summary: "Lägger din publika SSH-nyckel på en server",
  summaryEn: "Install your public SSH key on a server",
  man: `NAMN
       ssh-copy-id - lägg din publika nyckel på en server

SYNOPSIS
       ssh-copy-id [-i NYCKEL.pub] ANVÄNDARE@VÄRD

BESKRIVNING
       Lägger till din publika nyckel i ~/.ssh/authorized_keys på servern.
       Sedan loggar ssh in med nyckeln i stället för med lösenord.

EXEMPEL
       ssh-keygen
       ssh-copy-id $USER@server.lan`,
  manEn: `NAME
       ssh-copy-id - install your public key on a server

SYNOPSIS
       ssh-copy-id [-i KEY.pub] USER@HOST

DESCRIPTION
       Appends your public key to ~/.ssh/authorized_keys on the server.
       After that, ssh logs in with the key instead of a password.

EXAMPLES
       ssh-keygen
       ssh-copy-id $USER@server.lan`,
  run: (ctx) => {
    const sh = ctx.sh;
    const o = UtilCmd.parseOpts(ctx.args, { flags: "fn", values: "ip" });
    if (o.error !== null || !o.operands[0]) {
      ctx.err(
        "Usage: /usr/bin/ssh-copy-id [-h|-?|-f|-n|-s|-x] [-i [identity_file]] [-p port] [-F alternative ssh_config file] [-t target_path] [[-o <ssh -o options>] ...] [user@]hostname\n",
      );
      return 1;
    }
    const identity = o.values.get("i") ?? null;
    const pub = publicKey(sh, identity);
    const source = identity ? (identity.endsWith(".pub") ? identity : identity + ".pub") : `${sshDir(sh)}/id_ed25519.pub`;
    if (pub === null) {
      ctx.err("/usr/bin/ssh-copy-id: ERROR: No identities found\n");
      return 1;
    }
    const pv = o.values.get("p");
    const { dest: d, error: configError } = parseDest(o.operands[0], null, sh, pv !== undefined ? Js.number(pv) : null);
    if (d === null) {
      ctx.err(configError!);
      return 1;
    }
    ctx.err(`/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${source}"\n`);
    return sshConnect(ctx, d, (io) => {
      io.err("/usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed\n");
      const server = serverFor(sh);
      const existing = server.vfs.tryLookup(`${server.world.home}/.ssh/authorized_keys`, server.rootUser())?.content ?? "";
      if (d.user === sh.world.user && existing.includes(pub.trim())) {
        io.err(
          "\n/usr/bin/ssh-copy-id: WARNING: All keys were skipped because they already exist on the remote system.\n\t\t(if you think this is a mistake, you may want to use -f option)\n\n",
        );
        return 0;
      }
      io.err("/usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys\n");
      if (!authenticate(sh, d, io)) return 1;
      addAuthorizedKey(server, pub);
      sh.flags.set(keyFlag(sh), true);
      io.out(`\nNumber of key(s) added: 1\n\nNow try logging into the machine, with: "ssh '${d.user}@${d.host}'"\nand check to make sure that only the key(s) you wanted were added.\n\n`);
      return 0;
    });
  },
};
