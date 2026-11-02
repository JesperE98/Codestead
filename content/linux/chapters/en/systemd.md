# Services and logs with systemd

A Linux computer is constantly doing things that nobody starts by hand: it
accepts SSH connections, keeps the clock in sync, runs scheduled jobs and
writes logs. The programs that do this are called **services**, and in
almost every modern distribution **systemd** keeps them in order. In this
chapter you'll learn to start and stop services, make them start at boot
and – most important of all – read the logs when something goes wrong.

## init and systemd

When the Linux kernel has started it runs a single program: **init**,
process number 1. Init then starts everything else. Today init is almost
always **systemd** – in Debian, Ubuntu, Arch and Fedora alike. Have a look:

```sh
ps -p 1
```

The process is called `/sbin/init`, but that's just a link to the `systemd`
program.

systemd does more than start services. It keeps track of whether they're
alive, restarts them if they crash (if you want it to), collects everything
they print in a shared log – the **journal** – and has tools for most parts
of the system:

| Tool | Does |
|---|---|
| `systemctl` | Controls the services: status, start, stop, boot |
| `journalctl` | Reads the journal (the log) |
| `hostnamectl` | Shows and changes the computer's name |
| `systemd-analyze` | Shows how long the boot took |

## Units and services

Everything systemd keeps track of is called a **unit**. There are several
kinds, and the kind shows in the suffix: `.service` (a service), `.timer`
(a scheduled job), `.socket`, `.mount`, `.target` (a group of units, a bit
like a "level" of the boot) and more. This chapter is about services.

Every unit is described by a **unit file**, a small text file. They live in
two places:

| Directory | Contents |
|---|---|
| `/usr/lib/systemd/system/` | Unit files that come with the packages. Don't edit here! |
| `/etc/systemd/system/` | The administrator's own unit files. They take precedence. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

Older Debian and Ubuntu versions often say `/lib/systemd/system` instead.
It's the same directory – `/lib` is a link to `/usr/lib`.

The name of a service is the file name, for example `myserver.service`.
When you type commands you may leave out `.service`: `systemctl status
myserver` works just as well.

## How is the service doing? – `systemctl status`

The command you'll use most is `systemctl status`:

```sh
systemctl status ssh
```

On Ubuntu the SSH server is called `ssh`. The output looks roughly like
this:

```text
● ssh.service - OpenBSD Secure Shell server
     Loaded: loaded (/usr/lib/systemd/system/ssh.service; enabled; preset: enabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 UTC; 2h 13min ago
       Docs: man:sshd(8)
             man:sshd_config(5)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/ssh.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 ubuntu systemd[1]: Starting ssh.service - OpenBSD Secure Shell server...
Oct 30 07:54:07 ubuntu sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 ubuntu systemd[1]: Started ssh.service - OpenBSD Secure Shell server.
```

Line by line:

| Line | Means |
|---|---|
| `●` | Green dot = running. Red `×` = has failed. White `○` = stopped. |
| `Loaded` | Where the unit file is, whether the service starts at boot (`enabled`/`disabled`/`static`) and the distribution's default (`preset`) |
| `Active` | The most important line: `active (running)`, `inactive (dead)` or `failed` – and since when |
| `Docs` | Where to read more (`man sshd`) |
| `Main PID` | The service's main process – the same PID as in `ps aux` |
| `Memory`, `CGroup` | How much memory it uses and which processes belong to it |
| Last lines | The latest lines from the service's log in the journal |

`static` means the service can't be enabled on its own – it's started when
another unit needs it.

> **Tip:** In a real terminal long output is shown in a pager (`less`).
> Press `q` to get back. Add `--no-pager` if you'd rather skip it.

## Start, stop and restart

```text
sudo systemctl start myserver      # start now
sudo systemctl stop myserver       # stop now
sudo systemctl restart myserver    # stop and start again
sudo systemctl reload myserver     # ask it to re-read its configuration
```

Everything that **changes** something requires root, so don't forget
`sudo`. Without it systemctl answers:

```text
Failed to start myserver.service: Interactive authentication required.
```

`reload` only works for services that support it. The advantage is that
the service keeps running meanwhile – no connection is dropped. When you've
changed a service's configuration file, `reload` or `restart` is the final
step.

