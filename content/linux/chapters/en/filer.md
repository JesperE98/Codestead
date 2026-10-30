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

## Copying – `cp`

```sh
cp anteckningar.txt anteckningar-kopia.txt
```

If the target is a directory, the copy ends up inside it with the same name.
To copy an entire directory you need `-r` (*recursive*):

```sh
cp -r dokument dokument-backup
```

## Moving and renaming – `mv`

In Linux, *moving* and *renaming* are the same thing. `mv` does both:

```sh
mv inkopslista.txt dokument/
mv dokument/inkopslista.txt dokument/handla.txt
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

## Wildcards

The shell can expand patterns into several file names before the command
runs:

| Pattern | Matches |
|---|---|
| `*` | Anything (zero or more characters) |
| `?` | Exactly one character |
| `[abc]` | One of the characters a, b or c |

```sh
ls dokument/*.txt
```

Here `ls` never sees the asterisk – the shell has already replaced
`dokument/*.txt` with all the matching file names.

## Spaces in file names

The shell splits the command line at spaces. If a file has a space in its
name, you must use quotes (or a `\` before the space):

```sh
touch "min fil.txt"
ls -l "min fil.txt"
```

That's why many people prefer hyphens or underscores in file names.
