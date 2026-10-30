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

```quiz
A directory has the permissions `drwxr-x---`. What may members of its group do?
- [ ] Nothing at all
- [x] List the contents and enter it with `cd`, but not create or delete files in it
- [ ] Everything the owner may do
---
The group's set is `r-x`: `r` lets you list the contents and `x` lets you
enter the directory. Without `w` you can't create or delete files in it.
```

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

```predict
$ touch plan.txt
$ chmod 600 plan.txt
$ chmod g+r plan.txt
$ ls -l plan.txt | awk '{print $1}'
-rw-r-----
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

```quiz
You've written the script `test.sh` and run `./test.sh`, but get
`Permission denied`. What's missing?
- [ ] A `sudo` in front
- [x] The execute permission – run `chmod +x test.sh` first
- [ ] The `./` – it should be `test.sh`
---
To run a file as a program, it needs the `x` permission. The `./` is right:
without it, the shell only looks in the directories in `PATH`.
```

## root and sudo

Some files, like `/etc/shadow` where the passwords are stored, can only be read
by root. With `sudo` (*superuser do*) you run a single command as root:

```sh
sudo whoami
```

The first time, `sudo` asks for **your own** password. Only users in the
administrators' group may use sudo. On Ubuntu that group is called **sudo** –
you can see it among your groups when you run `id`. Some other distributions
call the group `wheel` instead; you'll read more about the differences
between distributions in the part about distributions.

If you need to run lots of commands as root, you can start a root shell with
`sudo -i`. The prompt then changes to `#`. Go back with `exit`.

> **Keep in mind!** With sudo there is no safety net. Only run commands you
> understand.

```quiz
`sudo` asks for a password. Whose password should you type?
- [ ] root's password
- [x] Your own password
- [ ] No password – just press Enter
---
`sudo` asks for **your own** password, and only lets you through if you're
in the administrators' group.
```

### A common trap

```text
sudo echo "text" > /etc/file     # does NOT work
```

It's *your* shell – not sudo – that opens the file for `>`. Use `tee`
instead, which runs with sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
Why doesn't `sudo echo "text" > /etc/file` work?
- [ ] `echo` can't be run with sudo
- [x] Your own shell opens the file for `>`, and it doesn't run as root
- [ ] Files in `/etc` can never be changed
---
sudo only applies to the command (`echo`). The redirection is handled by your
shell, which runs as you. `tee` is the program that writes the file, so it's
`tee` that needs sudo.
```
