# Project: A new colleague on Monday

Friday, half past three. Your boss leans in through the doorway:
"Oh, by the way – {{newUser}} joins the support team on Monday. Could you get
everything ready? Account, team folder, the reading for the first week. And make
sure the intranet works this time – the last newcomer spent the whole first
morning staring at *Couldn't connect to server*."

Everything you need is in *System administration* – users and groups, disks and
services – with a little help from the earlier parts. Nothing here is new; the
challenge is putting the pieces together yourself, so that Monday morning goes
without a hitch.

## The assignment

1. **An account.** Create the user `{{newUser}}` with a home directory and
   `/bin/bash` as the shell, and give the account a password.
2. **The team.** Create the group `{{teamGroup}}` and add both `{{newUser}}` and
   yourself to it. `{{newUser}}` gets no sudo rights – not yet, that comes after
   the trial period.
3. **The shared folder.** Create `/srv/{{teamGroup}}`, owned by the group
   `{{teamGroup}}`. The group may read, write and enter the folder; everyone else
   may do nothing at all.
4. **Test the account.** Become `{{newUser}}`, create a file in the shared folder
   to show that the permissions work, and go back to your own account.
5. **The welcome pack.** The reading for the first week, `{{report}}`, is on the
   USB stick (`/dev/sdb1`). Put a copy in the home directory of `{{newUser}}` –
   owned by `{{newUser}}`, not by root – and unmount the stick when you are done.
6. **The intranet.** The team's intranet is the service `myserver`. Make sure it
   is running now **and** starts by itself every time the computer boots.
7. **Dress rehearsal.** Restart the computer and show in the journal that the
   intranet started by itself on this boot.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- Almost everything here changes the system, so most commands need `sudo`.
- `usermod -aG` – don't forget the `-a`, or the user is thrown out of every other
  group. `id {{newUser}}` shows which groups an account is in.
- `ls -ld` shows a directory's owner, group and permissions. Count the
  permissions in octal: *rwx* is 7 and nothing is 0.
- A file you copy with `sudo` belongs to root. Copy it *as* the newcomer instead –
  with `su -` or `sudo -u` – and it belongs to them from the start.
- Did a copy owned by root end up there already? `{{newUser}}` may delete it – it is in
  their own home directory – and copy it again.
- Does `umount` say *target is busy*? Your own shell is standing in the directory:
  `cd ~` first.
- `start` and `enable` are two different things. `systemctl is-active` and
  `systemctl is-enabled` show where you stand.
- After a reboot, `journalctl -b` shows only the current boot.

## Want to do more?

Once the milestones are done, you can keep going. Will the newcomer's files fit?
`df -h` and `du -sh` know. Lock the account with `usermod -L` until Monday
morning, check it with `passwd -S` and unlock it with `usermod -U`. And have a
look at your work from the system's side: the lines for `{{newUser}}` in
`/etc/passwd` and `/etc/group`, and `systemctl status myserver`.
