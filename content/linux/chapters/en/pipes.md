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

`<` lets a program read its stdin from a file:

```sh
wc -l < dokument/frukter.txt
```

Now `wc` never sees the file name – it only gets the text on stdin – so it
prints just the number.

```predict
$ wc -l dokument/frukter.txt
$ wc -l < dokument/frukter.txt
10 dokument/frukter.txt
10
---
With a file name as an argument, `wc` prints the name too. With `<`, it only
gets the text.
```

## Error messages – `2>`

Error messages go to stderr and aren't affected by `>`. To deal with them,
write the stream's number in front:

```sh
ls /finnsinte 2> fel.txt
```

(*Finns inte* is Swedish for "doesn't exist", and *fel* means "error".)

```quiz
You run `ls /finnsinte > fel.txt`. Where does the error message end up?
- [ ] In `fel.txt`
- [x] On the screen – `fel.txt` stays empty
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
grep INFO dokument/server.log | wc -l
```

`grep` finds the lines and `wc -l` counts them. You can chain together as
many as you like:

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

Read it step by step: sort the fruits, count how many there are of each
(`uniq -c`), and then sort numerically with the largest first (`sort -rn`).

How many files and directories are there in `/etc`? Count them with a pipe:

```try
ls /etc | wc -l
```

## Both screen and file – `tee`

`tee` passes its input along *and* saves a copy in a file:

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Chains – `;`, `&&` and `||`

Several commands can go on the same line:

| Syntax | Means |
|---|---|
| `a ; b` | Run a, then b |
| `a && b` | Run b only if a succeeded |
| `a \|\| b` | Run b only if a failed |

```sh
mkdir -p ny && cd ny
```

```predict
$ mkdir dokument 2> /dev/null && echo created || echo failed
failed
---
`dokument` already exists, so `mkdir` fails (its error message disappears in
`/dev/null`). `echo created` is skipped and `echo failed` runs.
```
