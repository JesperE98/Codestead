// The optional project of the main chapter "admin": a new colleague starts on Monday. The learner gets everything
// ready with what the part taught – an account with a password, a team group, a shared folder only the team can use,
// the reading material from the USB stick, and the team's intranet (myserver) running and starting at boot – and
// proves it with a reboot and the journal. Its place is set by defineProjects() in ChapterDefinitions.ts; the brief
// is src/Linux/content/chapters/<lang>/admin-project.md.

import { ChapterKinds } from "@codestead/learning";
import { DisksLib, type GroupEntry, UsersLib } from "@codestead/linux-shell";
import { cmds, isDir, isFile, node, ran, re, w } from "../../Checks.js";
import type { CheckContext } from "../../Types/CheckContext.js";
import { Chapter } from "../../Types/Chapter.js";
import { ChapterTask } from "../../Types/ChapterTask.js";

const Intranet = "myserver.service";

/** A member of the group – listed in /etc/group or with it as the primary group. */
function inGroup(c: CheckContext, user: string, group: GroupEntry | null): boolean {
  return group !== null && (group.members.includes(user) || UsersLib.findUser(c.sh, user)?.gid === group.gid);
}

function newUser(c: CheckContext): string {
  return w(c).get("newUser");
}

function team(c: CheckContext): GroupEntry | null {
  return UsersLib.findGroup(c.sh, w(c).get("teamGroup"));
}

/** The shared folder, /srv/<team>. */
const shared = "/srv/{{teamGroup}}";

function intranetEnabled(c: CheckContext): boolean {
  return isFile(c, `/etc/systemd/system/multi-user.target.wants/${Intranet}`);
}

