# Redirection and pipes

This chapter is about what makes the command line so powerful: *connecting*
small programs together.

## Three streams

Every program has three standard streams:

| Number | Name | What |
|---|---|---|
| 0 | stdin | Input, normally from the keyboard |
| 1 | stdout | Normal output, normally to the screen |
| 2 | stderr | Error messages, also to the screen |

With *redirection* and *pipes* you can send these streams somewhere else.

## To a file – `>` and `>>`

`>` sends stdout to a file instead of the screen. The file is created if it
doesn't exist – and **overwritten** if it does!

```sh
echo "first line" > test.txt
```

`>>` appends to the end of the file instead:

```sh
echo "second line" >> test.txt
cat test.txt
```

```predict
$ echo one > t.txt
$ echo two > t.txt
$ cat t.txt
two
---
The second `>` overwrote the file. With `>>` it would contain both lines.
```

## From a file – `<`

`{{fruits}}` has ten lines, one fruit per line. When you give `wc -l` a file
name, it prints the number of lines followed by the name – here for
`{{grades}}`, which has nine lines:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

`<` lets a program read its stdin from a file:

```sh
wc -l < {{documents}}/{{fruits}}
```

Now `wc` never sees the file name – it only gets the text on stdin – so it
prints just the number.

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
With a file name as an argument, `wc` prints the name too. With `<`, it only
gets the text.
```

## Error messages – `2>`

Error messages go to stderr and aren't affected by `>`. To deal with them,
write the stream's number in front:

```sh
ls /{{missing}} 2> errors.txt
```

```quiz
You run `ls /{{missing}} > errors.txt`. Where does the error message end up?
- [ ] In `errors.txt`
- [x] On the screen – `errors.txt` stays empty
- [ ] Nowhere, it disappears
---
`>` only redirects stdout (stream 1). The error message goes to stderr
(stream 2), which still goes to the screen. You would need `2>`.
```

The file `/dev/null` is a "black hole" – anything written to it disappears.
That's handy for silencing errors. With `2>&1`, stderr is sent the same way as
stdout.

## Pipes – `|`

A **pipe** sends the stdout of one command straight into the stdin of the
next. This is the heart of the Unix philosophy: *do one thing and do it well,
and let programs work together*.

```sh
grep INFO {{documents}}/server.log | wc -l
```

`grep` finds the lines and `wc -l` counts them. You can chain together as
many as you like:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

Read it step by step: sort the fruits, count how many there are of each
(`uniq -c`), and then sort numerically with the largest first (`sort -rn`).

How many files and directories are there in `/etc`? Count them with a pipe:

```try
ls /etc | wc -l
```

## Translating characters – `tr`

`tr` (*translate*) replaces every character in the first set with the
character in the same position in the second. `a-z` means all the letters
from a to z:

```sh
echo "hello from café" | tr a-z A-Z
```

```text
HELLO FROM CAFé
```

Did you spot the é? `tr` works on individual *bytes*, and letters such as é,
ñ and ü aren't part of `a-z`.

`tr` **only** reads from stdin, never from files. If you want to use a file,
feed it in with `<` or a pipe:

```sh
tr a-z A-Z < ~/{{documents}}/{{fruits}}
```

With `-d` (*delete*) you remove characters, and with `-s` (*squeeze*) you
squeeze several identical characters in a row into one:

```sh
echo "070-123 45 67" | tr -d ' -'
echo "too     many      spaces" | tr -s ' '
```

```predict
$ echo "hello world" | tr -d o
hell wrld
---
`-d` deletes every `o`, wherever it is.
```

Instead of ranges you can write *classes*, e.g. `[:upper:]` (uppercase),
`[:lower:]` (lowercase), `[:digit:]` (digits) and `[:space:]` (whitespace):

```sh
echo "Room 101, floor 3" | tr -d '[:digit:]'
```

## From input to arguments – `xargs`

Some commands don't read from a pipe at all – they want names as
**arguments**: `rm`, `mkdir`, `touch`, and `wc` when it should count in files.
`xargs` bridges the gap: it reads the words in its input and puts them after a
command.

```sh
find {{documents}} -type f | xargs wc -l
```

That is the same as writing every file name after `wc -l` yourself. With
`-n 1`, `xargs` runs the command once for every word, and with `-I {}` once
for every line, with `{}` replaced by the line:

```sh
ls {{documents}} | xargs -I {} echo "File: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
`xargs` collected the three lines and ran `echo a b c` – once.
```

## Both screen and file – `tee`

`tee` passes its input along *and* saves a copy in a file:

```sh
ls /etc | tee etc-list.txt | wc -l
```

## Chains – `;`, `&&` and `||`

Several commands can go on the same line:

| Syntax | Means |
|---|---|
| `a ; b` | Run a, then b |
| `a && b` | Run b only if a succeeded |
| `a \|\| b` | Run b only if a failed |

```sh
mkdir -p new && cd new
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo created || echo failed
failed
---
`{{documents}}` already exists, so `mkdir` fails (its error message disappears in
`/dev/null`). `echo created` is skipped and `echo failed` runs.
```
