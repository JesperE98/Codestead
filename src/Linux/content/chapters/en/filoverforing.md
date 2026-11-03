# Copying files over SSH

In the networking chapter you ran commands on the server `192.168.1.10` with
`ssh`. Here you give the server a short name, copy files to and from it with
`scp`, and keep whole directories in sync with `rsync`.

## Short names – `~/.ssh/config`

Typing `ssh {{user}}@192.168.1.10` every time gets old. In the file
`~/.ssh/config` you can give a server a short name:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` is the short name, `HostName` the real address (or name) and `User`
the user name on the server. If the server listens on another port than 22,
add a line like `Port 2222`. After that this is enough:

```sh
ssh srv hostname
```

The simulator has no text editor yet, so write the file with `echo`. The
indentation is only there to make it easier to read:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

ssh is strict about the file. If others may write to it, ssh refuses with
*Bad owner or permissions*, and a misspelled word stops it at once:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
ssh reads the whole file before it connects, so one wrong word stops every
connection – and the error message says which line it is on.
```

The names work for `scp` and `rsync` too.

```quiz
In `~/.ssh/config`, which line says where ssh should really connect?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` is the short name you type yourself, `HostName` the real address and
`User` who you log in as.
```

## Copying – `scp`

`scp` (*secure copy*) works like `cp`, but one side can be on another
computer. You write it `HOST:PATH`:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- The source comes first and the target last, just like with `cp`.
- A path after the colon counts from your home directory on the server, and
  `srv:` alone means the home directory.
- Directories need `-r`.
- The port is given with a capital `-P` (with `ssh` it is a small `-p`).

For every file, `scp` shows a line with the name, `100%`, the size and the
speed.

```quiz
You type `scp report.txt srv` – without a colon. What happens?
- [ ] The file is copied to your home directory on the server
- [x] You get a local copy called `srv`
- [ ] scp asks which computer you mean
---
Without the colon, `srv` is just a file name, and `scp` copies locally like
`cp`. It is easy to forget the colon!
```

## Keeping in sync – `rsync`

For many files, or something you copy again and again (backups!), `rsync` is
better. It only copies what is missing or has changed:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

`-a` (*archive*) copies directories recursively and keeps permissions and
times, and `-v` lists what is copied. Run the same command again and the list
is empty – nothing has changed. rsync compares each file's size and
modification time; without `-a` the copies get new times, and everything is
sent every time.

### The slash at the end

A slash at the end of the source is important:

| Command | Gives |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – the directory itself |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – only what is in it |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Without the slash, the directory itself was copied into `/tmp/x`.
```

### Over SSH and `--delete`

With a server as the target, rsync goes over ssh:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

`--delete` also removes files at the target that no longer exist in the
source, so the target becomes an exact copy. A wrong path can then remove a
lot, so try first with `-n` (*dry run*). Nothing happens, rsync only shows
what it would do, and the last line ends with `(DRY RUN)`:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
What does `-n` do in `rsync -avn --delete a/ b/`?
- [ ] Copies only new files
- [x] Shows what would happen without doing anything
- [ ] Skips the files that would be removed
---
`-n` is a dry run. Check the list first – then run the same command without
`-n`.
```

## scp or rsync?

| | `scp` | `rsync` |
|---|---|---|
| Good for | A few files, once | Backups and copying again and again |
| Sends | Everything, every time | Only what has changed |
| Locally too | Works, but `cp` is simpler | Yes |
| Mirror with `--delete` | No | Yes |

`scp` comes with the ssh client. `rsync` must be installed on both computers:
it is there from the start on Ubuntu, Debian and Fedora, while on Arch you
install the package `rsync`.

In the simulator the server forgets its files when you close the app.
