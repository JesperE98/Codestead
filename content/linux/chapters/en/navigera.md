# Navigating the file system

Linux has no drive letters like `C:`. Everything – hard drives, USB sticks,
even hardware – lives in **one single tree** of directories that starts at the
**root**, written `/`.

## The most important directories

| Directory | Contents |
|---|---|
| `/` | The root – the top of the tree |
| `/home` | Users' home directories, e.g. `/home/elev` |
| `/root` | The home directory of the administrator, root |
| `/etc` | System settings (configuration files) |
| `/usr/bin` | Programs (commands) such as `ls` and `cat` |
| `/var/log` | Log files |
| `/tmp` | Temporary files that anyone may write |
| `/dev` | Devices, e.g. disks |
| `/proc` | Information about processes and the kernel |
| `/boot` | Files needed to start the computer |

This layout is called the *Filesystem Hierarchy Standard*, and it is almost
identical across distributions.

## Where am I? – `pwd`

`pwd` (*print working directory*) shows the directory you are currently in:

```sh
pwd
```

## What's here? – `ls`

`ls` lists the contents of a directory. Without arguments it shows the
directory you're in, but you can also name another one:

```sh
ls /etc
```

The `-l` option gives you a long format with more information:

```sh
ls -l
```

Files whose names start with a dot are **hidden** and aren't shown by default.
They are often settings files, like `.bashrc`. The `-a` (*all*) option shows
them:

```sh
ls -a
```

Options can be combined: `ls -la` is the same as `ls -l -a`.

## Changing directory – `cd`

`cd` (*change directory*) moves you to another directory:

```sh
cd /var/log
```

There are two kinds of paths:

- An **absolute** path starts with `/` and begins at the root, e.g.
  `/var/log`. It works no matter where you are.
- A **relative** path starts from the directory you're in. If you are in `/`,
  you can reach `/var/log` with just `cd var/log`.

A few special names are worth knowing:

| Name | Means |
|---|---|
| `.` | The directory you're in |
| `..` | The directory above (the parent) |
| `~` | Your home directory |
| `-` | (only with `cd`) the directory you were in last |

`cd` without arguments always takes you home.

```sh
cd ..
```

## Tab completion

You rarely need to type out full names. Type the beginning, for example
`cd /va`, and press **Tab** – the shell fills in the rest. If there are
several possibilities, they're shown when you press Tab. Experienced Linux
users press Tab all the time!
