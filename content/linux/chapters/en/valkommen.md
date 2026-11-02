# Welcome to the Linux shell

This guide teaches you how to use Linux from the command line – from your very
first commands all the way to package management on different distributions.
Each chapter explains one topic. Along the way there are short **questions** in
the text; answer them, and the terminal on the right and the chapter's
**tasks** unlock. A task is ticked off automatically as soon as you get it
right. The best way to learn is by *doing*: read, try, make mistakes, and try
again.

## What is Linux?

Strictly speaking, **Linux** is only the *kernel*: the program that talks to
the hardware and lets other programs share the processor, memory and disks.
The kernel was created by Linus Torvalds in 1991 and is free software.

To get a usable system you need a lot more than that: a shell, tools for
managing files, a package manager, perhaps a desktop. A **distribution**
(*distro*) bundles all of this into a ready-made whole. Debian, Ubuntu,
Arch Linux and Fedora are a few well-known examples.

Most of what you learn in this guide works the same on every distribution, so
that is where the course starts. The terminal here runs **Ubuntu 24.04 LTS**.
Distributions differ mainly in how software is installed – that comes in the
chapter on distributions.

## What is a shell?

A **shell** is the program that reads the commands you type and runs them.
The most common shell is **bash**, the default on almost every distribution.
Other popular shells are **zsh** (the default on macOS) and **fish**. The
basics are the same in all of them.

Note the difference between a *terminal* and a *shell*: the terminal is the
window that displays text, and the shell is the program running inside it.

```quiz
You type `ls` and press Enter. Which program reads the command and runs it?
- [ ] The terminal
- [x] The shell
- [ ] The kernel
---
The terminal only shows the text. The shell (here bash) reads what you type
and runs it.
```

## The prompt

When the shell is waiting for a command, it shows a **prompt**. In the
terminal here it looks like this:

```text
{{user}}@ubuntu:~$
```

It tells you who you are (`{{user}}`), which computer you are on (`ubuntu`)
and where in the file system you are (`~` means your home directory). The `$`
sign shows that you are a regular user. If you are the administrator (*root*),
you'll see a `#` instead.

```quiz
The prompt ends in `#` instead of `$`. What does that tell you?
- [ ] You are in your home directory
- [ ] The previous command failed
- [x] You are the administrator, root
```

## Your first command

Click in the terminal, type the command below and press **Enter**:

```sh
echo {{helloWorld}}
```

`echo` simply prints whatever you give it – here *{{helloWorld}}*. Most
commands follow the same pattern:

```text
command  -options  arguments
ls       -l        /etc
```

The *command* is the program to run, the *options* (or *flags*) change how it
behaves, and the *arguments* are what the command should work on.

```quiz
In the command `ls -l /etc`, which part is the **option**?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` is the command, `-l` changes how it behaves, and `/etc` is the argument –
what `ls` should work on.
```

Try `echo` with a text of your own:

```try
echo Linux is fun
---
`echo` printed exactly the words you gave it.
```

## Who and where am I?

Two small commands tell you about the system you're on. `whoami` prints the
name of the user you are logged in as. The file `/etc/os-release` describes
the distribution, and `cat` prints a file (more about `cat` in a later
chapter):

```sh
whoami
cat /etc/os-release
```

## How the simulator works

The terminal here is a **simulator** that runs entirely inside this app. It
behaves like a real Linux computer, but nothing you do can harm your own
machine – and if you do something silly, you can always start over with
*Reset terminal* in the settings.

- **Click a code example** to put the command in the terminal.
- **Tab** completes commands and file names.
- **Up/Down arrows** scroll through earlier commands.
- **Ctrl+L** clears the screen and **Ctrl+C** cancels the line you're typing.
- `help` lists all commands, and `man command` shows a manual page.

```quiz
You have typed `ech` and press **Tab**. What happens?
- [ ] The line is cancelled
- [x] The shell tries to fill in the rest of the name
- [ ] The screen is cleared
---
Tab completes commands and file names. **Ctrl+C** cancels the line and
**Ctrl+L** clears the screen.
```
