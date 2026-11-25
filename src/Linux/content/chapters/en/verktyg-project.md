# Project: Pack your dotfiles

Big news: next week you get a brand-new computer. Lovely – except that everything
you have set up on this one stays behind. Your aliases, your git name, all those
little tweaks. They live in small hidden files in your home directory, files whose
names start with a dot. That's why they're called *dotfiles*, and programmers all
over the world keep theirs in a git repository: on a new computer they clone it, and
a minute later they feel at home.

Time to pack yours. Everything you need is in *More tools* – git, and what you
learnt about shells and their settings files. The challenge is putting it together
yourself.

## The assignment

1. **Get a moving box.** Create the directory `~/{{dotfilesDir}}` and make it a git
   repository.
2. **Pack what you have.** Copy your bash settings `~/.bashrc` and your git settings
   `~/.gitconfig` into the repository. Keep the dot in the name or drop it – both
   are common.
3. **Add something of your own.** Write the file `{{aliasFile}}` in the repository,
   with at least two aliases you would find useful.
4. **Seal the box.** Make a commit that contains both copies and `{{aliasFile}}`.
5. **Keep the secret out.** Your Wi-Fi password is going to live in
   `~/{{dotfilesDir}}/{{secretFile}}` – but it must never end up in the history.
   Dotfiles repositories are often public! Create the file, make git ignore it and
   commit what that takes.
6. **Experiment on a branch.** Create the branch `{{aliasBranch}}`, add at least one
   more alias to `{{aliasFile}}` and commit it on the branch.
7. **Unpack and use.** The new aliases work, so merge `{{aliasBranch}}` into the
   main branch. Then load `{{aliasFile}}` into your shell with `source` and run one
   of your aliases.

The milestones in the list next to this text are checked automatically as you run
your commands.

## Tips along the way

- `ls -a` shows the hidden files – the ones whose names start with a dot.
- Run `git status` often. It tells you what is new, what has changed and what goes
  into the next commit.
- An alias is written `alias ll='ls -la'`, without spaces around `=`. To write the
  line with `echo`, put double quotes outside and single quotes inside.
- Does git say *Please tell me who you are*? Then set `user.name` and `user.email`
  with `git config --global` first.
- `.gitignore` only applies to files git doesn't follow yet. Committed the password
  by mistake? `git rm --cached` takes it out of the repository but leaves it on the
  disk. The old commit still has it, though – in real life you would change the
  password.
- `source` reads the file into the shell you are sitting in. zsh understands the
  same alias lines as bash, so the file works in both.

## Want to do more?

Once the milestones are done, there is more to pack. Add the line
`source ~/{{dotfilesDir}}/{{aliasFile}}` to the end of `~/.bashrc`, so that every
new terminal gets your aliases. Copy `~/.zshrc` or fish's
`~/.config/fish/config.fish` too, if you have them. And play the new computer:
`git clone ~/{{dotfilesDir}} ~/new-computer` – is everything there? And is
`{{secretFile}}` really missing? Finally, admire your work with
`git log --oneline --graph --all`.
