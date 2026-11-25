# skript-project – Project: The report robot

Huvudkapitel: `skript` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/skript-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/skript/skript-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder sed, awk, shell-skript och cron från Skript och automatisering (och
pipes från Grunderna). Delmålens lösningar körs med alla språks världar av testet `ChaptersTests` ("alla uppgifter går
att lösa").

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| A script starting with `#!/bin/bash` runs with bash when it is executable and started as `./script` |  | ogranskad |  |
| `$#` is the number of arguments and `$1` the first argument of a script |  | ogranskad |  |
| `exit 1` ends a script with exit code 1, and `echo $?` right after shows the exit code |  | ogranskad |  |
| `[ -f FILE ]` is true if the file exists and is a regular file; `!` negates the test |  | ogranskad |  |
| `>&2` sends a command's output to stderr |  | ogranskad |  |
| `awk '{print toupper($3)}'` prints the third whitespace-separated field in capitals |  | ogranskad |  |
| `sort \| uniq -c` counts identical lines, with the count first |  | ogranskad |  |
| `sed 's/^[0-9-]* //'` removes the leading date and the space after it |  | ogranskad |  |
| A here document with `cat > FILE << 'END'` replaces the file's contents |  | ogranskad |  |
| In a crontab, `30 6 * * 1-5` means 06:30 Monday to Friday |  | ogranskad |  |
| `(crontab -l; echo 'LINE') \| crontab -` adds a job and keeps the old ones |  | ogranskad |  |
| cron runs jobs with `/bin/sh`, a short `PATH` and no terminal, so output must be sent to a file |  | ogranskad |  |
| `>>` appends to a file instead of overwriting it |  | ogranskad |  |
| `journalctl -u cron` shows the runs of the cron service on Ubuntu |  | ogranskad |  |
