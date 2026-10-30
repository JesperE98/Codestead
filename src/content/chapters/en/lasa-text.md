# Reading and searching text

Almost everything in Linux is text: settings, logs, lists. That's why there
are lots of small tools for reading and searching text files. In your home
directory there's a directory called `dokument` with two files to practice on:
`frukter.txt` (a list of fruits) and `server.log` (a log from a made-up web
server). Their contents are in Swedish, but the words you'll search for –
`INFO`, `WARN` and `ERROR` – are the same as in real logs.

## Showing a file – `cat` and `less`

`cat` prints the whole file:

```sh
cat dokument/frukter.txt
```

For long files, `less` is better. There you scroll with the arrow keys and
the space bar, search with `/word` and quit with `q`.

## The beginning and the end – `head` and `tail`

`head` shows the first lines and `tail` the last ones. The default is 10
lines, but you can choose with `-n`:

```sh
head -n 5 dokument/server.log
tail -n 3 dokument/server.log
```

`tail -f` *follows* a file and shows new lines as they're written – perfect
for logs. Stop it with **Ctrl+C**.

## Counting – `wc`

`wc` (*word count*) counts lines, words and bytes:

```sh
wc dokument/frukter.txt
```

Often you only want the number of lines: `wc -l`.

## Searching – `grep`

`grep` is one of the most useful commands there is. It shows every line that
contains a pattern:

```sh
grep INFO dokument/server.log
```

A few options you'll use a lot:

| Option | Meaning |
|---|---|
| `-i` | Ignore the difference between upper and lower case |
| `-n` | Show line numbers |
| `-v` | Show lines that do *not* match |
| `-c` | Count matching lines |
| `-r` | Search recursively in every file in a directory |
| `-E` | Extended patterns, e.g. `"ERROR|WARN"` |

```sh
grep -n WARN dokument/server.log
```

The pattern is a *regular expression*. A couple of examples: `^` means the
start of the line and `$` the end of the line, so `grep "^2026"` finds lines
that start with 2026.

## Sorting – `sort` and `uniq`

`sort` sorts lines alphabetically (`-n` for numbers, `-r` for reverse order).
`uniq` removes lines that are identical to the line *directly above* – which
is why it is almost always used after `sort`:

```sh
sort dokument/frukter.txt
```

## The manual – `man`

Forgotten what an option does? Every command has a manual page:

```sh
man grep
```
