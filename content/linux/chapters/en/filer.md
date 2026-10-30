# Files and directories

Now that you can find your way around, it's time to create, copy, move and
delete things.

## Creating directories – `mkdir`

```sh
mkdir bilder2
```

If you want to create several levels at once, you need `-p` (*parents*).
Without it, `mkdir` complains if the parent directory doesn't exist:

```sh
mkdir -p resa/2026/juni
```

## Creating empty files – `touch`

`touch` creates an empty file if it doesn't exist (and otherwise just updates
its timestamp):

```sh
touch inkopslista.txt
```

```quiz
What does `touch anteckningar.txt` do if the file already exists?
- [ ] It empties the file
- [ ] It complains that the file exists
- [x] It only updates the file's timestamp – the contents stay the same
```

## Copying – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

If the target is a directory, the copy ends up inside it with the same name.
To copy an entire directory you need `-r` (*recursive*):

```sh
cp -r dokument dokument-backup
```

```predict
$ mkdir kopior
$ cp anteckningar.txt kopior
$ ls kopior
anteckningar.txt
---
`kopior` is a directory, so the copy ends up inside it with the same name.
```

## Moving and renaming – `mv`

In Linux, *moving* and *renaming* are the same thing. `mv` does both:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
```

```quiz
There is no file called `b.txt`. What does `mv a.txt b.txt` do?
- [ ] Copies `a.txt` to `b.txt`
- [x] Renames `a.txt` to `b.txt`
- [ ] Fails, because `b.txt` doesn't exist
---
Moving and renaming are the same thing. Afterwards there is only `b.txt`.
```

## Deleting – `rm` and `rmdir`

```sh
rm anteckningar-kopia.txt
```

`rmdir` removes *empty* directories. To remove a directory along with
everything in it, use `rm -r`:

```sh
rm -r dokument-backup
```

> **Warning!** There is no recycle bin in the terminal. What you delete with
> `rm` is gone for good. The command `rm -rf` (*recursive, force*) asks no
> questions and never complains – always double-check the path before you
> press Enter.

```quiz
Which command removes the directory `gammalt` *only* if it is empty?
- [ ] `rm gammalt`
- [x] `rmdir gammalt`
- [ ] `rm -r gammalt`
---
`rmdir` refuses to remove a directory that still has something in it.
`rm -r` removes the directory and everything inside.
```

## Wildcards

The shell can expand patterns into several file names before the command
runs:

| Pattern | Matches |
|---|---|
| `*` | Anything (zero or more characters) |
| `?` | Exactly one character |
| `[abc]` | One of the characters a, b or c |

The directory `dokument` in your home directory contains three files:
`betyg.csv`, `frukter.txt` and `server.log`. This lists only those that end
in `.txt`:

```sh
ls dokument/*.txt
```

Here `ls` never sees the asterisk – the shell has already replaced
`dokument/*.txt` with all the matching file names.

```predict
$ ls dokument/?????.*
dokument/betyg.csv
---
Each `?` is exactly one character, so the name before the dot must be five
characters long. Only `betyg` is – `frukter` and `server` are longer.
```

## Spaces in file names

The shell splits the command line at spaces. If a file has a space in its
name, you must use quotes (or a `\` before the space):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

That's why many people prefer hyphens or underscores in file names.
