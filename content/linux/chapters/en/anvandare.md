# Users and groups

Linux was built from the start for many people to share the same computer at
the same time. Every file has an owner and every program runs as a particular
user – which is why creating, changing and removing accounts is one of an
administrator's most important jobs. In this chapter you create the user
`kim`, give the account a password and sudo rights, and learn where it is all
stored.

## Users and UIDs

You already know how to find out who you are:

```sh
whoami
id
```

`id` shows that you have not just a name but also a number: `uid=1000`. That
is the **UID** (*user ID*), and it is the number – not the name – that the
kernel keeps track of. The name is only there so that we humans don't have to
remember numbers. Some important numbers:

| UID | Who |
|---|---|
| `0` | **root**, the administrator. Whoever has UID 0 may do anything. |
| `1`–`999` | **System users** for services and programs |
| `1000` and up | **Regular users** – people. The first one gets 1000. |

## The user list – `/etc/passwd`

All users are listed in the text file `/etc/passwd`, one line per user:

```sh
cat /etc/passwd
```

Each line has seven fields separated by colons. Look at your own line:

```sh
grep {{user}} /etc/passwd
```

```text
{{user}}:x:1000:1000:{{userFull}},,,:/home/{{user}}:/bin/bash
   1    2  3    4       5            6           7
```

| Field | Meaning |
|---|---|
| 1 | The user name |
| 2 | `x` – the password lives in `/etc/shadow` (see below) |
| 3 | UID |
| 4 | GID – the number of the user's **primary group** |
| 5 | Comment, usually the full name |
| 6 | The home directory |
| 7 | The shell started when the user logs in |

The `getent` command does the same lookup. The difference is that it also
finds users who aren't in the file, for example at a school or company where
the accounts live on a central server:

```sh
getent passwd {{user}}
```

### System users

Most lines in `/etc/passwd` aren't people. Services such as the web server
and the logging system run as their own users with as few rights as possible
– if they get hacked, the attacker can't reach your files. They have the
shell `nologin`, so nobody can log in as them. On Ubuntu the web server's
user is called `www-data` (the names of the system users differ between
distributions):

```sh
grep www-data /etc/passwd
```

With `awk` from the text processing chapter you can list everyone with UID
1000 or more – the regular users:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody` (UID 65534) shows up too. It is a special user that owns "nothing"
and is used when a program should have as few rights as possible.

```predict
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
---
Field 3 is the UID, and only root has UID 0. It is the number, not the name,
that gives root its powers.
```

## Groups and GIDs

A **group** is a way to give several users the same rights, for example to a
shared project directory. Groups are listed in `/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:{{user}}
 1   2  3   4
