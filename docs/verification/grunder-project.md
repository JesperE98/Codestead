# grunder-project – Project: The log detective

Huvudkapitel: `grunder` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/grunder-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/grunder/grunder-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder kommandona från Grunderna. Delmålens lösningar körs i alla
distributioner och med alla språks världar av testet `ChaptersTests` ("alla uppgifter går att lösa").

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `mkdir -p a/b` creates every missing folder along the way |  | ogranskad |  |
| `cp` copies and leaves the original; `mv` moves it |  | ogranskad |  |
| `grep -i` ignores upper and lower case |  | ogranskad |  |
| `wc -l` reading from a pipe prints only the number of lines |  | ogranskad |  |
| `>` overwrites a file, `>>` adds to its end |  | ogranskad |  |
| `head -n 1` prints the first line |  | ogranskad |  |
| `cut -d' ' -f2` prints the second space-separated field |  | ogranskad |  |
| `sort -r` sorts in reverse order (times as HH:MM:SS sort correctly as text) |  | ogranskad |  |
