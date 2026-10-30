# Other shells: zsh and fish

So far you have typed every command in **bash**. But bash is just one of
several shells – and many people prefer something else. In this chapter you
install two popular alternatives, **zsh** and **fish**, try them out and see
how they differ from bash. You will also learn why scripts are still almost
always written for bash.

## What is a shell, again?

The **shell** is the program that reads what you type, interprets it and
starts other programs. It is the shell that understands `|`, `>`,
`$VARIABLES`, wildcards like `*.txt` and loops. The terminal is just the
window the shell runs in.

Programs like `ls`, `grep` and `cat` are separate programs in `/usr/bin` – they
work the same whichever shell you use. What differs between shells is **the
language around them**: how variables are set, how loops and conditions are
written, what the prompt looks like and which conveniences are available.

## The family tree: sh, bash, zsh and fish

| Shell | Since | Characteristics |
|---|---|---|
| `sh` | 1979 | The Bourne shell. Today's `sh` follows the **POSIX** standard and is the lowest common denominator. |
| `bash` | 1989 | *Bourne Again SHell*. The default in almost every Linux distribution. |
| `zsh` | 1990 | Largely bash-compatible, but with more features. The default on macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Easy to use, but with **its own syntax**. |

**POSIX** is a standard that describes how an `sh` shell should behave. A
script that only uses POSIX features works in every `sh`-compatible shell:
bash, zsh, `dash` (which is `/bin/sh` on Debian and Ubuntu) and `ash` (on
small systems like Alpine). fish is deliberately **not** POSIX-compatible –
that is what makes it simpler, but also different.

## Which shells are installed?

The file `/etc/shells` lists the shells that may be used as login shells:

```sh
cat /etc/shells
```

Which shell you get when you log in is the last field of your line in
`/etc/passwd`, and it is also in the variable `$SHELL`:

```sh
grep elev /etc/passwd
echo $SHELL
```

## zsh – bash with extras

### Install zsh

zsh has the same package name in every family:

:::debian
```sh
sudo apt update
sudo apt install zsh
```
:::

:::arch
```sh
sudo pacman -S zsh
```
:::

:::redhat
```sh
sudo dnf install zsh
```
:::

Look at `/etc/shells` again – the package has added `/usr/bin/zsh` (and
`/bin/zsh`):

```sh
cat /etc/shells
```

### Start zsh

A shell is a program like any other, so you start zsh by typing its name:

```sh
zsh
```

The first time, you are greeted by **zsh-newuser-install**, because you don't
have a configuration file for zsh yet. It is a menu that helps you get
started:

| Key | Does |
|---|---|
| `q` | Quit without doing anything (you are asked again next time) |
| `0` | Create an almost empty `~/.zshrc` |
| `1` | The main menu with all settings (not available in the simulator) |
| `2` | Create `~/.zshrc` with the recommended settings |

Answer `2`. The prompt changes to `elev@{{hostname}} ~ %` – in zsh, `%` is
the usual sign for a regular user (root gets `#`, just like in bash).

Which shell are you running now? The variable `$0` holds the name of the
shell:

```sh
echo $0
ps
```

`ps` shows that zsh runs **inside** bash: bash started zsh as a new process.
Notice also that `$SHELL` is still `/bin/bash` – that variable tells you your
*login shell*, not which shell you happen to be running right now.

```sh
echo $SHELL
```

### Most things work like in bash

zsh understands almost all bash syntax. Pipes, redirection, variables, `if`,
`for` and functions work the way you are used to:

```sh
for f in ~/dokument/*.txt; do wc -l $f; done
```

### Feature 1: `**` searches all subdirectories

In zsh, `**/` means "all directories, at every level". This lists every
`.txt` file in your home directory and everything below it:

```sh
ls ~/**/*.txt
```

In bash, `**` works like a plain `*` – unless you first turn it on with
`shopt -s globstar`.

### Feature 2: autocd

With the `autocd` option (part of the recommended settings) you only need to
type the name of a directory to go there – no `cd`:

```sh
dokument
..
```

