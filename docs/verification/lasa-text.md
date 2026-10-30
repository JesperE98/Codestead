# lasa-text – Reading and searching text

Huvudkapitel: `grunder`. Text: `content/linux/chapters/en/lasa-text.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Settings, logs and lists in Linux are mostly text |  | ogranskad |  |
| `cat` prints the whole file |  | ogranskad |  |
| In `less` you scroll with the arrow keys and space bar, search with `/word` and quit with `q` |  | ogranskad |  |
| `head` shows the first lines, `tail` the last; default 10 lines; `-n` chooses the number |  | ogranskad |  |
| `tail -f` follows a file and shows new lines as they are written; stop with Ctrl+C |  | ogranskad |  |
| `wc` (word count) counts lines, words and bytes; `wc -l` only lines |  | ogranskad |  |
| `grep` shows every line containing a pattern |  | ogranskad |  |
| `grep -i` ignores case |  | ogranskad |  |
| `grep -n` shows line numbers |  | ogranskad |  |
| `grep -v` shows non-matching lines |  | ogranskad |  |
| `grep -c` counts matching lines |  | ogranskad |  |
| `grep -r` searches recursively in a directory |  | ogranskad |  |
| `grep -E` uses extended patterns, e.g. `"ERROR\|WARN"` |  | ogranskad |  |
| The grep pattern is a regular expression; `^` = start of line, `$` = end of line |  | ogranskad |  |
| `sort` sorts alphabetically; `-n` numerically, `-r` reverse |  | ogranskad |  |
| `uniq` removes lines identical to the line directly above, so it is used after `sort` |  | ogranskad |  |
| Every command has a manual page shown with `man` |  | ogranskad |  |
| Checkpoint (try): `cat dokument/frukter.txt` works in a fresh shell |  | ogranskad |  |
| Checkpoint (predict): `tail -n 1 dokument/frukter.txt` prints `mango` |  | ogranskad |  |
| Checkpoint (quiz): `grep -c WARN dokument/server.log` prints 2 (case-sensitive; one line has lowercase `warn`); `grep -ic WARN` would count 3 |  | ogranskad |  |
| Checkpoint (quiz): `grep -v INFO` shows lines that do not contain INFO |  | ogranskad |  |
| Checkpoint (quiz): `uniq` only removes adjacent identical lines, hence `sort` first |  | ogranskad |  |