> **Try it!** In the chapter on processes you stopped the practice server
> with `pkill`. Look at `systemctl status myserver` – systemd noticed that
> the process disappeared. Start it again with `systemctl` and compare the
> PID with `pgrep -l myserver`.

## Now or at boot? `start` and `enable`

This is the most common misunderstanding about systemd: **`start` and
`enable` are two different things.**

| Command | Does |
|---|---|
| `systemctl start X` | Starts the service **now**. After a reboot it's gone again. |
| `systemctl enable X` | Starts the service automatically **at boot** – but not now. |
| `systemctl enable --now X` | Both at once. |
| `systemctl disable X` | Don't start at boot (`--now` stops it too). |

`enable` creates a link in a directory named after the target in the
`[Install]` section of the unit file, usually `multi-user.target.wants`:

```text
$ sudo systemctl enable --now myserver
Created symlink /etc/systemd/system/multi-user.target.wants/myserver.service → /etc/systemd/system/myserver.service.
```

When the computer boots, systemd goes through that directory and starts
everything in it. You can ask about the state:

```sh
systemctl is-active myserver
systemctl is-enabled myserver
```

`is-active` and `is-enabled` are great in scripts – they print one word and
exit with status 0 if the answer is "yes". With `-q` they're completely
silent:

```text
if systemctl is-active -q myserver; then echo "the server is running"; fi
```

On a freshly started computer in the simulator, `myserver` is running, but
nobody has enabled it. What do these two commands print?

```predict
$ systemctl is-active myserver
$ systemctl is-enabled myserver
active
disabled
---
myserver is running **now**, but nobody has run `enable` – after a reboot
it would not be started. `start` and `enable` really are two different
things.
```

## Listing services

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` shows the services that are running (or have failed). With
  `--all` the stopped ones are included too.
- `--failed` shows only the ones that have failed. A good first command
  when something feels wrong!
- `list-unit-files` shows all installed unit files and whether they're
  `enabled`, `disabled` or `static`.

## The journal – `journalctl`

Everything the services, the kernel and systemd itself print ends up in the
journal. Without options you get the whole journal, oldest first:

```sh
journalctl
```

That quickly becomes a lot, so you almost always filter:

| Command | Shows |
|---|---|
| `journalctl -u ssh` | Only one service (`-u` as in *unit*) |
| `journalctl -n 20` | The 20 most recent lines |
| `journalctl -f` | The latest lines, then new lines as they arrive (quit with Ctrl+C) |
| `journalctl -b` | Only this boot (`-b -1` = the previous one) |
| `journalctl --since today` | Since midnight. Also `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Only errors and worse |
| `journalctl -xe` | Jump to the end and add explanations |
| `journalctl -k` | Only kernel messages (like `dmesg`) |

The options can be combined. A couple of classics:

```sh
journalctl -u myserver -n 5
journalctl -p err -b
journalctl --since today -u myserver
```

### Priorities

Every line in the journal has a **priority**. `-p` shows the one you choose
*and everything more severe*:

| Number | Name | Means |
|---|---|---|
| 0 | `emerg` | The system is unusable |
| 1 | `alert` | Must be fixed immediately |
| 2 | `crit` | Critical error |
| 3 | `err` | Error – shown in red |
| 4 | `warning` | Warning – shown in yellow |
| 5 | `notice` | Normal but worth noting |
| 6 | `info` | Information |
| 7 | `debug` | Debugging information |

Don't worry if `journalctl -p err` shows a couple of kernel errors such as
`ACPI BIOS Error`. They exist on nearly every computer and are usually
harmless – bugs in the computer's firmware that the kernel works around.

Normally you have to be root, or a member of a group allowed to read the
journal (`adm` or `systemd-journal` on Ubuntu – other families use other
groups), to see everything. Your user in the simulator may read the whole
journal.

```quiz
Which priorities does `journalctl -p warning` show?
- [x] `err`
- [x] `warning`
- [x] `crit`
- [ ] `notice`
- [ ] `info`
---
`-p` shows the priority you choose *and everything more severe* – that is,
everything with the same or a lower number (`warning` is 4).
```

## Troubleshooting a service that won't start

Someone has set up the service **reportd** on this computer, but something
is wrong. This is the usual way to go about it:

1. **What has failed?** List the failed services:

   ```sh
   systemctl --failed
   ```

