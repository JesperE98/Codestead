# Archives and compression

Sooner or later you'll want to send a whole directory to someone, make a
backup or download the source code of a program. Then lots of files need to
become **one** file – and preferably a smaller one. On Linux this is usually
done by two different programs working together.

## Archiving and compressing – two different things

- **Archiving** means collecting many files and directories into a single
  file, an *archive*. Permissions, owners and timestamps come along too. The
  program is called `tar` (from *tape archive* – it was written for tape drives
  in the 1970s). An archive is **not** smaller than the files in it – if
  anything, it's bigger.
- **Compressing** means making a file smaller by encoding repetition more
  cleverly. The most common program is `gzip`. It only handles one file at a
  time and knows nothing about directories.

That's why they're used together: first `tar` to get a single file, then
`gzip` to make it smaller. The result is called `.tar.gz`, or `.tgz` for
short. It's the Unix philosophy in a nutshell – small programs that each do
one thing and can be combined.

| File extension | What is it? | Unpack with |
|---|---|---|
| `.tar` | Archive, uncompressed | `tar -xf` |
| `.gz` | A single compressed file | `gunzip` |
| `.tar.gz`, `.tgz` | Compressed archive | `tar -xzf` |
| `.zip` | Archive and compression in one (common on Windows) | `unzip` |

You'll also come across `.tar.xz`, `.tar.bz2` and `.tar.zst`. Same idea, but
with other compression programs (`xz`, `bzip2` and `zstd`).

## Packing with `tar`

Go to your home directory and pack up the `dokument` directory:

```sh
cd ~
tar -cvf dokument.tar dokument
```

```text
dokument/
dokument/frukter.txt
dokument/server.log
```

`-c` means *create an archive*, `-v` tells tar to show what it's doing and
`-f` says that the name of the archive file comes next. Everything after the
archive name gets packed – as many files and directories as you like.

> **Note!** The order is *archive first, then the files*. If you get the
> order wrong, as in `tar -cvf dokument dokument.tar`, tar tries to overwrite
> the directory – or worse, a file you wanted to keep.

## The options to remember

| Option | Stands for | Means |
|---|---|---|
| `c` | **c**reate | Create a new archive |
| `x` | e**x**tract | Unpack |
| `t` | lis**t** (*table of contents*) | List the contents |
| `v` | **v**erbose | Show the files being processed |
| `f` | **f**ile | The archive file's name comes next |
| `z` | g**z**ip | Compress or decompress with gzip |

Exactly **one** of `c`, `x` and `t` must be present – it tells tar *what* to
do. The rest are modifiers. A common mnemonic:

- **c**reate **z**ipped **v**erbose **f**ile → `tar -czvf`
- e**x**tract **z**ipped **v**erbose **f**ile → `tar -xzvf`
- lis**t** **z**ipped **v**erbose **f**ile → `tar -tzvf`

Always put `f` **last** when you write the options together, since the file
name must come right after it. For historical reasons you can also leave out
the dash: `tar czvf` means the same as `tar -czvf`.

## Compressing with `-z`

Add `z` and the archive is sent through gzip on the way:

```sh
tar -czvf dokument.tar.gz dokument
ls -l dokument.tar dokument.tar.gz
```

```text
-rw-r--r-- 1 elev elev 10240 Oct 30 12:00 dokument.tar
-rw-r--r-- 1 elev elev   674 Oct 30 12:00 dokument.tar.gz
```

The uncompressed archive is a whole 10,240 bytes, even though the files add
up to just under 900 bytes. That's because tar puts a 512-byte header before
each file and pads the archive out to whole blocks. All that empty space is
compressed away by gzip.

The `du` command (*disk usage*) shows how much space something takes up on
disk. With `-h` you get human-readable sizes, and with `-s` a total for a
whole directory:

```sh
du -h dokument.tar dokument.tar.gz
du -sh dokument
```

```text
12K	dokument.tar
4.0K	dokument.tar.gz
12K	dokument
```

The disk is divided into blocks of 4 KiB, so `du` never shows less than
`4.0K` for a file that isn't empty. To see the exact size, use `ls -l` (or
`ls -lh`).

## Look inside an archive before unpacking

```sh
tar -tzvf dokument.tar.gz
```

```text
drwxr-xr-x elev/elev         0 2026-10-30 12:00 dokument/
-rw-r--r-- elev/elev        64 2026-10-30 12:00 dokument/frukter.txt
-rw-r--r-- elev/elev       848 2026-10-30 12:00 dokument/server.log
```

