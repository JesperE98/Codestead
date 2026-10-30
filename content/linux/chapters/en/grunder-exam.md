# Exam: The basics

Answer the questions below to show what you've learnt in this part.

```quiz
Which of these paths is **absolute**?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `dokument`
---
An absolute path starts with `/`, at the root. The others start from the
directory you're in.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Each `..` goes up one level: from `/var/log` to `/var`, and then to `/`.
```

```quiz
What does `cd -` do?
- [ ] Goes up one level
- [ ] Goes to your home directory
- [x] Goes back to the directory you were in last
```

```quiz
You want to copy the whole directory `bilder`, with everything in it, to `bilder-kopia`. Which command works?
- [ ] `cp bilder bilder-kopia`
- [x] `cp -r bilder bilder-kopia`
- [ ] `mv bilder bilder-kopia`
---
A directory is copied with `-r` (*recursive*). `mv` would move it instead of
copying it.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
`-p` creates `a`, `a/b` and `a/b/c` in one go, so `a/b` contains `c`.
```

```quiz
You type `touch min fil.txt` – without quotes. What happens?
- [ ] A file called `min fil.txt` is created
- [x] Two files are created: `min` and `fil.txt`
- [ ] Nothing, because the name contains a space
---
The shell splits the line at spaces, so `touch` gets two arguments. Write
`touch "min fil.txt"` to get one file.
```

```quiz
Which lines does `grep -i error dokument/server.log` show?
- [ ] Only lines with `error` in lower case
- [ ] Only lines with `ERROR` in upper case
- [x] Lines with `error` in any mix of upper and lower case
```

```quiz
You want to watch a log file and see new lines as they're written. Which command fits?
- [ ] `head -n 10 dokument/server.log`
- [x] `tail -f dokument/server.log`
- [ ] `wc -l dokument/server.log`
---
`tail -f` *follows* the file. Stop it with **Ctrl+C**.
```

```quiz
What does `wc` print when you give it a file and no options?
- [ ] Only the number of lines
- [x] The number of lines, words and bytes
- [ ] The first 10 lines of the file
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
`>>` appended `b`, but the last `>` overwrote the whole file.
```

```quiz
When does `b` run in `a || b`?
- [ ] Always, after `a`
- [ ] Only if `a` succeeded
- [x] Only if `a` failed
```

```try
grep ERROR ~/dokument/server.log | tee fel.txt | wc -l
---
`tee` saved the error lines in `fel.txt` and passed them on to `wc -l`, which
counted them.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
`-d,` makes the comma the separator, and `-f2` keeps field 2.
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` is the number of fields on the line. Fields are separated by spaces.
```

```quiz
Why should an awk program such as `'{print $3}'` be written in **single** quotes?
- [ ] awk can't read double quotes
- [x] Otherwise the shell thinks `$3` is a shell variable and replaces it before awk starts
- [ ] Single quotes make awk run faster
```
