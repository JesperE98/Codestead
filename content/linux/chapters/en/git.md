# Git in the terminal

Have you ever saved files called `report-final.txt`, `report-final-2.txt` and
`report-REALLY-final.txt`? Then you have done *version control* by hand. A
version control system does the same thing properly: it saves snapshots of
the whole project, remembers who changed what and why, lets you travel back
in time and makes it possible for many people to work on the same files at
once.

**Git** is by far the most common version control system. It was written in
2005 by Linus Torvalds – the same person who wrote the Linux kernel – to
manage the kernel's source code. Today git is used for almost all software,
but it works just as well for web pages, configuration files, notes and
books. Anything that is text is a perfect fit.

Git is built for the terminal. Graphical programs and editors have git
buttons, but under the hood they run the same commands you learn here.

## Install git

Git is not always preinstalled. In the Ubuntu terminal you install it with
apt:

```sh
sudo apt update
sudo apt install git
```

Other distributions install it with their own package manager, as you
learned in the part about distributions and packages – the package is
called `git` there too. Check that it works:

```sh
git --version
```

All git commands have the form `git COMMAND`, for example `git status` or
`git log`. The manual is available with `man git`.

## Tell git who you are

Every saved version in git contains the name and email address of the person
who made it. That is why git wants to know who you are before you can save
anything. You set it once per computer:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

Feel free to use your own name. `--global` means the setting applies to all
your projects. It is stored in the ordinary text file `~/.gitconfig`:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

If you forget this step, git complains when you try to save:
`*** Please tell me who you are.` – and suggests exactly these two commands.

> **Tip:** Also add `git config --global init.defaultBranch main`. The main
> branch of every new project is then called `main` on all your computers.
> Older versions of git call it `master`, and you will see both names out in
> the world.

## A new repository

Your home directory contains a small web project, `~/{{webProject}}`, with
three files. Go there and have a look:

```sh
cd ~/{{webProject}}
ls
```

To make git start tracking the directory, turn it into a **repository**
(*repo* for short):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

The only thing that happened is that a hidden directory, `.git`, was created.
That is where git keeps the entire history. Git does not touch your files.

```sh
ls -a
ls .git
```

Never delete `.git` unless you want to lose the history – and don't edit the
files in it by hand. If you want to stop using git in a project, removing
`.git` is enough; your ordinary files stay.

```quiz
You want to stop using git in a project, but keep all your files. What do you do?
- [ ] Run `git init` again
- [x] Remove the hidden directory `.git`
- [ ] Remove every file except `.git`
---
The whole history lives in `.git`, and git does not touch your ordinary files.
Without `.git` the files stay – only the history is gone.
```

## Three places: working tree, index and history

The most important thing to understand about git is that a change passes
through three places:

```text
 working tree  ──git add──▶  index  ──git commit──▶  history
 (the files you see)       (next commit)             (.git)
```

- The **working tree** is the files as they look right now, the ones you edit.
- The **index** (also called the *staging area*) is a kind of packing table.
  That is where you put what should go into the next saved version.
- The **history** consists of **commits**. A commit is a saved snapshot of
  all files, with a message, an author and a time.

Why the middle step? So that you can choose. If you have changed five files
but only two belong together, you can put those two in the index, commit
them and save the rest for a commit of its own.

```quiz
You have changed five files, but only two of the changes belong together.
How do you save just those two in a commit?
- [ ] Run `git commit` first and `git add` on the two files afterwards
- [x] Run `git add` on the two files, then `git commit`
- [ ] Commit all five – a commit always takes every changed file
---
A commit saves what is in the index. The other three changes stay in the
working tree until you add them.
```

## `git status` is your compass

The command you will run most often is `git status`. It tells you where every
change is – and often suggests what to do next. Run it too often rather than
too rarely!

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

*Untracked files* are files git can see but does not follow yet. In a real
terminal they are shown in red. Put them in the index with `git add`:

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

Now they are listed under *Changes to be committed* – in green. Instead of
naming each file you can type `git add .`, which adds everything in the
current directory (the dot means "here"). `git add -A` adds every change in
the whole repository.

## The first commit

Save the snapshot with `git commit`. The `-m` option gives the message:

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

`3f2a9c1` is the beginning of the commit's **id** – a 40-character *hash*
calculated from the contents. Your id will differ, since the time and your
name are part of it. The first seven characters are usually enough to
identify a commit.

Run `git status` again:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* means everything is saved. Nice!

## See what changed: `git diff`

