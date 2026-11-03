# Scheduled jobs with cron

A backup every night, cleaning up old logs every week, fetching data every five
minutes – the computer can run commands on its own at set times. The classic
tool for that is **cron**, and systemd has its own **timers**.

## cron and crontab

The service cron wakes up every minute and runs the jobs whose time has come.
Every user has their own list of jobs, a **crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* means that you have no jobs yet.

## The five time fields

Each line in a crontab has five time fields and then the command:

```text
┌───────────── minute (0–59)
│ ┌─────────── hour (0–23)
│ │ ┌───────── day of the month (1–31)
│ │ │ ┌─────── month (1–12)
│ │ │ │ ┌───── day of the week (0–7, Sunday is 0 or 7)
│ │ │ │ │
* * * * *  command
```

| You write | Means |
|---|---|
| `*` | Every |
| `5` | Exactly 5 |
| `1-5` | 1 to 5 |
| `1,15` | 1 and 15 |
| `*/10` | Every tenth: 0, 10, 20 … |

| Line | Runs |
|---|---|
| `* * * * * command` | Every minute |
| `*/5 * * * * command` | Every five minutes |
| `30 2 * * * command` | At 02:30 every night |
| `0 7 * * 1-5 command` | At 07:00 Monday to Friday |
| `0 0 1 * * command` | At midnight on the first of every month |
| `@reboot command` | Once, when the computer starts |

`@hourly`, `@daily`, `@weekly` and `@monthly` are shortcuts too.

```quiz
When does the job `15 8 * * 6 ~/backup.sh` run?
- [ ] At 15:08 every day
- [x] At 08:15 every Saturday
- [ ] On the 15th of every month at 08:00
---
The order is minute, hour, day of the month, month and day of the week:
minute 15, hour 8, any date, any month, day 6 – Saturday.
```

```quiz
How often does `0 */2 * * * command` run?
- [ ] Every two minutes
- [x] Every other hour, on the hour
- [ ] Twice a day
---
Minute 0 and every second hour: 00:00, 02:00, 04:00 …
```

## Installing jobs

`crontab -e` opens your crontab in a text editor and installs it when you save.
The simulator has no editor yet, so here you give `crontab` the jobs on its
input – `-` means "read from the input":

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Be careful: `crontab -` and `crontab FILE` **replace** the whole crontab. To
add a job, combine the old jobs with the new one:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

To remove one line, filter it out with `grep -v` and install the rest – or
remove everything with `crontab -r`:

```sh
crontab -l | grep -v backup.sh | crontab -
```

`crontab` checks the lines before it installs anything:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
There is no hour 25 – the hours go from 0 to 23. Nothing was installed.
```

## Watching it run

When you have installed the job that runs every minute, wait a minute and
look:

```sh
cat ~/cron.log
journalctl -u cron
```

Every run is written to the journal, like
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. In the simulator, cron only
runs while the app is open – just like a real computer, it doesn't catch up
on the jobs it missed while it was off.

## The cron trap: another environment

The jobs don't run in your terminal, and that surprises almost everyone:

- They run with `/bin/sh`, without your aliases and your `~/.bashrc`.
- `PATH` is short (`/usr/bin:/bin`), so programs elsewhere need their full
  path.
- They start in your home directory.
- Output that isn't sent to a file is lost. Always end the line with, for
  example, `>> ~/job.log 2>&1`.

Run the command by hand first. When it works there, put it in the crontab.

```quiz
The job `* * * * * echo hi` runs every minute, but you never see `hi`
anywhere. Why?
- [ ] cron doesn't allow `echo`
- [x] The output has nowhere to go – send it to a file with `>>`
- [ ] Jobs only run as root
---
Output from cron jobs is not shown in any terminal. Real cron tries to email
it, and most computers have no mail – so it is lost.
```

## The system's own jobs

Besides the users' crontabs there is `/etc/crontab`, and directories like
`/etc/cron.daily` and `/etc/cron.weekly`. The scripts in them are run once a
day or once a week:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

The lines in `/etc/crontab` have one more field before the command: the user
the job runs as.

## systemd timers

On modern distributions much of this is done by systemd **timers** instead: a
`.timer` unit that starts a `.service` unit at set times. They log to the
journal and can catch up on runs they missed, but every job needs two unit
files. For your own small jobs, cron is the quickest way. List the timers on
the computer, with the next and the previous run:

```try
systemctl list-timers
```

## On other distributions

| | Ubuntu and Debian | Fedora | Arch |
|---|---|---|---|
| Package | `cron` | `cronie` | `cronie` |
| Service | `cron` | `crond` | `cronie` |
| Installed from the start | Yes | Yes | No |

On Arch you start with `sudo pacman -S cronie` and
`sudo systemctl enable --now cronie`.
