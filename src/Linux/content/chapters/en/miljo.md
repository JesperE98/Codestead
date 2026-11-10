# Variables, PATH and aliases

The shell has a memory of its own in the form of **variables**. In this
chapter you'll learn how to read and set them, how the shell finds programs,
and how to make your own shortcuts.

## Environment variables

You read a variable by putting a `$` in front of its name:

```sh
echo $HOME
echo "My name is $USER"
```

`env` lists all *environment variables* – variables that the programs you
start can read too:

```sh
env
```

You create a variable with `NAME=value` (no spaces around the `=`!). With
`export` it becomes an environment variable:

```sh
export EDITOR=nano
```

```quiz
Which line creates the variable `COLOR` with the value `blue`?
- [ ] `COLOR = blue`
- [x] `COLOR=blue`
- [ ] `$COLOR=blue`
---
There must be no spaces around the `=`. With spaces, the shell thinks `COLOR`
is a command. The `$` is only used when you *read* a variable.
```

## Single and double quotes

There's an important difference:

```sh
echo "Home: $HOME"
echo 'Home: $HOME'
```

Inside **double** quotes, variables are replaced by their values. Inside
**single** quotes, everything is printed exactly as written.

```predict
$ x=linux
$ echo "I like $x"
$ echo 'I like $x'
I like linux
I like $x
```

## PATH – where are commands found?

When you type `ls`, the shell looks for a file called `ls` in the directories
listed in the `PATH` variable, one after another:

```sh
echo $PATH
```

A classic trick is to turn colons into newlines (`\n`), so that each
directory in `PATH` ends up on a line of its own:

```sh
echo $PATH | tr ':' '\n'
```

`which` shows where a program was found. Some commands, like `cd`, aren't
files at all but are *built into* the shell – `type` tells you what a name is:

```sh
which ls
type cd
```

If you want to run a program that isn't in `PATH`, you have to give its path,
for example `./myprogram` for a file in the directory you're in.

```quiz
You have a program called `hello` in the directory you're in, and that
directory isn't in `PATH`. How do you run it?
- [ ] `hello`
- [x] `./hello`
- [ ] `type hello`
---
Without a path, the shell only looks in the directories in `PATH`. `./hello`
says exactly where the file is: in the current directory.
```

## Exit codes – `$?`

Every command leaves an **exit code** when it finishes: `0` means everything
went well, anything else means an error. The most recent exit code is stored
in `$?`:

```sh
ls /{{missing}}
echo $?
```

It's the exit code that `&&` and `||` look at.

## Aliases

An **alias** is a shortcut of your own:

```sh
alias ll='ls -la'
ll
```

`alias` without arguments lists all aliases, and `unalias ll` removes one.

```predict
$ alias hi='echo Hello'
$ hi
Hello
```

## Saving settings – `~/.bashrc`

The variables and aliases you create disappear when you close the terminal.
To keep them, you put them in the file `~/.bashrc`, which bash reads every
time a new terminal is opened. After changing the file, you can load it
straight away with:

```sh
source ~/.bashrc
```

```quiz
You create an alias, close the terminal and open a new one. The alias is
gone. What should you have done?
- [ ] Run `alias` without arguments
- [x] Put the alias in `~/.bashrc`
- [ ] Created it with `export`
---
Everything you put in `~/.bashrc` is read again every time a new terminal is
opened.
```
