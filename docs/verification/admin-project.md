# admin-project – Project: A new colleague on Monday

Huvudkapitel: `admin` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/admin-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/admin/admin-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder kommandona från Systemadministration (och `touch`, `cp`, `chgrp`,
`chmod` från tidigare delar). Delmålens lösningar körs i alla distributioner och med alla språks världar av testet
`ChaptersTests` ("alla uppgifter går att lösa"); huvudkapitlet körs alltid i Ubuntu.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `useradd -m -s /bin/bash NAME` creates the user with a home directory and bash as the shell |  | ogranskad |  |
| `passwd NAME` (as root) sets another user's password |  | ogranskad |  |
| `usermod -aG GROUP NAME` adds a supplementary group; without `-a`, `-G` replaces the supplementary groups |  | ogranskad |  |
| On Ubuntu sudo rights come from membership in the group `sudo` |  | ogranskad |  |
| `id NAME` shows a user's groups |  | ogranskad |  |
| `ls -ld` shows a directory's owner, group and permissions |  | ogranskad |  |
| `chmod 770` gives owner and group rwx and others nothing; rwx = 7 in octal |  | ogranskad |  |
| A new file gets the owner of the user who creates it, so a file copied with `sudo cp` belongs to root and one copied with `sudo -u NAME cp` belongs to NAME |  | ogranskad |  |
| A user may delete a file owned by root in a directory the user owns and can write to |  | ogranskad |  |
| `umount` refuses with "target is busy" while a shell's working directory is inside the mount |  | ogranskad |  |
| `systemctl is-active` / `is-enabled` show whether a service runs now / starts at boot |  | ogranskad |  |
| `systemctl enable --now` enables a service and starts it at once |  | ogranskad |  |
| `systemctl reboot` restarts the computer (needs root) |  | ogranskad |  |
| `journalctl -u UNIT -b` shows a unit's journal lines from the current boot |  | ogranskad |  |
| `usermod -L` / `-U` lock and unlock an account; `passwd -S` shows the status |  | ogranskad |  |