Options are turned on and off with `setopt` and `unsetopt`:

```sh
setopt
unsetopt autocd
setopt autocd
```

### A difference to watch out for: variables are not split

In bash, an unquoted variable is split on spaces. In zsh it is not:

```sh
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

bash prints `[a.txt]` and `[b.txt]` – zsh prints `[a.txt b.txt]`. The zsh way
is usually what you want, but it means that a bash script does not always do
the same thing in zsh. (With `setopt shwordsplit`, zsh behaves like bash.)

### ~/.zshrc and the prompt

bash reads `~/.bashrc` when it starts – zsh reads `~/.zshrc`. Look at the file
zsh-newuser-install created:

```sh
cat ~/.zshrc
```

The prompt is set by the variable `PROMPT` and uses `%` codes:

| Code | Means |
|---|---|
| `%n` | The user name |
| `%m` | The computer's name |
| `%~` | The whole directory (with `~` for your home directory) |
| `%1~` | Only the last part of the directory |
| `%#` | `%` for regular users, `#` for root |
| `%F{green}` … `%f` | Colour (red, green, blue, yellow …) |

Try it:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

The change only lasts until you leave zsh. If you want it every time, put the
line in `~/.zshrc`.

### Oh My Zsh

Many zsh users install **Oh My Zsh**, a collection of themes and plugins – for
example Git information in the prompt, better tab completion and suggestions
while you type. It is installed with a script from the project's website and
configured in `~/.zshrc`. It is not available in the simulator, but now you
know what people mean when they talk about it.

### Back to bash

zsh is a process running inside bash. Leave it with `exit` and you are back in
bash – where variables, aliases and directory changes from zsh are gone:

```sh
exit
echo $0
```

## fish – the friendly interactive shell

fish wants to be easy to use right away, without configuration: colours, tab
completion and **autosuggestions** – fish suggests the rest of the command in
grey text, based on your history, and you accept the suggestion with the
right arrow key. (The simulator shows no suggestions, but the syntax works.)

### Install and start fish

:::debian
```sh
sudo apt update
sudo apt install fish
```
:::

:::arch
```sh
sudo pacman -S fish
```
:::

:::redhat
```sh
sudo dnf install fish
```
:::

```sh
fish
```

fish welcomes you and the prompt becomes `elev@{{hostname}} ~>`. Go down a
few directories and see how fish shortens the path in the prompt:

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

In the directory `~/dokument/projekt` the prompt shows `~/d/projekt>` – every
directory except the last is shortened to one letter.

### fish has its own syntax

This is where fish differs most from bash and zsh:

| This | bash and zsh | fish |
|---|---|---|
| Set a variable | `frukt=äpple` | `set frukt äpple` |
| Environment variable | `export EDITOR=nano` | `set -x EDITOR nano` |
| Remove a variable | `unset frukt` | `set -e frukt` |
| Command substitution | `$(pwd)` | `(pwd)` |
| Last exit status | `$?` | `$status` |
| Script arguments | `$@`, `$1` | `$argv`, `$argv[1]` |
| Condition | `if …; then …; fi` | `if …; …; end` |
| Loop | `for …; do …; done` | `for …; …; end` |
| Function | `hej() { …; }` | `function hej; …; end` |
| Arithmetic | `$((17 * 23))` | `math 17 x 23` |

### Variables with set

Try setting a variable the bash way (`frukt` is Swedish for fruit, `äpple`
for apple):

```sh
frukt=äpple
```

fish refuses and tells you how to write it:

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

This is how it is done in fish:

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

`-x` (*export*) makes the variable an environment variable that programs you
start can see, and `-e` (*erase*) removes it.

In fish, every variable is a **list**. The elements are numbered from 1:

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

### Command substitution and $status

In fish, command substitution is written with plain parentheses:

```sh
echo "I am in" (pwd)
```

Inside quotes, parentheses are ordinary text – that is why `(pwd)` is outside.
The exit status of the last command is called `$status`:

```sh
false
echo $status
```

### and, or and not

fish has its own commands for chaining conditions:

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

