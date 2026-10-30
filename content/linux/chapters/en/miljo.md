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

## Single and double quotes

There's an important difference:

```sh
echo "Home: $HOME"
echo 'Home: $HOME'
```

Inside **double** quotes, variables are replaced by their values. Inside
**single** quotes, everything is printed exactly as written.

## PATH – where are commands found?

When you type `ls`, the shell looks for a file called `ls` in the directories
listed in the `PATH` variable, one after another:

```sh
echo $PATH
```

`which` shows where a program was found. Some commands, like `cd`, aren't
files at all but are *built into* the shell – `type` tells you what a name is:

```sh
which ls
type cd
```

If you want to run a program that isn't in `PATH`, you have to give its path,
for example `./myprogram` for a file in the directory you're in.

## Exit codes – `$?`

Every command leaves an **exit code** when it finishes: `0` means everything
went well, anything else means an error. The most recent exit code is stored
in `$?`:

```sh
ls /finnsinte
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

## Saving settings – `~/.bashrc`

The variables and aliases you create disappear when you close the terminal.
To keep them, you put them in the file `~/.bashrc`, which bash reads every
time a new terminal is opened. After changing the file, you can load it
straight away with:

```sh
source ~/.bashrc
```
