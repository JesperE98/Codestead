# Summary: Scripts and automation

In this part you've turned commands into programs of your own.

## Shell scripts

A script is a text file with commands that starts with the shebang
`#!/bin/bash`. You can write it with a here document (`cat > file << 'SLUT'`),
make it executable with `chmod +x` and run it with `./`. Lines starting with
`#` are comments.

You create variables with `name=value` – without spaces – and use them inside
double quotes: `"$name"`, or `"${name}_text"` when text follows straight
after. `$(command)` is replaced by what the command prints, and `$(( ))`
does integer arithmetic. A script reads its arguments from `$1`, `$2` …,
`$#` and `"$@"`.

`if` looks at a command's exit code, usually the test command `[ ]`. Numbers
are compared with `-eq`, `-lt` and friends; text with `=` and `!=`. `for`
loops over a list, `while` keeps going as long as a condition is true, and
`while read` goes through a file line by line. `case` chooses between
patterns, functions are named pieces of code with their own `$1`, and `read`
asks the user for input. `exit 1` tells whoever called the script that
something went wrong.

## Commands and syntax

| Syntax | Does |
|---|---|
| `#!/bin/bash` | The shebang: which program runs the script |
| `cat > file << 'SLUT'` | Write lines into a file until the line `SLUT` |
| `name=value` · `"$name"` · `"${name}"` | Create · use a variable |
| `$(command)` | Replaced by what the command prints |
| `$(( a * 6 ))` · `(( a++ ))` | Integer arithmetic · change a variable |
| `$0` · `$1` · `$#` · `"$@"` | The script's name · first argument · number of arguments · all arguments |
| `if [ ... ]; then ...; elif ...; else ...; fi` | Conditions |
| `-f` · `-d` · `-z` | File exists · directory exists · variable is empty |
| `=` · `!=` | Text equal · different |
| `-eq` · `-ne` · `-lt` · `-le` · `-gt` · `-ge` | Compare numbers |
| `[[ $file == *.txt ]]` | Bash's smarter test, with patterns |
| `for x in list; do ...; done` | Loop over a list |
| `while [ ... ]; do ...; done` | Loop as long as the condition is true |
| `while read line; do ...; done < file` | Go through a file line by line |
| `break` · `continue` | Leave the loop · go to the next round |
| `case $x in pattern) ...;; *) ...;; esac` | Choose by pattern |
| `name() { ...; }` · `local` · `return` | A function · local variable · end the function |
| `read -p "Question " var` | Read a line from the keyboard |
| `exit 1` | End the script with an exit code |
| `set -euo pipefail` | Stop the script at the first error |