Newer versions of fish (3.0 and later) also understand `&&` and `||`, and from
3.4 `$(...)` works too. But `X=1`, `$?` and `$((...))` still do not work –
they give errors that tell you the fish way.

### Blocks end with end

In fish, every block – `if`, `for`, `while`, `switch` and `function` – ends
with `end`. There is no `then`, `do`, `done` or `fi`:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

You can also write the block over several lines. The shell waits for `end`
before it runs the loop:

```sh
for f in ~/dokument/*.txt
echo (basename $f)
end
```

Functions get their arguments in the list `$argv`:

```sh
function hello; echo "Hello $argv!"; end
hello Kim
```

### Arithmetic with math

fish has no `$((...))`. Instead there is the `math` command, which also
handles decimals:

```sh
math 17 x 23
math 10 / 4
```

Write `x` (or `"17 * 23"` in quotes) for multiplication – a lone `*` is a
wildcard in fish, just like in bash.

### fish settings

fish reads `~/.config/fish/config.fish` when it starts. If you want to get
rid of the welcome message, empty the variable `fish_greeting`. With `-U` the
variable becomes **universal**: it is saved in
`~/.config/fish/fish_variables` and applies in every fish shell, even after a
restart.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Leave fish with `exit`:

```sh
exit
```

## Why scripts are still written for bash

Which shell you use in the terminal is a matter of taste. But **scripts** are
almost always written for bash (or for POSIX `sh`):

- bash is installed on practically every Linux system – zsh and fish are not.
- fish syntax does not work in bash, and vice versa.
- The `#!` line at the top of the script decides which shell runs it –
  **regardless** of which shell you are sitting in.

Try writing a bash script and running it from fish:

```sh
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
name=Kim
echo "Hello $name, I am run by bash"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

The script works in fish, even though `name=Kim` is forbidden there – because
bash runs it. That is why `#!/bin/bash` (or `#!/usr/bin/env bash`) matters so
much. A script that must work everywhere, even where bash is missing, is
written with `#!/bin/sh` and POSIX syntax only.

## Changing your default shell with chsh

Typing `zsh` every time you open a terminal gets old. With `chsh` (*change
shell*) you change your **login shell** – the one in `/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- The shell must be given with its full path and be listed in `/etc/shells`.
- `chsh` asks for your password (the simulator skips it).
- The change takes effect at the **next login**. The terminal you have open
  keeps its old shell, and `$SHELL` only changes once you have logged in
  again.
- root can change the shell for others: `sudo chsh -s /usr/bin/fish kim`.

:::arch
On Arch, `chsh -l` lists all valid shells.
:::

:::redhat
On Fedora, `chsh -l` lists all valid shells.
:::

To go back to bash, do the same:

```sh
chsh -s /bin/bash
```

A common piece of advice for fish is to keep bash as your login shell and let
the terminal program start fish instead – then everything that expects a
POSIX shell at login keeps working.

## Which shell should you choose?

- **bash** – the default everywhere. What you learn here works on every server
  you will ever log in to. Write your scripts for bash.
- **zsh** – for you who want more comfort but keep the bash syntax. Oh My Zsh
  gives you themes and plugins.
- **fish** – the best out-of-the-box experience, but with a different syntax.
  Commands you copy from the web do not always work.
- **sh/dash** – for scripts that must work everywhere, and on small systems.

## Summary

| Command | Does |
|---|---|
| `cat /etc/shells` | List the shells that may be used |
| `echo $0` / `ps` | See which shell you are running right now |
| `echo $SHELL` | See your login shell |
| `zsh` / `fish` / `exit` | Start another shell / go back |
| `ls ~/**/*.txt` | Search all subdirectories (zsh, fish) |
| `setopt autocd` | Turn on a zsh option |
| `set frukt äpple` | Set a variable in fish |
| `set -x NAME value` | Set an environment variable in fish |
| `chsh -s /usr/bin/zsh` | Change your login shell |

The configuration files: `~/.bashrc` (bash), `~/.zshrc` (zsh) and
`~/.config/fish/config.fish` (fish).