```

The fields are the group name, `x`, the group's number (**GID**) and a
comma-separated list of members.

Every user has **one primary group** (the GID field in `/etc/passwd`) and can
also be a member of any number of **supplementary groups**. New files you
create get your primary group. In most distributions every user gets a
private primary group with the same name – `{{user}}` is in the group `{{user}}`.

```sh
groups
id
```

```quiz
You (`{{user}}`) are in the groups `{{user}}` and `sudo`, and your primary group is
`{{user}}`. Which group gets a new file you create?
- [x] `{{user}}`
- [ ] `sudo`
- [ ] Both
- [ ] `root`
---
New files get your **primary** group – the GID field in `/etc/passwd`.
Supplementary groups like `sudo` give you extra rights, but don't end up on
your files.
```

## The passwords – `/etc/shadow`

Notice the `x` in field 2 of `/etc/passwd`. In the old days the (encrypted)
password was right there. The problem is that `/etc/passwd` **must** be
readable by everyone – that's where `ls -l` gets the owners' names from. So
anyone could copy the encrypted passwords and try to crack them at their
leisure. That's why they were moved to `/etc/shadow`, which only root can
read:

```sh
ls -l /etc/passwd /etc/shadow
sudo cat /etc/shadow
```

```text
kim:$y$j9T$Tm9...$Kx2...:20756:0:99999:7:::
```

Field 2 isn't the password itself but a **hash** – a "fingerprint" that can't
be reversed. When you log in, the hash of what you typed is computed and
compared with the stored one. `$y$` means the *yescrypt* method is used. A
`!` or `*` instead means there is no password, or that the account is
**locked**. The remaining fields are about when the password was last
changed and when it expires. `chage` shows them in plain text:

```sh
chage -l {{user}}
```

```try
chage -l {{user}}
---
`Password expires: never` – the password of `{{user}}` never has to be changed.
```

## Creating a user – `useradd`

Creating users requires root. The most common command exists in every
distribution:

```sh
sudo useradd -m -s /bin/bash kim
```

| Option | Meaning |
|---|---|
| `-m` | Create the home directory `/home/kim` |
| `-s /bin/bash` | The user's shell |
| `-c "Kim Jensen"` | The comment (full name) |
| `-G group1,group2` | Supplementary groups right away |

`useradd` finds the next free UID from 1000 upwards – `kim` gets 1001. The
limits are in `/etc/login.defs`. A group `kim` is created as well, and the
files in `/etc/skel` (*skeleton*) are copied into the new home directory. Put
something there and every new user gets it:

```sh
ls -a /etc/skel
```

On Ubuntu `useradd` is stingy: without `-m` **no** home directory is
created, and without `-s` the shell becomes `/bin/sh`. Other distributions
have other defaults, so get used to typing `-m` and `-s` – then the same
command works everywhere.

That's why Ubuntu also has the friendlier script `adduser`, which belongs to
the Debian family. It creates the home directory, picks bash and asks for a
password and name:

```sh
sudo adduser lisa
```

Answer the questions – you can press Enter for most of them. `adduser` can
also add an existing user to a group: `sudo adduser lisa sudo`.

`useradd`, `passwd` and the other commands in this chapter are always
installed. On Ubuntu they come in the package `passwd`; other families call
the package something else.

## Setting a password – `passwd`

A new account has no password (`!` in `/etc/shadow`), so nobody can log in to
it. Set one with `passwd`:

```sh
sudo passwd kim
```

You type the password twice. **What you type isn't shown** – no stars,
nothing. That's on purpose: someone looking over your shoulder shouldn't even
see how long the password is. Type it and press Enter.

`passwd` without a name changes your own password. Only root may change
other users' passwords – try without sudo:

```sh
passwd root
```

## Groups – `groupadd`, `usermod -aG` and `gpasswd`

Create a group and add a member:

```sh
sudo groupadd {{devGroup}}
sudo usermod -aG {{devGroup}} kim
groups kim
```

`-aG` means *append to Groups*. **Don't forget the `-a`!** With just `-G`
the list of supplementary groups is set to exactly what you type – and the
user is removed from every other group, such as the sudo group. A common way
to lock yourself out.

```quiz
`kim` is in the supplementary groups `sudo` and `{{devGroup}}`. An
administrator runs `sudo usermod -G backup kim`. Which supplementary groups
is kim in afterwards?
- [ ] `sudo`, `{{devGroup}}` and `backup`
- [x] Only `backup`
- [ ] `sudo` and `{{devGroup}}` – the command fails without `-a`
- [ ] None
---
Without `-a` the list is set to exactly what you type. With
`sudo usermod -aG backup kim` kim would have kept the other groups.
```

`gpasswd` does the same thing and can also remove members:

```sh
sudo gpasswd -a kim {{devGroup}}
sudo gpasswd -d kim {{devGroup}}
```

On a real computer a new group membership only takes effect the next time
the user logs in. The simulator is kinder – here it applies immediately.

Groups are used for shared directories. Make the group the owner and give it
write permission with `chgrp` and `chmod`:

```sh
sudo mkdir /srv/project
sudo chgrp {{devGroup}} /srv/project
sudo chmod 775 /srv/project
ls -ld /srv/project
```

## Granting sudo rights – the `sudo` group

Who may use `sudo` is decided in `/etc/sudoers`:

```sh
sudo cat /etc/sudoers
```

The line `%sudo ALL=(ALL:ALL) ALL` means that everyone in the group **sudo**
may run every command as root. So giving someone sudo rights is just a
matter of adding them to the right group – on Ubuntu the group `sudo`:

```sh
sudo usermod -aG sudo kim
```

The group has different names in different families: on Arch and Fedora it
is called `wheel` – an old Unix name for "the ones in charge" (*big wheel*).

Never edit `/etc/sudoers` directly with an ordinary editor – a typo can mean
nobody can use sudo any more. Use `visudo`, which checks the file before
saving it. Usually the groups are all you need.

## Switching users – `su` and `sudo -u`

There are two ways to become someone else:

| Command | Whose password? | What happens |
|---|---|---|
| `su - kim` | **kim's** | You are logged in as kim until you type `exit` |
| `sudo -u kim command` | **your own** (you need sudo rights) | A single command runs as kim |
| `sudo -iu kim` | your own | A login shell as kim |

```sh
sudo -u kim whoami
```

With `su` you really switch. The dash (`-`) makes it a login: you end up in
kim's home directory with kim's settings. The prompt shows who you are, and
`exit` takes you back:

```sh
su - kim
```

`su` without a name means root. On Ubuntu root has no password, so `su -`
doesn't work there – use `sudo -i`.

```quiz
You want to run a single command as `kim`, but you don't know kim's
password. You do have sudo rights. What works?
- [ ] `su - kim`
- [x] `sudo -u kim command`
- [ ] `su kim command`
- [ ] Nothing – you need kim's password
---
`su` asks for the password of the user you become. `sudo` asks for **your
own** password and checks in `/etc/sudoers` that you may do it.
```

## Locking and deleting accounts

An account that shouldn't be used for a while can be **locked**.
`usermod -L` puts a `!` in front of the hash in `/etc/shadow`, so that no
password matches any more. `-U` unlocks it:

```sh
sudo usermod -L kim
sudo passwd -S kim
sudo usermod -U kim
```

`passwd -S` shows the status: `P` (has a password), `L` (locked) or `NP` (no
password). With `chage -E` an account can expire on a certain date – handy
for summer workers and substitutes.

Before you delete someone it can be good to see who is logged in and when
someone last was:

```sh
who
last
```

Then `userdel` removes the user. With `-r` the home directory goes too –
without `-r` the files are left behind:

```sh
sudo useradd -m {{tempUser}}
sudo userdel -r {{tempUser}}
```

Ubuntu also has `deluser`, the counterpart of `adduser`:
`sudo deluser --remove-home {{tempUser}}`. `sudo deluser kim sudo` removes kim from
the group sudo.

`userdel` refuses to delete a user who is logged in – try `sudo userdel {{user}}`.

## Summary

| Command | Does |
|---|---|
| `id`, `groups` | Show UID, GID and groups |
| `useradd -m -s /bin/bash name` | Create a user |
| `passwd name` | Set a password |
| `usermod -aG group name` | Add to a group |
| `groupadd group` | Create a group |
| `usermod -L` / `-U` | Lock / unlock |
| `userdel -r name` | Delete the user and the home directory |
| `su - name`, `sudo -u name` | Switch user |
| `/etc/passwd`, `/etc/group`, `/etc/shadow` | Where it's all stored |
