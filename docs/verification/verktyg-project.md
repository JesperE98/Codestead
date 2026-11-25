# verktyg-project – Project: Pack your dotfiles

Huvudkapitel: `verktyg` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/verktyg-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/verktyg/verktyg-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder git och skalens inställningsfiler från Fler verktyg (och alias och
`source` från Systemet). Delmålens lösningar körs med alla språks världar av testet `ChaptersTests` ("alla uppgifter
går att lösa").

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Files whose names start with a dot are hidden; `ls -a` shows them |  | ogranskad |  |
| Settings files such as `~/.bashrc` and `~/.gitconfig` are commonly called dotfiles and are often kept in a git repository |  | ogranskad |  |
| `git init` turns a directory into a repository |  | ogranskad |  |
| `git config --global user.name`/`user.email` are stored in `~/.gitconfig`; without them `git commit` asks *Please tell me who you are* |  | ogranskad |  |
| An alias is defined as `alias ll='ls -la'`, without spaces around `=` |  | ogranskad |  |
| `.gitignore` only applies to files git does not track yet |  | ogranskad |  |
| `git rm --cached FILE` removes the file from the repository but keeps it on disk; older commits still contain it |  | ogranskad |  |
| `git switch -c BRANCH` creates a branch and switches to it; `git commit -am` commits changes to tracked files |  | ogranskad |  |
| `git merge BRANCH` merges the branch into the current one |  | ogranskad |  |
| `source FILE` runs the file in the current shell, so its aliases become available there |  | ogranskad |  |
| zsh understands the same `alias` lines as bash |  | ogranskad |  |
| `git clone DIR NEWDIR` copies a local repository with its history; ignored files are not part of it |  | ogranskad |  |