Add a line to `README.md` and ask git what happened:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 5cdcbf7..291e8f6 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 A small website that I keep under version control with git.
+{{builtWith}}
```

The line starting with `+` is new (green), lines starting with `-` were
removed (red) and the rest are shown as context. `@@ -1,3 +1,4 @@` means that
lines 1–3 of the old version correspond to lines 1–4 of the new one.

`git diff` compares the working tree with the index – that is, what you have
*not* added yet. To see what is in the index waiting to be committed, type
`git diff --staged`.

Add and commit the change. The `-a` option runs `git add` on every file git
already follows, so it takes a single step:

```sh
git commit -a -m "{{commitDescribe}}"
```

Note that `-a` does *not* include new files that git doesn't follow yet. You
always have to add those with `git add` first.

The questions with commands in this chapter start in a fresh terminal, so
they first install git and make the first commit. `> /dev/null 2>&1` throws
away the output of those lines, as you learned in the chapter on redirection
and pipes. What does the last command print?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "{{commitFirst}}" > /dev/null
$ echo 'One more line.' >> README.md
$ git commit -m "One more line" > /dev/null
$ git log --oneline | wc -l
1
---
The second commit never happened: the change to `README.md` was not in the
index, so there was nothing to commit. `git add README.md` first – or
`git commit -a` – would have given two commits.
```

## Good commit messages

Six months from now, the commit messages are what tell the story – to you
and to others. Some rules of thumb:

- Write a short first line, preferably under 50 characters, that sums up the
  change.
- Describe *what* the change does and preferably *why*, not *how* you wrote it.
- One commit should do one thing. Three small commits are better than one big.
- Need to explain more? Leave a blank line and write a longer text below.
  Each `-m` becomes a paragraph of its own: `git commit -m "Title" -m "Explanation."`

| Bad | Better |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

In English, messages are usually written in the imperative: *Add contact
form*, *Fix broken link*. It reads as "this commit will …".

## Look at the history

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

The newest commit comes first. `HEAD -> main` means you are on the branch
`main` and that this is its latest commit. Some useful variants:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` gives one line per commit, `-n 1` shows only the latest, `--stat`
shows which files changed and `git show` shows a commit including the change
itself. You can also look at a file as it was in a particular commit:
`git show HEAD~1:README.md` (`HEAD~1` means "the commit before the latest").

## Undo

Git makes undoing easy – that is half the point:

| If you want to … | Command |
|---|---|
| throw away changes in a file (not added yet) | `git restore FILE` |
| take a file out of the index (the change stays) | `git restore --staged FILE` |
| change the message of the latest commit | `git commit --amend -m "New message"` |
| jump back to how everything looked at the latest commit | `git reset --hard` |

Try wrecking a file and getting it back:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **Note!** `git restore FILE` and `git reset --hard` throw away changes that
> were never committed. They cannot be recovered. Anything that was committed
> at some point, on the other hand, can almost always be rescued – ask
> `git reflog` where you have been.

## Branches

A **branch** is a separate line of development. You can try a new idea in a
branch without touching the working version in `main`. If it turns out well
you merge the branch into `main`; if not, you throw it away.

Technically a branch is just a label that points at a commit and moves along
when you make new commits. That is why branches are cheap in git – use them
often!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` creates the branch and switches to it. The star in `git branch` shows where you are. Make a change and commit it
on the branch:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Switch back to `main` and look at `style.css`:

```sh
git switch main
tail -3 style.css
```

The purple colour is gone! When you switch branches, git rewrites the
working tree to look like the branch's latest commit. The change is safe in
`{{newDesign}}`. `git log --oneline --all` shows all branches:

```sh
git log --oneline --all
```

> **Tip:** Older guides often use `git checkout {{newDesign}}` and
> `git checkout -b new-branch`. `checkout` does the same as `switch`, but can
> also restore files. The newer commands `switch` and `restore` split the
> jobs and are easier to remember.

Uncommitted changes come along when you switch branches – unless they clash
with the other branch. Then git refuses and asks you to commit first (or to
put the changes aside temporarily with `git stash` and bring them back with
`git stash pop`).

How many lines containing `purple` does `style.css` have at the end?

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
$ grep purple style.css | wc -l
0
---
The purple line was committed on `{{newDesign}}`. When you switch to `main`, git
makes the working tree look like the latest commit of `main` – where the line
does not exist yet.
```

## Merge branches: `git merge`

Stand on the branch that should *receive* the changes – here `main` – and
merge:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* means that `main` has not changed since the branch was
created. Git then only has to move `main` forward to the same commit as
`{{newDesign}}`.

If both branches have new commits, git does a **three-way merge**: it
compares both branches with their common ancestor and creates a new *merge
commit* with two parents. `git log --oneline --graph --all` shows how the
history splits and joins again:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'heading'
|\
| * 7c3f9e2 (heading) Friendlier heading
* | 52d8a71 Shorter text
|/
* c19e2f4 {{commitPurple}}
```

A merged branch is no longer needed and can be deleted. `-d` refuses if the
branch has commits that are not in the one you are on:

```sh
git branch -d {{newDesign}}
```

