# system-project – Project: The clubhouse

Huvudkapitel: `system` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/system-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/system/system-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder kommandona från Systemet. Delmålens lösningar körs i alla
distributioner och med alla språks världar av testet `ChaptersTests` ("alla uppgifter går att lösa").

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `chmod 700` (`rwx------`) lets only the owner read, write and enter a directory; x on a directory means entering it |  | ogranskad |  |
| `ls -ld DIR` shows the directory itself instead of its contents |  | ogranskad |  |
| A script needs the `x` permission and is run with `./` when it is in the current directory |  | ogranskad |  |
| Single quotes keep the text exactly as written (no expansion) |  | ogranskad |  |
| `export NAME=value` makes an environment variable; without `export` it stays a shell variable; no spaces around `=` |  | ogranskad |  |
| bash expands `~` after `=` in an assignment, also as an argument to `export` (`export X=~/dir` gives the full path) |  | ogranskad |  |
| `ln -s TARGET LINKNAME` creates a symbolic link; `cd` through a link to a directory works |  | ogranskad |  |
| `&` runs a command in the background; `nohup` keeps it running after you log out |  | ogranskad |  |
| With `nohup`, `ps` shows the command itself (`sleep`), so `pkill sleep` finds it |  | ogranskad |  |
| `jobs` shows job numbers, `ps` the PIDs; `kill %N`, `kill PID` and `pkill NAME` end a process |  | ogranskad |  |
| `tar -czvf ARCHIVE DIR` creates a gzip-compressed tar archive; paths in it are relative to where you pack from; `tar -tzf` lists it |  | ogranskad |  |
| A symbolic link with an absolute target keeps working when the link moves, but breaks when the target moves |  | ogranskad |  |
