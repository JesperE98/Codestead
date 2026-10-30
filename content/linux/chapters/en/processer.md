# Processes and jobs

Every program that runs is a **process**. Right now the simulated computer is
running a dozen or so: the system's services, your shell – and something else
that you'll soon get a look at. In this chapter you'll learn how to see what's
running, stop programs that misbehave and run things in the background.

## What is a process?

A process is a running program together with everything it needs: memory,
open files and the user it runs as. Every process has a **PID** (*process
ID*) – a number that identifies it – and a parent, the **PPID**, that started
it. Everything begins with process number 1, `init` (on almost every
distribution that's `systemd`), which starts all the rest.

## My processes – `ps`

`ps` (*process status*) without options shows the processes in your own
terminal:

```sh
ps
```

You'll see your shell, `bash`, and `ps` itself – which only lives for as long
as it's running.

## All processes – `ps aux`

To see everything running on the computer, `ps aux` is the usual choice:

```sh
ps aux
```

| Column | Means |
|---|---|
| `USER` | The user the process runs as |
| `PID` | The process's ID number |
| `%CPU` / `%MEM` | How much processor and memory it uses |
| `STAT` | State: `R` running, `S` sleeping, `s` session leader |
| `COMMAND` | The command that started the process |

The list gets long, so it's often combined with `grep` or `sort`:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

The variant `ps -ef` shows the same processes but with the parent's PID in a
column of its own. If you just want the PID of a process whose name you know,
there's `pgrep`:

```sh
pgrep -l sshd
```

## A live view – `top` and `htop`

`top` shows the processes sorted by how much processor time they use and
refreshes every second – perfect for finding whatever is slowing the computer
down. At the top you'll see the load (*load average*), the number of
processes and the memory.

```sh
top
```

In a real terminal you quit `top` with `q`. Many people prefer `htop`, which
has colors and can be controlled with the mouse, but it usually has to be
installed first.

## Stopping processes – `kill`

The name is dramatic, but `kill` really sends a **signal** to a process. The
default signal, `SIGTERM` (15), asks the process to shut itself down nicely.
If it doesn't listen, you can send `SIGKILL` (9), which forces it to stop
immediately – but then it gets no chance to save or clean up.

```text
kill 1234        # ask process 1234 to exit (SIGTERM)
kill -9 1234     # force it (SIGKILL) – the last resort
```

If you know the name but not the PID, you can use `pkill` (matches a pattern)
or `killall` (exact name):

```text
pkill firefox
killall firefox
```

You may only send signals to your **own** processes. For processes that
belong to root or other users, you need `sudo`.

> **Find it and stop it!** Some process on this computer is using almost 100 %
> of the processor. Use `top` or `ps aux --sort=-%cpu` to find out what it's
> called and what its PID is – and then stop it.

## Foreground and background

When you run a command, the shell waits until it has finished; it runs in the
**foreground**. If you put `&` at the end, it runs in the **background**
instead, and you get your prompt back immediately:

```sh
sleep 300 &
```

The shell replies with the job number in square brackets and the process's
PID, for example `[1] 4200`. Programs started from the terminal are called
**jobs**:

```sh
jobs
```

| Command | Does |
|---|---|
| `jobs` | List the jobs in this terminal |
| `fg %1` | Bring job 1 to the foreground |
| `bg %1` | Let a stopped job continue in the background |
| `kill %1` | End job 1 |
| `Ctrl+C` | Interrupt the program in the foreground |
| `Ctrl+Z` | Pause the program in the foreground (resume with `fg` or `bg`) |

The variable `$!` holds the PID of the most recent background job. When a
job finishes, the shell tells you with a line like `[1]+  Done   sleep 300`.

## How is the computer doing?

Two small commands give you a quick overview:

```sh
uptime
free -h
```

`uptime` shows how long the computer has been running and the load over the
last 1, 5 and 15 minutes. `free -h` shows how much memory is in use. Note the
*available* column: Linux uses spare memory as a cache for files, so *free*
often looks low even though there's plenty of memory.

## The same everywhere

Processes work the same on every distribution. The tools come from the
**procps** package (called `procps-ng` on Arch and Fedora), and `killall`
from **psmisc**. What differs is which services are running from the start –
try comparing `ps aux` on {{distro}} with another distribution!
