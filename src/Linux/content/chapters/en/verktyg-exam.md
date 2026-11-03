# Exam: More tools

Fourteen questions about git and other shells. You need 80 % right answers to
pass. The questions with commands start in a fresh terminal, so they first
install the program they need – `> /dev/null 2>&1` throws away the output of
those lines.

```quiz
You have changed `index.html` and created the new file `contact.html`. You
run `git commit -am "Contact page"`. What ends up in the commit?
- [x] Only the change to `index.html`
- [ ] Only `contact.html`
- [ ] Both files
---
`-a` adds every changed file git already follows – but never new files.
`contact.html` has to be added with `git add` first.
```

```quiz
You have run `git add` on a change in `style.css`. Which command shows that
change?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
`git diff` compares the working tree with the index, so it shows nothing once
the change is in the index. `--staged` shows what is waiting to be committed.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge {{newDesign}} > /dev/null
$ git log --oneline | wc -l
2
---
`main` had not changed since the branch was created, so the merge was a
*fast-forward*: git only moved `main` forward to the commit of `{{newDesign}}`.
No merge commit was created.
```

```quiz
What is a branch in git, technically?
- [ ] A full copy of every file in the project
- [x] A label that points at a commit and moves along when you make new commits
- [ ] A separate repository with its own `.git` directory
---
That is why branches are cheap in git – use them often.
```

```quiz
`git merge` stopped with a conflict in `index.html`. You have fixed the file
and removed the marker lines. What do you do next?
- [ ] Run `git merge` again
- [x] `git add index.html` and then `git commit`
- [ ] `git restore index.html`
---
`git add` tells git that the conflict is resolved, and `git commit` finishes
the merge. `git restore` would throw away your fix.
```

```quiz
The file `error.log` was committed by mistake. You add `*.log` to `.gitignore`,
but git still follows the file. How do you remove it from the repository but
keep it on the disk?
- [ ] `rm error.log`
- [x] `git rm --cached error.log`
- [ ] `git restore error.log`
---
`.gitignore` only applies to files git doesn't already follow. `--cached`
removes the file from git but leaves it on the disk.
```

```quiz
Which command fetches new commits from the remote **without** merging them
with yours?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
`git pull` fetches and merges; `git fetch` only fetches.
```

```quiz
Which of these changes are lost for good? Choose all that apply.
- [x] Changes in a file that was never committed, thrown away with `git restore`
- [x] Changes that were never committed, thrown away with `git reset --hard`
- [ ] A commit you made yesterday, before you ran `git reset --hard`
---
Anything that was committed at some point can almost always be rescued –
`git reflog` shows where you have been.
```

```quiz
You started zsh from bash. Which command shows the shell you are running
right now?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
`$SHELL` is your login shell – still `/bin/bash`. `/etc/shells` lists the
shells that may be used as login shells.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
`math` handles decimals.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
In fish, the exit status of the last command is called `$status` – `false`
always fails.
```

```quiz
How do you make `EDITOR` an environment variable with the value `nano` in fish?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
`-x` exports the variable; `-e` erases it.
```

```quiz
Which file does zsh read when it starts?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep {{user}} /etc/passwd
---
The last field of the line is your login shell – the one `chsh -s` changes.
```
