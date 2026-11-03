# Shell scripts

Everything you've typed in the terminal so far can also be saved in a file
and run again and again. A file like that is called a **script**. Scripts let
you automate the boring stuff: backups, renaming a hundred files or checking
logs every morning. On top of that, bash is a real programming language, with
variables, conditions, loops and functions.

## A first script

A script is an ordinary text file. On real computers you'd write it in a text
editor such as `nano` or `vim`. Another way, which works both here and on
servers, is a **here document**: everything between `<< '{{heredocEnd}}'` and
the line `{{heredocEnd}}` is fed into the command. (You can pick any word you
like – `EOF` is another common choice.)

Type the first line and press Enter. The prompt changes to `> ` – the shell
is waiting for the rest. Type the lines one at a time and finish with `{{heredocEnd}}`:

```sh
cat > {{helloScript}} << '{{heredocEnd}}'
#!/bin/bash
echo "Hello from a script!"
echo "Today is $(date)"
{{heredocEnd}}
```

The first line, `#!/bin/bash`, is called the *shebang* and tells the system
which program should run the file. Make the script executable and run it:

```sh
chmod +x {{helloScript}}
./{{helloScript}}
```

Lines that start with `#` (apart from the shebang line) are **comments**,
which the shell skips. Use them to explain what the code does!

## Variables

You create a variable with `name=value`. There must **not** be any spaces
around the equals sign – otherwise the shell thinks `name` is a command.

```sh
city=Glasgow
echo "I live in $city"
```

Always put variables inside **double quotes** when you use them. Without
quotes the value is split at spaces, which causes strange errors when a file
name contains a space. If you want to write text directly after the variable
name, use curly braces: `"${city}_2026"` – without them, bash would look for
a variable called `city_2026`.

```quiz
`city` contains `Glasgow`, and there's no variable called `city_2026`. What
does `echo "$city_2026"` print?
- [ ] `Glasgow_2026`
- [ ] `Glasgow`
- [x] An empty line
---
Bash reads the whole name `city_2026`, and that variable doesn't exist.
Write `"${city}_2026"` to get `Glasgow_2026`.
```

## Command substitution – `$(...)`

`$(command)` is replaced by whatever the command prints. That's how you save
the result of a command in a variable:

```sh
today=$(date)
items=$(ls ~ | wc -l)
echo "There are $items items in your home directory"
```

## Arithmetic – `$(( ))`

Bash does integer arithmetic inside `$(( ))`. Inside the parentheses you
don't need a `$` in front of variables:

```sh
a=7
echo $(( a * 6 ))
echo $(( 17 / 5 )) remainder $(( 17 % 5 ))
```

To change a variable, write `(( a++ ))` or `(( a += 10 ))`.

```predict
$ echo $(( 7 / 2 )) $(( 7 % 2 ))
3 1
---
Bash only counts with integers: 7 / 2 is 3, and the remainder (`%`) is 1.
```

## Arguments

When you run `./script.sh one two`, the script can read the arguments:

| Variable | Contains |
|---|---|
| `$0` | The script's name |
| `$1`, `$2` ... | The first, second ... argument |
| `$#` | The number of arguments |
| `"$@"` | All the arguments, each one separately |
| `$?` | The exit code of the previous command |