2. **Look at the status.** The last lines are often enough:

   ```sh
   systemctl status reportd
   ```

3. **Read the whole log** for the service. It almost always tells you what's
   wrong – read it carefully, word by word:

   ```sh
   journalctl -xeu reportd
   ```

   `systemctl` itself suggests exactly that command when a start fails:
   `See "systemctl status reportd.service" and "journalctl -xeu
   reportd.service" for details.`

4. **Fix the problem**, for example a configuration file that is missing or
   has a typo.

5. **Restart and check:**

   ```text
   sudo systemctl restart reportd
   systemctl status reportd
   ```

The line `Main process exited, code=exited, status=1/FAILURE` means the
program exited by itself with an error. If it says `status=203/EXEC`,
systemd couldn't find the program at all – check the path in `ExecStart=`.

```quiz
A service won't start, and the journal says `status=203/EXEC`. Where do you
look first?
- [ ] In `/etc/fstab`
- [x] At the path in `ExecStart=` in the unit file
- [ ] At the priority with `journalctl -p err`
- [ ] Nowhere – it means the program exited by itself with an error
---
203/EXEC means systemd couldn't find the program at all. A program that
starts and then exits with an error gives `status=1/FAILURE` instead.
```

## The unit file – `systemctl cat`

To see exactly how a service is started, read its unit file:

```sh
systemctl cat myserver
```

```text
# /etc/systemd/system/myserver.service
[Unit]
Description=Myserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/myserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Section | Contents |
|---|---|
| `[Unit]` | Description and ordering: `After=network.target` = start after the network |
| `[Service]` | How the program runs: `ExecStart=` (the command), `User=`, `Restart=on-failure` … |
| `[Install]` | What `enable` should do: `WantedBy=multi-user.target` |

If you change a unit file, systemd must load it again before the change
takes effect – otherwise you get a warning in `systemctl status`:

```text
sudo systemctl daemon-reload
```

Never edit the files in `/usr/lib/systemd/system` – they're overwritten
the next time the package is updated. Put your own version in
`/etc/systemd/system` instead.

```quiz
You want to change how a service that came with a package is started. What
is the right way?
- [ ] Edit its file in `/usr/lib/systemd/system` and restart the service
- [x] Put your own version in `/etc/systemd/system`, run `sudo systemctl daemon-reload` and restart the service
- [ ] Put your own version in `/etc/systemd/system` – systemd notices the change by itself
- [ ] Edit the file in `/usr/lib/systemd/system` and run `sudo systemctl enable` on it
---
Files in `/etc/systemd/system` take precedence, and they aren't overwritten
when the package is updated. `daemon-reload` makes systemd load the changed
unit file again.
```

## What are the services called?

systemd works the same everywhere, but **the services aren't always called
the same thing** – it depends on what the packages are called and which
programs the distribution has chosen. On Ubuntu:

| Service | Name on Ubuntu |
|---|---|
| SSH server | `ssh` (alias `sshd`) |
| Scheduled jobs (cron) | `cron` |
| Network | `NetworkManager` |
| Firewall | `ufw` (if installed) |
| Clock | `systemd-timesyncd` |

The SSH service is really called `ssh.service`. It has the alias
`sshd.service`, so `systemctl status sshd` works too – but the output shows
the real name. Other families can name the same services differently (on
Arch and Fedora the SSH service is called `sshd`) – the part on
distributions and packages is about such differences.

Not sure what something is called? Search the list:

```sh
systemctl list-unit-files | grep ssh
```

```try
systemctl list-unit-files | grep ssh
---
`ssh.service` is the real unit file, and `sshd.service` is listed as an
`alias` for it.
```

## Rebooting the computer

`enable` only shows its effect when the computer reboots. You can try that
in the simulator – it reboots in an instant:

```text
sudo systemctl reboot
```

After the reboot only the enabled services are running. With `journalctl -b
-1` you see the log from the previous boot (and how everything was shut
down), and `journalctl --list-boots` shows all boots in the journal.

## More from systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

`hostnamectl` shows the computer's name, operating system and kernel (and
renames it with `sudo hostnamectl set-hostname NEWNAME`). `systemd-analyze`
shows how long the boot took, and `blame` which services took the longest –
perfect when the computer boots slowly.