## Conflicts

If both branches changed *the same lines*, git cannot know which version is
right. That is called a **conflict**, and then you decide. Let's create one
on purpose:

```sh
git switch -c heading
sed -i 's/Welcome!/Hello and welcome!/' index.html
git commit -am "Friendlier heading"
git switch main
sed -i 's/Welcome!/Welcome to my site!/' index.html
git commit -am "Longer heading"
git merge heading
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Relax – nothing is broken. `git status` lists the file under *Unmerged paths*
as `both modified`. Look inside it:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Welcome to my site!</h1>
=======
  <h1>Hello and welcome!</h1>
>>>>>>> heading
```

Between `<<<<<<< HEAD` and `=======` is your version (the branch you are on);
between `=======` and `>>>>>>> heading` is the other branch's. This is how you
resolve the conflict:

1. Open the file in an editor and make it the way you want it – pick one of
   the lines, or combine them – and delete the marker lines.
2. Tell git the conflict is resolved with `git add FILE`.
3. Finish the merge with `git commit`.

The simulator has no real editor, but if you just want to pick one side's
version, git can do it for you: `--ours` takes your version and `--theirs`
the other branch's.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Merge the heading branch"
```

If you change your mind in the middle of a conflict, `git merge --abort`
takes you back to where you were before the merge.

Conflicts are completely normal when several people work on the same
project. A good way to get fewer of them is to make small commits and merge
often.

```quiz
You are on `main` and run `git merge heading`. The file gets a conflict:

    <<<<<<< HEAD
      <h1>Hello!</h1>
    =======
      <h1>Welcome!</h1>
    >>>>>>> heading

Which line comes from `main`?
- [x] `<h1>Hello!</h1>`
- [ ] `<h1>Welcome!</h1>`
---
`HEAD` is the branch you are on – here `main`. Its version is between
`<<<<<<< HEAD` and `=======`; the other branch's version comes after `=======`.
```

## Files git should ignore: `.gitignore`

Some files should never end up in the history: passwords and keys, logs,
temporary files and things that are built automatically. Write their names
or patterns in the file `.gitignore` at the root of the repository:

```sh
echo 'password=secret' > secret.txt
echo 'error' > error.log
printf 'secret.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`secret.txt` and `error.log` are no longer shown – not even `git add .`
picks them up. A `*` matches anything, and a trailing
slash (`build/`) means a whole directory. `.gitignore` itself, on the other
hand, should be committed, so that everyone working on the project ignores
the same things:

```sh
git add .gitignore
git commit -m "Ignore secrets and logs"
```

Note that `.gitignore` only applies to files git doesn't already follow. If a
file has already been committed, remove it from the repository (but not from
the disk) with `git rm --cached FILE`.

## GitHub, GitLab and remote repositories

So far everything has lived in your own repository. To collaborate, or just
to have a backup, you usually keep a copy of the repository on a server – a
**remote**. The best-known services are **GitHub**, **GitLab** and
**Codeberg**.

| Command | Does |
|---|---|
| `git clone URL` | Downloads a whole repository, with all history, into a new directory |
| `git push` | Sends your new commits to the remote |
| `git pull` | Fetches new commits from the remote and merges them with yours |
| `git fetch` | Fetches new commits without merging anything |
| `git remote -v` | Lists the remotes |

The remote is usually called `origin`, and a typical workflow looks like
this: `git pull` when you start, then edit, `git add` and `git commit` – and
finally `git push`. GitHub and GitLab use an SSH key or an access token to
log you in, not a password.

All of this needs a network, and the simulator doesn't have one. But
`clone`, `push` and `pull` work just as well between two repositories on the
same computer, so you can try them anyway. Clone your project into a new
directory:

```sh
cd ~
git clone ~/{{webProject}} ~/copy
cd ~/copy
git log --oneline
git remote -v
```

A server like GitHub only has the history, no working tree. Such a *bare*
repository is created with `git init --bare`. Pretend it is your GitHub
account and push `main` there:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

`-u` links your `main` with `origin/main`, so that `git status` can tell you
whether you are ahead of or behind the server, and so that plain `git push`
and `git pull` are enough from then on.

## Summary

| Command | Does |
|---|---|
| `git init` | Turns the directory into a repository |
| `git status` | Shows the state – run it often! |
| `git add FILE` / `git add .` | Puts changes in the index |
| `git commit -m "…"` | Saves the index as a new commit |
| `git diff` / `git diff --staged` | Shows changes that are not committed |
| `git log --oneline --graph --all` | Shows the history |
| `git restore FILE` | Throws away changes in a file |
| `git switch -c BRANCH` | Creates a branch and switches to it |
| `git merge BRANCH` | Merges a branch into the one you are on |
| `git clone`, `git pull`, `git push` | Collaborate through a remote |