export function adminProject(): Chapter {
  return new Chapter({
    id: "admin-project",
    part: "admin",
    kind: ChapterKinds.Project,
    title: "Projekt: Ny kollega på måndag",
    tasks: [
      new ChapterTask({
        id: "account",
        text: "Skapa ett konto åt `{{newUser}}` – med hemkatalog, `/bin/bash` som skal och ett lösenord, så att kontot går att logga in på.",
        hint: "`useradd` med `-m` och `-s` skapar kontot, och `passwd` sätter lösenordet. Båda kräver `sudo`.",
        solution: cmds("sudo useradd -m -s /bin/bash {{newUser}}", "sudo passwd {{newUser}}", "{{password}}", "{{password}}"),
        check: (c) => {
          const u = UsersLib.findUser(c.sh, newUser(c));
          return u !== null && re(String.raw`/bash$`).test(u.shell) && isDir(c, u.home) && (UsersLib.shadowHash(c.sh, u.name) ?? "").startsWith("$");
        },
      }),
      new ChapterTask({
        id: "team",
        text: "Skapa gruppen `{{teamGroup}}` och lägg till både `{{newUser}}` och dig själv i den. Sudo-rätt ska `{{newUser}}` inte ha – inte än.",
        hint: "`groupadd` skapar gruppen och `usermod -aG` lägger till en medlem i taget. Glöm inte `-a`!",
        solution: cmds("sudo groupadd {{teamGroup}}", "sudo usermod -aG {{teamGroup}} {{newUser}}", "sudo usermod -aG {{teamGroup}} {{user}}"),
        check: (c) =>
          inGroup(c, newUser(c), team(c)) && inGroup(c, w(c).user, team(c)) && !inGroup(c, newUser(c), UsersLib.findGroup(c.sh, "sudo")),
      }),
      new ChapterTask({
        id: "shared",
        text:
          "Skapa den gemensamma mappen `" + shared + "`. Den ska tillhöra gruppen `{{teamGroup}}`, och gruppen ska få läsa, skriva och " +
          "gå in i den – alla andra ingenting.",
        hint: "`sudo mkdir`, sedan `chgrp` för gruppen och `chmod` för rättigheterna. Siffrorna för *rwx* för ägaren och gruppen och inget för övriga är `770`.",
        solution: cmds(`sudo mkdir ${shared}`, `sudo chgrp {{teamGroup}} ${shared}`, `sudo chmod 770 ${shared}`),
        check: (c) => {
          const n = node(c, shared);
          return n?.type === "dir" && n.group === w(c).get("teamGroup") && (n.mode & 0o070) === 0o070 && (n.mode & 0o007) === 0;
        },
      }),
      new ChapterTask({
        id: "try-access",
        text: "Provkör kontot: bli `{{newUser}}`, skapa en fil i `" + shared + "` och gå sedan tillbaka till ditt eget konto.",
        hint: "`su - {{newUser}}` med lösenordet du valde, sedan `touch` och till sist `exit`.",
        solution: cmds("su - {{newUser}}", "{{password}}", `touch ${shared}/{{helloFile}}`, "exit"),
        check: (c) => {
          const dir = node(c, shared);
          return [...(dir?.type === "dir" ? (dir.children?.values() ?? []) : [])].some((f) => f.owner === newUser(c));
        },
      }),
      new ChapterTask({
        id: "welcome-pack",
        text:
          "Läsningen för första veckan, `{{report}}`, ligger på USB-stickan (`/dev/sdb1`). Lägg en kopia i hemkatalogen hos `{{newUser}}` " +
          "– filen ska ägas av `{{newUser}}`, inte av root – och avmontera stickan när du är klar.",
        hint:
          "Montera stickan på `/mnt/usb` med `sudo mount`. Kopierar du som `{{newUser}}` (`sudo -u {{newUser}} cp …`) blir det " +
          "`{{newUser}}` som äger kopian. Avsluta med `sudo umount` – och stå inte själv i `/mnt/usb` då.",
        solution: cmds(
          "sudo mkdir -p /mnt/usb",
          "sudo mount /dev/sdb1 /mnt/usb",
          "sudo -u {{newUser}} cp /mnt/usb/{{report}} /home/{{newUser}}/",
          "sudo umount /mnt/usb",
        ),
        check: (c) => {
          const u = UsersLib.findUser(c.sh, newUser(c));
          const f = u !== null ? node(c, `${u.home}/{{report}}`) : null;
          return f?.type === "file" && f.owner === u!.name && (f.content ?? "").startsWith("%PDF") && !c.sh.disks.mounts.some((m) => m.dev === DisksLib.UsbPart);
        },
      }),
      new ChapterTask({
        id: "intranet",
        text: "Teamets intranät är tjänsten `myserver`. Se till med `systemctl` att den kör nu **och** startar av sig själv när datorn startar.",
        hint: "`systemctl is-active` och `is-enabled` visar läget. `enable --now` ordnar båda på en gång.",
        solution: cmds("sudo systemctl enable --now myserver"),
        check: (c) => re(String.raw`\bsystemctl\b`).test(c.line) && intranetEnabled(c) && c.sh.services.units.get(Intranet)?.active === "active",
      }),
      new ChapterTask({
        id: "monday",
        text:
          "Generalrepetition för måndag morgon: starta om datorn och visa sedan i journalen att intranätet startade av sig självt vid " +
          "den här uppstarten.",
        hint: "`sudo systemctl reboot` startar om. Sedan visar `journalctl` med `-u` för tjänsten och `-b` för den här uppstarten raderna du letar efter.",
        solution: cmds("sudo systemctl reboot", "journalctl -u myserver -b"),
        check: (c) => {
          const st = c.sh.services;
          const boot = st.boots.length - 1;
          // A new computer has two boots, yesterday's and the current one: more means it has been restarted since.
          return (
            boot >= 2 &&
            intranetEnabled(c) &&
            ran(c, re(String.raw`^journalctl\b.*\bmyserver\b`)) &&
            c.output.includes(`Started ${Intranet}`) &&
            st.journal.some((e) => e.unit === Intranet && e.boot === boot && e.msg.startsWith(`Started ${Intranet}`))
          );
        },
      }),
    ],
  });
}
