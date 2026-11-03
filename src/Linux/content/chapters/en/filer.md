# Files and directories

Now that you can find your way around, it's time to create, copy, move and
delete things.

## Creating directories – `mkdir`

```sh
mkdir photos
```

If you want to create several levels at once, you need `-p` (*parents*).
Without it, `mkdir` complains if the parent directory doesn't exist:

```sh
mkdir -p trip/2026/june
```

## Creating empty files – `touch`

`touch` creates an empty file if it doesn't exist (and otherwise just updates
its timestamp):

```sh
touch shopping-list.txt
```

```quiz
What does `touch {{notes}}` do if the file already exists?
- [ ] It empties the file
- [ ] It complains that the file exists
- [x] It only updates the file's timestamp – the contents stay the same
```

## Copying – `cp`

```sh
cp {{notes}} notes-copy.txt
```

If the target is a directory, the copy ends up inside it with the same name.
To copy an entire directory you need `-r` (*recursive*):

```sh
cp -r {{documents}} {{documents}}-backup
```

```predict
$ mkdir copies
$ cp {{notes}} copies
$ ls copies
{{notes}}
---
`copies` is a directory, so the copy ends up inside it with the same name.
```

## Moving and renaming – `mv`

In Linux, *moving* and *renaming* are the same thing. `mv` does both:

```sh
mv shopping-list.txt {{documents}}/
mv {{documents}}/shopping-list.txt {{documents}}/groceries.txt
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
rm notes-copy.txt
```

`rmdir` removes *empty* directories. To remove a directory along with
everything in it, use `rm -r`:

```sh
rm -r {{documents}}-backup
```

> **Warning!** There is no recycle bin in the terminal. What you delete with
> `rm` is gone for good. The command `rm -rf` (*recursive, force*) asks no
> questions and never complains – always double-check the path before you
> press Enter.

```quiz
Which command removes the directory `{{old}}` *only* if it is empty?
- [ ] `rm {{old}}`
- [x] `rmdir {{old}}`
- [ ] `rm -r {{old}}`
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

The directory `{{documents}}` in your home directory contains three files:
`{{fruits}}`, `{{grades}}` and `server.log`. This lists only those that end
in `.txt`:

```sh
ls {{documents}}/*.txt
```

```text
{{documents}}/{{fruits}}
```

Here `ls` never sees the asterisk – the shell has already replaced
`{{documents}}/*.txt` with all the matching file names. When several names
match, `ls` prints them in alphabetical order, side by side on one line.

```predict
$ ls {{documents}}/?r*
{{documents}}/{{fruits}}  {{documents}}/{{grades}}
---
`?` is exactly one character, so the second letter of the name must be `r`.
That's true of `{{fruits}}` and `{{grades}}`, but not of `server.log`.
```

## Spaces in file names

The shell splits the command line at spaces. If a file has a space in its
name, you must use quotes (or a `\` before the space):

```sh
touch "my file.txt"
ls -l "my file.txt"
```

That's why many people prefer hyphens or underscores in file names.
