# Users, permissions and sudo

Linux is built so that several users can share the same computer. That's why
every file has an owner and rules for who may do what.

## Users and groups

You're logged in as the user `elev`. Every user belongs to one or more
**groups**:

```sh
id
```

The most important user is **root** – the administrator, who is allowed to do
anything. You rarely log in as root. Instead you use `sudo` (see below).

## Reading permissions

Run `ls -l` and look at the first column:

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

The first character is the type: `-` for a file, `d` for a directory. Then
come three sets of three characters each:

```text
-     rw-     r--     r--
type  owner   group   others
```

| Character | For a file | For a directory |
|---|---|---|
| `r` (read) | Read the contents | List the contents |
| `w` (write) | Change the contents | Create and delete files in it |
| `x` (execute) | Run the file as a program | Enter the directory with `cd` |

After that come the owner (`elev`) and the group (`elev`).

## Changing permissions – `chmod`

Permissions can be given as **numbers**. Each set gets a digit that is the
sum of r = 4, w = 2 and x = 1:

| Number | Permissions | Typical for |
|---|---|---|
| `755` | `rwxr-xr-x` | Programs and directories |
| `644` | `rw-r--r--` | Ordinary files |
| `600` | `rw-------` | Secret files |

```sh
chmod 644 anteckningar.txt
```

Or with **symbols**: `u` (the owner), `g` (the group), `o` (others), `a` (all),
followed by `+`, `-` or `=` and the permissions:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## Scripts

A **script** is a text file containing commands. The first line,
`#!/bin/bash`, is called the *shebang* and tells the system which program
should run the file:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Today is:"; date' >> datum.sh
cat datum.sh
```

To run the script as a program, it has to be executable:

```sh
chmod +x datum.sh
./datum.sh
```

The `./` is needed because the directory you're in isn't part of `PATH`.

## root and sudo

Some files, like `/etc/shadow` where the passwords are stored, can only be read
by root. With `sudo` (*superuser do*) you run a single command as root:

```sh
sudo whoami
```

The first time, `sudo` asks for **your own** password. Only users in the
administrators' group may use sudo. On {{distro}} that group is called
**{{adminGroup}}**:

:::debian
In the Debian family the group is called `sudo`.
:::

:::arch
In the Arch family the group is called `wheel` – an old Unix name for "the
ones in charge" (a *big wheel*).
:::

:::redhat
In the Red Hat family the group is called `wheel` – an old Unix name for "the
ones in charge" (a *big wheel*).
:::

If you need to run lots of commands as root, you can start a root shell with
`sudo -i`. The prompt then changes to `#`. Go back with `exit`.

> **Keep in mind!** With sudo there is no safety net. Only run commands you
> understand.

### A common trap

```text
sudo echo "text" > /etc/file     # does NOT work
```

It's *your* shell – not sudo – that opens the file for `>`. Use `tee`
instead, which runs with sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
