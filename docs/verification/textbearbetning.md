# textbearbetning – Text processing with sed and awk

Huvudkapitel: `skript`. Text: `src/Linux/content/chapters/en/textbearbetning.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `sed` works on lines, `awk` on columns (fields) |  | ogranskad |  |
| `sed` and `awk` are filters: read text, write the result to stdout; the original file is unchanged (except `sed -i`) |  | ogranskad |  |
| `sed` = stream editor; runs a script on each line; `s` = substitute |  | ogranskad |  |
| `s/PATTERN/REPLACEMENT/FLAGS`; without flags only the first match on each line is replaced; `g` replaces all |  | ogranskad |  |
| The `i` flag makes `s` case-insensitive |  | ogranskad |  |
| The sed pattern is a regular expression |  | ogranskad |  |
| `&` in the replacement means the matched text |  | ogranskad |  |
| The character after `s` decides the delimiter (e.g. `\|` or `#`) |  | ogranskad |  |
| `sed -E` enables extended regular expressions; groups are referenced as `\1`, `\2` |  | ogranskad |  |
| An address before a command chooses lines; `d` deletes, `p` prints |  | ogranskad |  |
| `sed -n` stops automatic printing; only `p` output is printed |  | ogranskad |  |
| Addresses: `5`, `$`, `/ERROR/`, `2,4`, `/WARN/,/ERROR/`, `/INFO/!` |  | ogranskad |  |
| `q` quits after a given line; `sed 3q` = `head -n 3` |  | ogranskad |  |
| Several commands are separated with `;` or several `-e` |  | ogranskad |  |
| `sed -i` writes the result back to the file; no undo |  | ogranskad |  |
| `sed -i.bak` saves the original as `file.bak` |  | ogranskad |  |
| Files in `/etc` are owned by root, so `sudo sed -i` is needed there |  | ogranskad |  |
| In `/etc/passwd` fields are separated by colons; field 1 is the user name and field 7 the shell |  | ogranskad |  |
| awk fields: `$1`…, `$0` whole line, `NF` number of fields, `$NF` last field, `NR` line number |  | ogranskad |  |
| awk fields are separated by spaces (any number) by default |  | ogranskad |  |
| The awk program goes in `{ }` and runs for every line; it must be in single quotes so the shell does not expand `$3` |  | ogranskad |  |
| `awk -F` sets the field separator |  | ogranskad |  |
| A comma in `print` gives a space in the output; without a comma the fields are joined |  | ogranskad |  |
| awk can reorder fields, mix in text and handle several spaces in a row (unlike `cut`) |  | ogranskad |  |
| An awk pattern (regex or condition) before `{ }` chooses lines; without `{ }` the whole line is printed |  | ogranskad |  |
| Comparisons `==`, `!=`, `<`, `<=`, `>`, `>=`; combine with `&&`, `\|\|`, `!` |  | ogranskad |  |
| A non-numeric value is compared as text, so the header line `poäng` matches `$3 >= 90` |  | ogranskad |  |
| awk variables need no declaration and start at 0 |  | ogranskad |  |
| `END { }` runs after the last line; `BEGIN { }` before the first |  | ogranskad |  |
| `printf` formats: `%-8s` left-aligned text in 8 characters, `%5d` integer in 5 characters |  | ogranskad |  |
| awk has functions such as `length()`, `toupper()`, `tolower()` |  | ogranskad |  |
| On Ubuntu, `awk` is mawk by default, a small and fast variant |  | ogranskad |  |
| mawk does not convert å, ä and ö with `toupper()`; GNU awk (package `gawk`) does |  | ogranskad |  |
| Distributions differ in which awk they use (previous text: GNU awk on Arch Linux and the Red Hat family) |  | ogranskad |  |
| The simulator only implements part of the awk language (incl. `if`, loops and arrays) |  | ogranskad |  |
| Checkpoint (predict): `echo banana \| sed 's/a/o/'` prints `bonana` |  | ogranskad |  |
| Checkpoint (quiz): `sed 's/kiwi/KIWI/' file` without `-i` leaves the file unchanged |  | ogranskad |  |
| Checkpoint (predict): `echo "Alva,matte,87" \| awk -F, '{print $3, $1}'` prints `87 Alva` |  | ogranskad |  |
| Checkpoint (try): `awk -F, '$2 == "svenska" {print $1}' ~/dokument/betyg.csv` works in a fresh shell |  | ogranskad |  |
