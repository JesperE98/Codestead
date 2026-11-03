# pipes – Redirection and pipes

Huvudkapitel: `grunder`. Text: `src/Linux/content/chapters/en/pipes.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Every program has three standard streams: 0 stdin, 1 stdout, 2 stderr |  | ogranskad |  |
| stdin is normally the keyboard; stdout and stderr normally go to the screen |  | ogranskad |  |
| `>` sends stdout to a file, creating it or overwriting it |  | ogranskad |  |
| `>>` appends to the end of the file |  | ogranskad |  |
| `<` makes a program read stdin from a file |  | ogranskad |  |
| With `<`, `wc` never sees the file name and prints only the number |  | ogranskad |  |
| `>` does not affect error messages (stderr) |  | ogranskad |  |
| `2>` redirects stderr |  | ogranskad |  |
| `/dev/null` discards everything written to it |  | ogranskad |  |
| `2>&1` sends stderr the same way as stdout |  | ogranskad |  |
| A pipe `\|` sends stdout of one command to stdin of the next |  | ogranskad |  |
| Unix philosophy: do one thing and do it well, and let programs work together |  | ogranskad |  |
| `uniq -c` counts occurrences; `sort -rn` sorts numerically, largest first |  | ogranskad |  |
| `tee` passes its input on and saves a copy in a file |  | ogranskad |  |
| `a ; b` runs a then b; `a && b` runs b only if a succeeded; `a \|\| b` runs b only if a failed |  | ogranskad |  |
| Checkpoint (predict): `echo one > t.txt; echo two > t.txt; cat t.txt` prints `two` |  | ogranskad |  |
| Checkpoint (predict): `wc -l dokument/frukter.txt` prints `10 dokument/frukter.txt` and `wc -l < dokument/frukter.txt` prints `10` |  | ogranskad |  |
| Checkpoint (quiz): with `ls /finnsinte > fel.txt` the error goes to the screen and `fel.txt` stays empty |  | ogranskad |  |
| Checkpoint (try): `ls /etc \| wc -l` works in a fresh shell |  | ogranskad |  |
| Checkpoint (predict): `mkdir dokument 2> /dev/null && echo created \|\| echo failed` prints `failed` (dokument exists) |  | ogranskad |  |
