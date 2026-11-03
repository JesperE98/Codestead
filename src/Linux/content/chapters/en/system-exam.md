# Exam: The system

Answer the questions about variables, permissions, processes and archives – you need 80 % to pass.

```predict
$ echo "$HOME" '$USER'
/home/{{user}} $USER
---
Double quotes replace the variable with its value; single quotes print it
exactly as written.
```

```quiz
What does `export` do with a variable?
- [ ] Saves it in `~/.bashrc`
- [x] Makes it an environment variable that the programs you start can read too
- [ ] Deletes it
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
`ls` went well, so the exit code is `0`. The output itself disappeared into
`/dev/null`.
```

```quiz
Which number gives the permissions `rwxr-x---`?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Owner: 4 + 2 + 1 = 7. Group: 4 + 1 = 5. Others: 0.
```

```predict
$ touch tool.sh
$ chmod 755 tool.sh
$ chmod go-x tool.sh
$ ls -l tool.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
On Ubuntu, members of which group may use `sudo`?
- [x] `sudo`
- [ ] `root`
- [ ] `{{user}}`
```

```quiz
What does `sudo -i` do?
- [ ] Shows information about sudo
- [x] Starts a root shell, where the prompt changes to `#`, until you type `exit`
- [ ] Runs the previous command again as root
```

```quiz
In `ps aux`, a process has `R` in the `STAT` column. What does that mean?
- [x] It's running
- [ ] It's sleeping
- [ ] It belongs to root
```

```quiz
Which variable holds the PID of the most recent background job?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
You try `kill 812` on a process that belongs to root and get
`Operation not permitted`. What do you do?
- [ ] Use `kill -9 812` instead
- [x] Run it with `sudo`: `sudo kill 812`
- [ ] Nothing – root's processes can never be stopped
```

```quiz
What's the difference between `pkill` and `killall`?
- [x] `pkill` matches a pattern, `killall` needs the exact name
- [ ] `pkill` sends `SIGKILL`, `killall` sends `SIGTERM`
- [ ] There is none – they are the same program
```

```quiz
What's wrong with `tar -cvf {{documents}} {{documents}}.tar`?
- [ ] `-v` can't be combined with `-c`
- [x] The order: the archive's name must come right after `f`, before the files
- [ ] A tar archive has to end in `.tgz`
```

```predict
$ cp {{documents}}/{{fruits}} .
$ gzip {{fruits}}
$ gunzip {{fruits}}.gz
$ ls {{fruits}}*
{{fruits}}
```

```quiz
What does `zcat server.log.gz` do?
- [x] Prints the uncompressed contents, and `server.log.gz` stays as it is
- [ ] Unpacks the file into `server.log`
- [ ] Compresses the file once more
---
`zcat` is the same as `gzip -dc`: decompress to standard output.
```

```try
du -sh {{documents}}
---
`-s` gives one total for the whole directory and `-h` makes the size easy to read.
```

```quiz
You create `ln -s {{notes}} link` and then remove `{{notes}}`. What happens when you run `cat link`?
- [ ] It shows the old contents
- [x] `No such file or directory` – the link is broken
- [ ] The link is removed too
---
A symbolic link only contains a path. When nothing is there any longer, the
link is broken. A hard link would have kept the contents alive.
```
