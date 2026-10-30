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

:::debian
Older Debian and Ubuntu versions often say `/lib/systemd/system` instead.
It's the same directory – `/lib` is a link to `/usr/lib`.
:::

The name of a service is the file name, for example `minserver.service`.
When you type commands you may leave out `.service`: `systemctl status
minserver` works just as well.

## How is the service doing? – `systemctl status`

The command you'll use most is `systemctl status`:

:::debian
```sh
systemctl status ssh
```
:::

:::arch
```sh
systemctl status sshd
```
:::

:::redhat
```sh
systemctl status sshd
```
:::

The output looks roughly like this:

```text
● sshd.service - OpenSSH server daemon
     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: disabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 CET; 2h 13min ago
       Docs: man:sshd(8)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/sshd.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 fedora systemd[1]: Starting sshd.service - OpenSSH server daemon...
Oct 30 07:54:07 fedora sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 fedora systemd[1]: Started sshd.service - OpenSSH server daemon.
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
sudo systemctl start minserver      # start now
sudo systemctl stop minserver       # stop now
sudo systemctl restart minserver    # stop and start again
sudo systemctl reload minserver     # ask it to re-read its configuration
```

Everything that **changes** something requires root, so don't forget
`sudo`. Without it systemctl answers:

```text
Failed to start minserver.service: Interactive authentication required.
```

`reload` only works for services that support it. The advantage is that
the service keeps running meanwhile – no connection is dropped. When you've
changed a service's configuration file, `reload` or `restart` is the final
step.

> **Try it!** In the chapter on processes you stopped the practice server
> with `pkill`. Look at `systemctl status minserver` – systemd noticed that
> the process disappeared. Start it again with `systemctl` and compare the
> PID with `pgrep -l minserver`.

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
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

When the computer boots, systemd goes through that directory and starts
everything in it. You can ask about the state:

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` and `is-enabled` are great in scripts – they print one word and
exit with status 0 if the answer is "yes". With `-q` they're completely
silent:

```text
if systemctl is-active -q minserver; then echo "the server is running"; fi
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
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
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
journal (`adm` or `systemd-journal` in Debian and Ubuntu, `wheel` in Arch
and Fedora), to see everything. Your user in the simulator may read the
whole journal.

## Troubleshooting a service that won't start

Someone has set up the service **rapportd** on this computer, but something
is wrong. This is the usual way to go about it:

1. **What has failed?** List the failed services:

   ```sh
   systemctl --failed
   ```

2. **Look at the status.** The last lines are often enough:

   ```sh
   systemctl status rapportd
   ```

3. **Read the whole log** for the service. It almost always tells you what's
   wrong – read it carefully, word by word:

   ```sh
   journalctl -xeu rapportd
   ```

   `systemctl` itself suggests exactly that command when a start fails:
   `See "systemctl status rapportd.service" and "journalctl -xeu
   rapportd.service" for details.`

4. **Fix the problem**, for example a configuration file that is missing or
   has a typo.

5. **Restart and check:**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

The line `Main process exited, code=exited, status=1/FAILURE` means the
program exited by itself with an error. If it says `status=203/EXEC`,
systemd couldn't find the program at all – check the path in `ExecStart=`.

## The unit file – `systemctl cat`

To see exactly how a service is started, read its unit file:

```sh
systemctl cat minserver
```

```text
# /etc/systemd/system/minserver.service
[Unit]
Description=Minserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/minserver --port 8080
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

## Different names in different families

systemd works the same everywhere, but **the services aren't always called
the same thing**. It depends on what the packages are called and which
programs the distribution has chosen:

| Service | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| SSH server | `ssh` (alias `sshd`) | `sshd` | `sshd` |
| Scheduled jobs (cron) | `cron` | `cronie` (not installed by default) | `crond` |
| Network | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Firewall | `ufw` (if installed) | – | `firewalld` |
| Clock | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
In {{distro}} the SSH service is called `ssh.service`. It has the alias
`sshd.service`, so `systemctl status sshd` works too – but the output shows
the real name.
:::

:::arch
Arch installs almost no services by default – you choose for yourself. No
cron service is running, for example; Arch uses systemd **timers** instead.
If you want cron, install the package `cronie` and run `sudo systemctl
enable --now cronie`. Also keep in mind that Arch has `preset: disabled`:
new services are never enabled automatically when you install them.
:::

:::redhat
Fedora has `firewalld` running from the start, and time sync is handled by
`chronyd`. Fedora also uses `preset: disabled` for most services: when you
install a new service (a web server, for example) you have to run `sudo
systemctl enable --now …` yourself.
:::

Not sure what something is called? Search the list:

```sh
systemctl list-unit-files | grep ssh
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
