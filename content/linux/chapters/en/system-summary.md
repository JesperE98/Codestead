# Summary: The system

In this part you've looked at what goes on around your commands: the shell's
memory, who may do what, which programs are running and how files are packed
together.

## Variables, PATH and aliases

You read a variable with `$NAME` and create one with `NAME=value` – without
spaces around the `=`. `export` turns it into an environment variable, which
programs you start can read too. Inside double quotes variables are replaced
by their values; inside single quotes everything is printed exactly as
written. The shell looks for commands in the directories in `PATH`, and
`$?` holds the exit code of the most recent command: `0` means it went well.
Aliases and variables disappear when you close the terminal unless you put
them in `~/.bashrc`.

## Users, permissions and sudo

Every file has an owner, a group and three sets of permissions – for the
owner, the group and others. `r` = 4, `w` = 2 and `x` = 1, so `755` is
`rwxr-xr-x` and `600` is `rw-------`. A script needs the `x` permission and
is run with `./` because the directory you're in isn't part of `PATH`.
`sudo` runs a single command as root and asks for your own password. On
Ubuntu, the users in the group `sudo` may use it.

## Processes and jobs

Every running program is a process with a PID and a parent (PPID). `ps aux`
shows them all, and `top` shows them live, sorted by processor use. `kill`
sends a signal: `SIGTERM` (15) by default, and `SIGKILL` (9) as the last
resort. With `&` a command runs in the background, and `jobs`, `fg` and `bg`
let you manage the jobs in your terminal.

## Archives and compression

`tar` collects files into one archive and `gzip` makes a single file
smaller – together they give you a `.tar.gz`. Exactly one of `c`, `x` and `t`
tells tar what to do, and `f` is followed by the archive's name. `zcat` reads
a `.gz` file without unpacking it, and `zip -r` / `unzip` handle zip files,
which are easy to share with Windows and macOS.

## Commands and options

| Command | Does |
|---|---|
| `echo $NAME` | Show the value of a variable |
| `export NAME=value` | Create an environment variable |
| `env` | List all environment variables |
| `which ls` · `type cd` | Show where a program is · what a name is |
| `echo $?` | Show the exit code of the previous command |
| `alias ll='ls -la'` · `unalias ll` | Create · remove an alias |
| `source ~/.bashrc` | Load `~/.bashrc` straight away |
| `id` · `groups` | Show your user and groups |
| `ls -l` | Show permissions, owner and group |
| `chmod 644 file` · `chmod u+x file` | Change permissions with numbers · symbols |
| `sudo command` · `sudo -i` | Run a command as root · start a root shell |
| `sudo tee -a file` | At the end of a pipe: add text to a file that only root may change |
| `ps` · `ps aux` · `ps -ef` | Your processes · all processes · with the parent's PID |
| `ps aux --sort=-%cpu` | All processes, the heaviest first |
| `pgrep -l name` | Find the PID of a process by name |
| `top` | A live view of the processes |
| `kill PID` · `kill -9 PID` | Ask a process to exit · force it |
| `pkill pattern` · `killall name` | Stop processes by name |
| `command &` | Run a command in the background |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | List · foreground · background · end a job |
| `uptime` · `free -h` | Load · memory |
| `tar -czvf archive.tar.gz dir` | Pack and compress a directory |
| `tar -tzvf archive.tar.gz` | List the contents of an archive |
| `tar -xzvf archive.tar.gz -C dir` | Unpack an archive into a directory |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | Compress · keep the original · unpack |
| `zcat file.gz` | Read a compressed file directly |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | Create · unpack a zip file |
| `du -sh dir` | Show how much space something takes |
