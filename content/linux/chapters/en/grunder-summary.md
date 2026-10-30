# Summary: The basics

You have learnt the commands you'll use every day, on every distribution.
Here's a quick recap before the exam.

## Navigating the file system

Everything lives in one tree that starts at the root, `/`. Settings are in
`/etc`, programs in `/usr/bin`, logs in `/var/log` and your own files in your
home directory, `~`. `pwd` shows where you are, `ls` lists what's there and
`cd` moves you. An **absolute** path starts with `/`; a **relative** path
starts from the directory you're in. `..` is the directory above, and `cd`
without arguments takes you home.

## Files and directories

`mkdir` creates directories (`-p` creates several levels at once) and `touch`
creates empty files. `cp` copies (`-r` for whole directories), `mv` both moves
and renames, and `rm` deletes – for good, there is no recycle bin. `rmdir`
only removes empty directories; `rm -r` removes a directory and everything in
it. Wildcards such as `*`, `?` and `[abc]` are expanded by the shell before
the command runs, and names with spaces need quotes.

## Reading and searching text

`cat` prints a file and `less` lets you scroll through it. `head` and `tail`
show the beginning and the end (`-n` chooses how many lines, `tail -f`
follows a file). `wc` counts lines, words and bytes. `grep` shows the lines
that match a pattern, `sort` sorts lines and `uniq` removes repeated lines
that are next to each other. `man` shows the manual for a command.

## Redirection and pipes

Every program has three streams: stdin, stdout and stderr. `>` sends stdout
to a file (and overwrites it), `>>` appends, `<` reads stdin from a file and
`2>` redirects error messages – for example to `/dev/null`. A pipe `|` sends
the output of one command into the next, and `tee` saves a copy on the way.
`;`, `&&` and `||` run several commands on one line.

## Text processing with sed, tr and awk

`tr` replaces, deletes (`-d`) or squeezes (`-s`) single characters and only
reads stdin. `sed` edits lines: `s/old/new/` replaces (`g` for every match),
addresses choose lines, `d` deletes and `-n` with `p` prints only what you
ask for. `sed -i` changes the file itself. `cut` picks out a field, and `awk`
works with columns: `-F` sets the separator, `$1` … `$NF` are the fields, a
pattern before `{ }` chooses lines, and `END { }` runs after the last line.

## Commands and options

| Command | What it does | Options and syntax from this part |
|---|---|---|
| `pwd` | Shows the directory you're in | |
| `ls` | Lists the contents of a directory | `-l` long format, `-a` hidden files too |
| `cd` | Changes directory | `..` up, `~` home, `-` the last directory, no argument = home |
| `mkdir` | Creates a directory | `-p` several levels at once |
| `touch` | Creates an empty file | |
| `cp` | Copies | `-r` whole directories |
| `mv` | Moves or renames | |
| `rm` | Deletes | `-r` directories and their contents, `-f` no questions |
| `rmdir` | Removes an empty directory | |
| `cat` | Prints a file | |
| `less` | Shows a file page by page | `/word` searches, `q` quits |
| `head` / `tail` | The first / last lines | `-n N` number of lines, `tail -f` follows |
| `wc` | Counts lines, words and bytes | `-l` only lines |
| `grep` | Shows matching lines | `-i`, `-n`, `-v`, `-c`, `-r`, `-E` |
| `sort` | Sorts lines | `-n` numbers, `-r` reverse order |
| `uniq` | Removes repeated adjacent lines | `-c` counts them |
| `man` | Shows the manual page | |
| `tee` | Passes input on and saves a copy | |
| `tr` | Translates characters | `-d` delete, `-s` squeeze |
| `sed` | Edits a stream of lines | `s/…/…/g`, `d`, `p`, `q`, `-n`, `-i`, `-E`, `-e` |
| `cut` | Picks out fields | `-d` separator, `-f` field |
| `awk` | Works with columns | `-F` separator, `$1`, `$NF`, `NF`, `NR`, `BEGIN`, `END` |

| Syntax | Means |
|---|---|
| `>` / `>>` | stdout to a file (overwrite / append) |
| `<` | stdin from a file |
| `2>` | stderr to a file, e.g. `2> /dev/null` |
| `2>&1` | stderr the same way as stdout |
| `\|` | Pipe: stdout of one command into stdin of the next |
| `a ; b` | Run a, then b |
| `a && b` | Run b only if a succeeded |
| `a \|\| b` | Run b only if a failed |
| `*`, `?`, `[abc]` | Wildcards for file names |
