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
grep elev /etc/passwd
```

```text
elev:x:1000:1000:Elev,,,:/home/elev:/bin/bash
 1   2  3    4      5        6          7
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
getent passwd elev
```

### System users

Most lines in `/etc/passwd` aren't people. Services such as the web server
and the logging system run as their own users with as few rights as possible
– if they get hacked, the attacker can't reach your files. They have the
shell `nologin`, so nobody can log in as them:

:::debian
On Debian and Ubuntu the web server's user is called `www-data`:

```sh
grep www-data /etc/passwd
```
:::

:::arch
On Arch the web server's user is called `http`:

```sh
grep http /etc/passwd
```
:::

:::redhat
On Fedora there is for example `dbus`, which runs the system message bus:

```sh
grep dbus /etc/passwd
```
:::

With `awk` from the text processing chapter you can list everyone with UID
1000 or more – the regular users:

```sh
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

`nobody` (UID 65534) shows up too. It is a special user that owns "nothing"
and is used when a program should have as few rights as possible.

## Groups and GIDs

A **group** is a way to give several users the same rights, for example to a
shared project directory. Groups are listed in `/etc/group`:

```sh
cat /etc/group
```

```text
sudo:x:27:elev
 1   2  3   4
```

The fields are the group name, `x`, the group's number (**GID**) and a
comma-separated list of members.

Every user has **one primary group** (the GID field in `/etc/passwd`) and can
also be a member of any number of **supplementary groups**. New files you
create get your primary group. In most distributions every user gets a
private primary group with the same name – `elev` is in the group `elev`.

```sh
groups
id
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
chage -l elev
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
| `-c "Kim Svensson"` | The comment (full name) |
| `-G group1,group2` | Supplementary groups right away |

`useradd` finds the next free UID from 1000 upwards – `kim` gets 1001. The
limits are in `/etc/login.defs`. A group `kim` is created as well, and the
files in `/etc/skel` (*skeleton*) are copied into the new home directory. Put
something there and every new user gets it:

```sh
ls -a /etc/skel
```

This is where the distributions differ:

:::debian
On Debian and Ubuntu `useradd` is stingy: without `-m` **no** home directory
is created, and without `-s` the shell becomes `/bin/sh`. That's why there is
the friendlier script `adduser`, which belongs to the Debian family. It
creates the home directory, picks bash and asks for a password and name:

```sh
sudo adduser lisa
```

Answer the questions – you can press Enter for most of them. `adduser` can
also add an existing user to a group: `sudo adduser lisa sudo`.
:::

:::arch
On Arch no home directory is created without `-m`, and the `adduser` command
doesn't exist at all – try it:

```sh
adduser lisa
```

The Arch wiki recommends doing everything at once:
`useradd -m -G wheel -s /bin/bash name`.
:::

:::redhat
On Fedora the home directory is created even without `-m` (the setting
`CREATE_HOME` in `/etc/login.defs`), and the shell is bash. `-m` doesn't hurt
though, so get used to typing it – then the same command works everywhere.
:::

`useradd`, `passwd` and the other commands in this chapter are always
installed. The package is called `passwd` on Debian, `shadow` on Arch and
`shadow-utils` on Fedora – yet another example of the same thing having
different names.

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
sudo groupadd utvecklare
sudo usermod -aG utvecklare kim
groups kim
```

`-aG` means *append to Groups*. **Don't forget the `-a`!** With just `-G`
the list of supplementary groups is set to exactly what you type – and the
user is removed from every other group, such as the sudo group. A common way
to lock yourself out.

`gpasswd` does the same thing and can also remove members:

```sh
sudo gpasswd -a kim utvecklare
sudo gpasswd -d kim utvecklare
```

On a real computer a new group membership only takes effect the next time
the user logs in. The simulator is kinder – here it applies immediately.

Groups are used for shared directories. Make the group the owner and give it
write permission with `chgrp` and `chmod`:

```sh
sudo mkdir /srv/projekt
sudo chgrp utvecklare /srv/projekt
sudo chmod 775 /srv/projekt
ls -ld /srv/projekt
```

## Granting sudo rights – `sudo` or `wheel`

Who may use `sudo` is decided in `/etc/sudoers`:

```sh
sudo cat /etc/sudoers
```

The line `%{{adminGroup}} ALL=(ALL:ALL) ALL` means that everyone in the group
**{{adminGroup}}** may run every command as root. So giving someone sudo
rights is just a matter of adding them to the right group – and the group has
different names in different families:

:::debian
On Debian and Ubuntu the group is called `sudo`:

```sh
sudo usermod -aG sudo kim
```
:::

:::arch
On Arch the group is called `wheel` – an old Unix name for "the ones in
charge" (*big wheel*):

```sh
sudo usermod -aG wheel kim
```
:::

:::redhat
On Fedora the group is called `wheel` – an old Unix name for "the ones in
charge" (*big wheel*):

```sh
sudo usermod -aG wheel kim
```
:::

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
sudo useradd -m vikarie
sudo userdel -r vikarie
```

:::debian
The Debian family also has `deluser`, the counterpart of `adduser`:
`sudo deluser --remove-home vikarie`. `sudo deluser kim sudo` removes kim from
the group sudo.
:::

`userdel` refuses to delete a user who is logged in – try `sudo userdel elev`.

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