With `v`, the contents are shown as in `ls -l`, with permissions, owner and
size. Looking first is a good habit: some archives have no common top-level
directory and will scatter hundreds of files wherever you happen to be when
you unpack them.

## Unpacking

```sh
mkdir uppackat
tar -xzvf dokument.tar.gz -C uppackat
```

`-C` (capital C) chooses the directory tar unpacks into (*uppackat* means
"unpacked"). Without it, everything ends up in the directory you're in.
Modern versions of tar detect by themselves whether an archive is compressed
when unpacking, so `tar -xf dokument.tar.gz` works too.

> **Warning!** tar doesn't ask before overwriting files that already exist.
> List the contents first if you're unsure.

### Absolute paths

If you pack an absolute path, the leading `/` is removed so that the archive
can be unpacked anywhere:

```sh
tar -czf backup.tar.gz ~/dokument
```

```text
tar: Removing leading `/' from member names
```

The archive now contains `home/elev/dokument/...`. If you only want
`dokument/` in the archive, you can let tar change directory first with `-C`:

```sh
tar -czf backup.tar.gz -C ~ dokument
tar -tzf backup.tar.gz
```

## Compressing single files with `gzip`

`gzip` compresses a file and **replaces** it with a `.gz` file. The
permissions and timestamp are kept:

```sh
cp dokument/server.log .
gzip -v server.log
```

```text
server.log:	 39.0% -- replaced with server.log.gz
```

`gzip -l` shows the size before and after, and `gunzip` unpacks the file
again:

```sh
gzip -l server.log.gz
gunzip server.log.gz
```

If you want to keep the original, use `gzip -k` (*keep*). Try it with a
really small file – it actually gets **bigger**, because gzip adds a header
containing, among other things, the file name:

```sh
cp dokument/frukter.txt .
gzip -kv frukter.txt
```

```text
frukter.txt:	-20.3% -- created frukter.txt.gz
```

### Reading compressed files directly

Old log files in `/var/log` are often stored as `.gz` to save space. With
`zcat` you can read them without unpacking them – and the result can be sent
on through a pipe as usual:

```sh
gzip server.log
zcat server.log.gz | grep ERROR
```

`zcat` is the same as `gzip -dc`: decompress (`d`) to standard output (`c`).
On a real system there are also `zless` and `zgrep`.

## zip – for sharing with Windows

The `.zip` format does both jobs at once: it collects files *and* compresses
them. Windows and macOS can open zip files without any extra software, so it's
the obvious choice when you're sending files to someone who doesn't run Linux.
Within the Linux world `.tar.gz` is more common, since it preserves owners
and permissions better.

The programs `zip` and `unzip` aren't always preinstalled. In that case you
install them with the package manager – more about that in the chapter on
package management. On {{distro}} you do it like this:

:::debian
```sh
sudo apt update
sudo apt install zip unzip
```

`apt update` downloads the list of available packages. Without it, apt
can't find any packages at all.
:::

:::arch
```sh
sudo pacman -S zip unzip
```

Answer yes (`Y` or just Enter) when pacman asks whether you want to proceed.
:::

:::redhat
```sh
sudo dnf install zip unzip
```

Answer `y` when dnf asks `Is this ok [y/N]` – the capital `N` means that No
is the default if you just press Enter.
:::

Then pack up the directory. Don't forget `-r` (*recursive*) – without it, zip
only adds the empty directory, not the files inside it:

```sh
zip -r dokument.zip dokument
```

```text
  adding: dokument/ (stored 0%)
  adding: dokument/frukter.txt (deflated 27%)
  adding: dokument/server.log (deflated 42%)
```

Notice that the order is the same as for tar: the archive first, then the
files. `unzip -l` lists the contents, and `-d` chooses where to unpack (the
directory is created if it doesn't exist):

```sh
unzip -l dokument.zip
unzip dokument.zip -d fran-zip
```

If the files already exist, unzip skips them. With `unzip -o` they're
overwritten.

## Summary

| If you want to ... | Command |
|---|---|
| pack up and compress a directory | `tar -czvf archive.tar.gz directory` |
| see what an archive contains | `tar -tzvf archive.tar.gz` |
| unpack an archive | `tar -xzvf archive.tar.gz` (add `-C directory`) |
| compress a file | `gzip file` (or `gzip -k file`) |
| unpack a `.gz` file | `gunzip file.gz` |
| read a `.gz` file directly | `zcat file.gz` |
| create or unpack a zip file | `zip -r archive.zip directory` · `unzip archive.zip` |
| see how big something is | `du -sh directory` · `ls -lh` |
