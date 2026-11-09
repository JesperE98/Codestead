# Text processing with sed and awk

You already know a few tools for text: `grep` finds lines, `cut` picks out a
field and `tr` changes single characters. This chapter is about two more
powerful ones, for when you want to replace words, delete lines or add up
numbers:

| Tool | Works on | Typical job |
|---|---|---|
| `sed` | **lines** | replace a word, delete lines |
| `awk` | **columns** (fields) | pick out columns, add up, count |

Both are *filters*: they read text, do something with it and write the
result to stdout. That makes them a perfect fit for pipes. And the original
file is **not** changed (with one exception, `sed -i`, which we'll get to).

## The stream editor – `sed`

`sed` (*stream editor*) reads text line by line and runs a small *script* on
each line. The most common command is `s` – *substitute*.

### Replacing text – `s`

```sh
sed 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

The script `s/ERROR/{{errorWord}}/` means: replace `ERROR` with `{{errorWord}}`.
It has the form

```text
s/PATTERN/REPLACEMENT/FLAGS
```

Without flags, only the **first** match on each line is replaced. With `g`
(*global*), all of them are:

```sh
echo "cat cat cat" | sed 's/cat/dog/'
echo "cat cat cat" | sed 's/cat/dog/g'
```

```predict
$ echo banana | sed 's/a/o/'
bonana
---
Without `g`, only the first `a` on the line is replaced.
```

The `i` flag makes the search case-insensitive, just like `grep -i`:

```sh
sed 's/warn/WARNING/i' ~/{{documents}}/server.log
```

The pattern is a *regular expression*, just as in `grep`. Here we remove the
date at the start of each line (`^` = start of line, `[0-9-]*` = digits and
hyphens):

```sh
sed 's/^[0-9-]* //' ~/{{documents}}/server.log
```

In the replacement, `&` means "whatever matched":

```sh
echo "Linux is fun" | sed 's/Linux/**&**/'
```

**A different delimiter.** If the text itself contains slashes, things get
messy: `s/\/usr\/local/\/opt/`. But the character right after `s` decides
the delimiter, so you might as well use `|` or `#`:

```sh
echo /usr/local/bin | sed 's|/usr/local|/opt|'
```

**Groups.** With `-E` (extended regular expressions) you can capture parts of
the match with parentheses and use them in the replacement as `\1`, `\2` …
Here we turn the date around:

```sh
sed -E 's|^([0-9]+)-([0-9]+)-([0-9]+)|\3/\2/\1|' ~/{{documents}}/server.log
```

### Choosing lines – addresses

In front of a command you can write an *address* that chooses which lines it
applies to. The `d` command (*delete*) deletes lines and `p` (*print*) prints
them:

```sh
sed '/INFO/d' ~/{{documents}}/server.log
sed '1d' ~/{{documents}}/{{grades}}
```

The first one deletes every line containing `INFO`, the second deletes line 1
– the header.

`sed` normally prints *every* line. With `-n` it stops doing that, and then
only what `p` asks for is printed. Here's how to show lines 5 to 8:

```sh
sed -n '5,8p' ~/{{documents}}/server.log
```

| Address | Means |
|---|---|
| `5` | line 5 |
| `$` | the last line |
| `/ERROR/` | lines matching the pattern |
| `2,4` | lines 2 to 4 |
| `/WARN/,/ERROR/` | from a line with WARN to the next line with ERROR |
| `/INFO/!` | every line **except** those that match |

Addresses work with every command, `s` included. Here only the error lines
get marked:

```sh
sed '/ERROR/s/^/>>> /' ~/{{documents}}/server.log
```

The `q` command (*quit*) stops after a given line – so `sed 3q` does the same
as `head -n 3`. You separate several commands with `;` or with several `-e`:

```sh
sed -e '/INFO/d' -e 's/ERROR/{{errorWord}}/' ~/{{documents}}/server.log
```

### Editing the file in place – `sed -i`

Everything so far has only been *printed*. The file itself is unchanged –
feel free to check with `cat`. With `-i` (*in-place*), `sed` writes the
result back to the file instead. Try it on a copy:

```sh
cp ~/{{documents}}/{{fruits}} ~/fruits-copy.txt
sed -i 's/kiwi/kiwifruit/' ~/fruits-copy.txt
cat ~/fruits-copy.txt
```

There's no undo for `sed -i`. A good way to work is to run the command
**without** `-i` first and look at the result, then add `-i` once it looks
right. If you write `-i.bak`, the original is also saved as `file.bak`.

```quiz
You run `sed 's/kiwi/KIWI/' ~/{{documents}}/{{fruits}}`. What happens to the file?
- [ ] Every `kiwi` in the file becomes `KIWI`
- [ ] Only the first `kiwi` in the file becomes `KIWI`
- [x] Nothing – the result is only printed, the file is unchanged
---
Without `-i`, `sed` only writes to stdout. The file stays as it was.
```

Configuration files in `/etc` are owned by root, so there you need
`sudo sed -i ...`. It's a common way to change a setting from a script
without opening a text editor.

## Columns – `awk`

`awk` is really a whole little programming language, but most of the time
it's used for one thing: working with **columns**. awk splits each line into
*fields*:

| Field | Means |
|---|---|
| `$1`, `$2` … | the first, second … field |
| `$0` | the whole line |
| `NF` | the number of fields on the line (*number of fields*) |
| `$NF` | the last field |
| `NR` | the line number (*number of record*) |

By default, fields are separated by spaces (any number of them). In
`server.log`, field 3 is the log level:

```sh
awk '{print $3}' ~/{{documents}}/server.log
```

The program goes inside `{ }` and runs for every line. Always put the awk
program in **single** quotes – otherwise the shell thinks `$3` is a shell
variable and replaces it before awk even starts.

awk fits perfectly in a pipe. How many lines are there of each level?

```sh
awk '{print $3}' ~/{{documents}}/server.log | sort | uniq -c
```

### Other separators – `-F`

With `-F` you choose the field separator. In `/etc/passwd` it's a colon;
field 1 is the user name and field 7 the shell:

```sh
awk -F: '{print $1, $7}' /etc/passwd
```

The comma in `print` becomes a space in the output. Without a comma the
fields are glued together, and then you can mix in text of your own:

```sh
awk -F: '{print $1 " uses " $7}' /etc/passwd
```

Compare with `cut -d: -f1` from the chapter on reading and searching text. The difference is that
awk can reorder the fields, mix in text and cope with several spaces in a row.

```predict
$ echo "Alva,math,87" | awk -F, '{print $3, $1}'
87 Alva
---
`-F,` splits the line at the commas. awk prints field 3 first, then field 1,
with a space between them because of the comma in `print`.
```

### Patterns – choosing lines

Before the `{ }` you can write a *pattern*. The program then only runs for
the lines that match. The pattern can be a regular expression, as in `grep`:

```sh
awk '/ERROR/ {print $2}' ~/{{documents}}/server.log
```

… or a condition. Text goes inside double quotes:

```sh
awk -F, '$2 == "math" {print $1, $3}' ~/{{documents}}/{{grades}}
```

Comparisons are written `==`, `!=`, `<`, `<=`, `>` and `>=`, and conditions
are combined with `&&` (and), `||` (or) and `!` (not). Here are all the
students with at least 90 points (without `{ }` the whole line is printed):

```sh
awk -F, '$3 >= 90' ~/{{documents}}/{{grades}}
```

Did you get the header line as well? In it, field 3 is the word `points`, and
when a value isn't a number, awk compares it as *text* – and `"points"` comes
after `"90"` in alphabetical order. You skip the header with `NR > 1`:

```sh
awk -F, 'NR > 1 && $3 >= 90' ~/{{documents}}/{{grades}}
```

Try a pattern of your own – the names of everyone who studies English:

```try
awk -F, '$2 == "english" {print $1}' ~/{{documents}}/{{grades}}
```

### Counting – variables and `END`

awk has variables that you don't need to declare – they start at 0. The
`END { }` block runs once, **after** the last line. Together they make an
easy way to add up a column:

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3} END {print {{sumVar}}}' ~/{{documents}}/{{grades}}
```

`{{sumVar}} += $3` means "add field 3 to `{{sumVar}}`". If you count the lines
at the same time (`count++` increases `count` by 1), you can work out the
average:

```sh
awk -F, 'NR > 1 {{{sumVar}} += $3; count++} END {print "Average:", {{sumVar}} / count}' ~/{{documents}}/{{grades}}
```

There's also `BEGIN { }`, which runs **before** the first line – handy for
headings. And with `printf` you decide exactly what the output looks like:
`%-8s` is text left-aligned in 8 characters and `%5d` an integer in 5
characters.

```sh
awk -F, 'BEGIN {print "Student  Score"} NR > 1 {printf "%-8s %5d\n", $1, $3}' ~/{{documents}}/{{grades}}
```

awk also has functions, such as `length()`, `toupper()` and `tolower()`:

```sh
awk '{print toupper($0)}' ~/{{documents}}/{{fruits}}
```

Letters outside a–z are another matter:

```sh
echo "crème brûlée" | awk '{print toupper($0)}'
```

On Ubuntu, which the terminal here runs, `awk` is **mawk** by default, a
small and fast variant. For simple programs like these you won't notice any
difference – but mawk doesn't convert letters such as è, û and é with
`toupper()`. **GNU awk** (the `gawk` package) does, unlike `tr`.
Distributions differ in which awk they use and in how you install software –
you met that in the part on distributions.

The simulator only knows part of the awk language – what's covered here and
a little more (`if`, loops and arrays). See `man awk`.

## Which tool should I choose?

| You want to … | Use |
|---|---|
| find lines that contain something | `grep` |
| replace or delete individual characters | `tr` |
| replace words or patterns, delete lines | `sed` |
| pick out columns, compare numbers, add up | `awk` |

The real power comes from combining them. Which levels are there among the
lines that *aren't* INFO – if we ignore upper and lower case?

```sh
grep -v INFO ~/{{documents}}/server.log | awk '{print $3}' | tr A-Z a-z | sort | uniq -c
```