```quiz
A script is run with `./script.sh red green blue`. What do `$1` and `$#`
contain?
- [ ] `$1` is `./script.sh` and `$#` is `4`
- [x] `$1` is `red` and `$#` is `3`
- [ ] `$1` is `red` and `$#` is `blue`
---
The script's own name is in `$0`, so it isn't counted in `$#`.
```

## Conditions – `if`

`if` runs a command and looks at its **exit code**: 0 means true, anything
else false. Most of the time you use the command `[` (also known as `test`):

```sh
if [ -f ~/.bashrc ]; then echo "The file exists"; else echo "The file is missing"; fi
```

The spaces inside `[ ]` are mandatory! Written over several lines, as in a
script, it looks like this:

```text
if [ "$answer" = "yes" ]; then
    echo "Great!"
elif [ "$answer" = "no" ]; then
    echo "Too bad."
else
    echo "Please answer yes or no."
fi
```

The most common tests:

| Test | True if |
|---|---|
| `-f FILE` | the file exists (and is a regular file) |
| `-d DIR` | the directory exists |
| `-z "$x"` | the variable is empty |
| `"$a" = "$b"` | the strings are equal (`!=` different) |
| `$a -eq $b` | the numbers are equal |
| `$a -lt $b` | less than (`-le`, `-gt`, `-ge`, `-ne`) |
| `! CONDITION` | the condition is *not* true |

Notice that numbers are compared with `-eq`, `-lt` and so on, while `=` and
`<` compare text. Bash also has `[[ ... ]]`, which is a little smarter: there
you can write `&&` and `||` and match against patterns like
`[[ $file == *.txt ]]`.

For short conditions, `&&` and `||` are often enough:

```sh
[ -d ~/{{pictures}} ] && echo "The pictures directory exists"
```

```predict
$ x=""
$ if [ -z "$x" ]; then echo empty; else echo "not empty"; fi
empty
```

## Loops

A **for loop** does the same thing for every item in a list:

```sh
for fruit in apple banana kiwi; do echo "I like $fruit"; done
```

The list can come from wildcards or a command:

```sh
for file in ~/{{documents}}/*; do echo "File: $file"; done
for i in $(seq 1 3); do echo "Round $i"; done
```

A **while loop** keeps going as long as the condition is true:

```sh
i=1; while [ $i -le 3 ]; do echo $i; (( i++ )); done
```

The most common way to go through a file line by line is `while read`, with
the file fed in using `<` after `done`:

```sh
while read {{lineVar}}; do echo "> ${{lineVar}}"; done < ~/{{documents}}/{{fruits}}
```

`break` leaves a loop, and `continue` jumps straight to the next round.

```predict
$ for x in 2 4 6; do echo $(( x * 10 )); done
20
40
60
```

> **Watch out for infinite loops!** A loop whose condition never becomes false
> goes on forever. In a real terminal you stop it with **Ctrl+C**. The
> simulator stops it by itself after 20,000 steps.

## Choosing with `case`

When a variable can have many different values, `case` is clearer than a long
chain of `elif`:

```sh
file=photo.jpg
case $file in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
```

Each alternative ends with `;;`, and `*)` catches everything else.

## Functions

A **function** is a named piece of code that you can call like a command of
its own. It receives arguments the same way a script does – `$1`, `$2` and
`$#`:

```sh
greet() { echo "Hello $1, welcome!"; }
greet Kim
```

Variables that should only exist inside the function are created with
`local`, and `return` ends the function with an exit code.

## Asking the user – `read`

`read` reads a line from the keyboard into a variable:

```sh
read -p "What's your name? " {{nameVar}}; echo "Hello ${{nameVar}}!"
```

## A complete example

Here's a script that uses most of what this chapter has covered. It backs up
the files you give it as arguments:

```text
#!/bin/bash
# backup.sh – copies each file to file.bak

if [ $# -eq 0 ]; then
    echo "Usage: $0 FILE..."
    exit 1
fi

for file in "$@"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.bak"
        echo "Copied $file"
    else
        echo "Cannot find $file" >&2
    fi
done
```

`exit 1` ends the script with exit code 1, so that whoever called the script
can see that something went wrong.

## Tips for good scripts

- Start with `#!/bin/bash` and write comments.
- Put variables in quotes: `"$file"`, not `$file`.
- Many people start their scripts with `set -euo pipefail`, so that the
  script stops at the first error instead of carrying on blindly.
- The program **ShellCheck** finds common mistakes in bash scripts – you can
  install it with the package manager on every major distribution.
