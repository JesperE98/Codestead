# Welcome to the Linux shell

This guide teaches you how to use Linux from the command line – from your very
first commands all the way to package management on different distributions.
Each chapter explains one topic and ends with a set of **tasks** that you solve
in the terminal on the right. A task is ticked off automatically as soon as you
get it right. The best way to learn is by *doing*: read, try, make mistakes,
and try again.

## What is Linux?

Strictly speaking, **Linux** is only the *kernel*: the program that talks to
the hardware and lets other programs share the processor, memory and disks.
The kernel was created by Linus Torvalds in 1991 and is free software.

To get a usable system you need a lot more than that: a shell, tools for
managing files, a package manager, perhaps a desktop. A **distribution**
(*distro*) bundles all of this into a ready-made whole. Right now you are
running **{{distro}}**.

Distributions are grouped into *families* that build on one another and share
a package manager:

| Family | Package manager | Examples |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

Most of what you learn in this guide works the same everywhere. The things
that differ – mainly package management – get chapters of their own. You can
switch distribution at any time from the menu at the top.

## What is a shell?

A **shell** is the program that reads the commands you type and runs them.
The most common shell is **bash**, the default on almost every distribution.
Other popular shells are **zsh** (the default on macOS) and **fish**. The
basics are the same in all of them.

Note the difference between a *terminal* and a *shell*: the terminal is the
window that displays text, and the shell is the program running inside it.

## The prompt

When the shell is waiting for a command, it shows a **prompt**. On {{distro}}
it looks something like this:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

It tells you who you are (`elev`), which computer you are on (`{{hostname}}`)
and where in the file system you are (`~` means your home directory). The `$`
sign shows that you are a regular user. If you are the administrator (*root*),
you'll see a `#` instead.

## Your first command

Click in the terminal, type the command below and press **Enter**:

```sh
echo Hej världen
```

`echo` simply prints whatever you give it – here *Hej världen*, which is
Swedish for "Hello world". Most commands follow the same pattern:

```text
command  -options  arguments
ls       -l        /etc
```

The *command* is the program to run, the *options* (or *flags*) change how it
behaves, and the *arguments* are what the command should work on.

## How the simulator works

The terminal here is a **simulator** that runs entirely in your browser. It
behaves like a real Linux computer, but nothing you do can harm your own
machine – and if you do something silly, you can always start over with the
*Reset* button.

- **Click a code example** to put the command in the terminal.
- **Tab** completes commands and file names.
- **Up/Down arrows** scroll through earlier commands.
- **Ctrl+L** clears the screen and **Ctrl+C** cancels the line you're typing.
- `help` lists all commands, and `man command` shows a manual page.

### A few Swedish words

This guide was originally written in Swedish, so the user and the practice
files in the simulator have Swedish names. You don't need to speak Swedish –
the commands are exactly the same – but this little glossary may help:

| Name | Meaning |
|---|---|
| `elev` | student (your user name) |
| `dokument` | documents |
| `anteckningar.txt` | notes |
| `frukter.txt` | fruits |
| `betyg.csv` | grades |
| `bilder` | pictures |
| `gammalt` | old stuff |
