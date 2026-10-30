# Summary: More tools

In this part you met two tools that you will use for the rest of your life
in the terminal: git, which keeps the history of your files, and other shells
than bash. Here is what you should remember before the exam.

## Git in the terminal

**Git** is a version control system: it saves snapshots of the whole project,
remembers who changed what and why, and lets you go back in time. On Ubuntu
you install it with `sudo apt install git`; other distributions use their own
package manager.

- Before your first commit you tell git who you are with
  `git config --global user.name` and `user.email`. `--global` means all your
  projects; the settings end up in `~/.gitconfig`.
- `git init` turns a directory into a **repository**. The whole history lives
  in the hidden directory `.git`.
- A change passes through three places: the **working tree** (the files you
  see), the **index** (what goes into the next commit) and the **history**
  (the commits). `git add` moves changes to the index, `git commit` saves the
  index as a new commit.
- `git commit -a` adds every changed file git already follows – but never new
  files.
- `git diff` shows changes that are not in the index yet; `git diff --staged`
  shows what is in the index.
- A **branch** is a label that points at a commit and moves along with new
  commits. When you switch branches, git rewrites the working tree.
- `git merge` brings a branch into the one you are on. If both branches have
  changed the same lines you get a **conflict**: fix the file, `git add` it and
  finish with `git commit`.
- `.gitignore` lists files git should not follow. It only applies to files
  git doesn't already follow.
- A **remote** is a copy of the repository somewhere else, usually called
  `origin`. `git pull` fetches and merges, `git push` sends your commits.

| Command | Does |
|---|---|
| `git config --global user.name "…"` | Tell git your name (and `user.email`) |
| `git init` | Turn the directory into a repository |
| `git status` | Show where every change is |
| `git add FILE` / `git add .` | Put changes in the index |
| `git commit -m "…"` | Save the index as a new commit |
| `git commit -am "…"` | Add every followed file and commit in one step |
| `git diff` / `git diff --staged` | Show changes that are not committed |
| `git log --oneline --graph --all` | Show the history |
| `git restore FILE` | Throw away changes in a file |
| `git restore --staged FILE` | Take a file out of the index |
| `git switch -c BRANCH` / `git switch BRANCH` | Create a branch / switch branch |
| `git merge BRANCH` | Merge a branch into the one you are on |
| `git branch -d BRANCH` | Delete a merged branch |
| `git rm --cached FILE` | Stop following a file but keep it on disk |
| `git clone`, `git pull`, `git push` | Collaborate through a remote |

## Other shells: zsh and fish

The **shell** reads what you type and starts other programs. Programs like
`ls` and `grep` work the same in every shell – what differs is the language
around them: variables, loops, conditions and the prompt.

- `/etc/shells` lists the shells that may be login shells. Your login shell is
  the last field of your line in `/etc/passwd` and is also in `$SHELL`. `$0`
  holds the shell you are running right now.
- **zsh** understands almost all bash syntax and adds conveniences: `**/`
  searches all subdirectories, and with `autocd` you go to a directory by just
  typing its name. Options are turned on and off with `setopt` and `unsetopt`.
  Unlike bash, zsh does not split unquoted variables on spaces.
- **fish** is easy to use from the start but has **its own syntax**: `set`
  instead of `=`, `$status` instead of `$?`, `math` instead of `$((...))`, and
  every block ends with `end`. Every variable is a list, numbered from 1.
- A started shell runs **inside** bash; `exit` takes you back. With `-c` a
  shell runs one command and exits.
- Scripts are still written for bash (or POSIX `sh`): the `#!` line decides
  which shell runs a script, whatever shell you are sitting in.
- `chsh -s` changes your login shell. The change takes effect at the next
  login.

| Command | Does |
|---|---|
| `cat /etc/shells` | List the shells that may be used |
| `echo $0` / `ps` | See which shell you are running right now |
| `echo $SHELL` | See your login shell |
| `zsh` / `fish` / `exit` | Start another shell / go back |
| `zsh -c '…'` / `fish -c '…'` | Run one command in another shell |
| `setopt autocd` / `unsetopt autocd` | Turn a zsh option on / off |
| `set frukt äpple` / `set -e frukt` | Set / remove a variable in fish |
| `set -x NAME value` | Set an environment variable in fish |
| `math 17 x 23` | Arithmetic in fish |
| `chsh -s /usr/bin/zsh` | Change your login shell |

The configuration files: `~/.bashrc` (bash), `~/.zshrc` (zsh) and
`~/.config/fish/config.fish` (fish).
