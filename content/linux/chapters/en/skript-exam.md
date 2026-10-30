# Exam: Scripts and automation

Answer the questions about shell scripts – you need 80 % to pass.

```quiz
What does the first line `#!/bin/bash` in a script do?
- [ ] It's a comment that the shell skips
- [x] It tells the system which program should run the file
- [ ] It makes the file executable
---
It's called the *shebang*. You still need `chmod +x` to make the file
executable.
```

```quiz
`namn = Kim` gives the error `command not found`. Why?
- [x] The spaces around `=` make the shell treat `namn` as a command
- [ ] Variable names must be written in capital letters
- [ ] You have to write `$namn = Kim`
```

```predict
$ antal=$(ls ~/dokument | wc -l)
$ echo "$antal files"
3 files
```

```predict
$ a=5
$ (( a += 10 ))
$ echo $a
15
```

```quiz
What does `"$@"` contain in a script?
- [ ] The number of arguments
- [ ] The script's name
- [x] All the arguments, each one separately
```

```quiz
Which test is true when the number in `n` is greater than 10?
- [ ] `[ $n > 10 ]`
- [x] `[ $n -gt 10 ]`
- [ ] `[ $n = 10 ]`
---
Numbers are compared with `-eq`, `-lt`, `-gt` and so on; `=` and `<` compare
text.
```

```predict
$ [ -d ~/finnsinte ] && echo yes || echo no
no
```

```predict
$ fil=rapport.txt
$ case $fil in *.jpg|*.png) echo "An image";; *.txt) echo "A text file";; *) echo "Unknown type";; esac
A text file
```

```predict
$ plus() { echo $(( $1 + $2 )); }
$ plus 4 5
9
```

```predict
$ for i in 1 2 3 4 5; do if [ $i -eq 3 ]; then continue; fi; echo $i; done
1
2
4
5
---
`continue` jumps straight to the next round, so `3` is never printed.
```

```quiz
What does `local` do in a function?
- [x] Creates a variable that only exists inside the function
- [ ] Makes the function run faster
- [ ] Ends the function with an exit code
```

```quiz
Why does a script end with `exit 1` when something goes wrong?
- [ ] To restart the script
- [x] So that whoever called the script can see from the exit code that it failed
- [ ] To print the number 1
```

```quiz
You start a here document with `cat > hej.sh << 'SLUT'`. When does it end?
- [ ] When you press Enter on an empty line
- [x] At the line `SLUT`
- [ ] After ten lines
```

```try
for i in $(seq 1 3); do echo "Round $i"; done
```
