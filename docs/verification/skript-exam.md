# Faktagranskning: skript-exam (Exam: Scripts and automation)

Status: **ogranskad**

Källtext: `src/Linux/content/chapters/en/skript-exam.md`. Predict-svaren kontrolleras av testet
`PredictionsMatchTheSimulator`; här granskas att frågorna och svaren stämmer på ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Shebang-raden talar om vilket program som kör filen; den gör inte filen körbar | | ogranskad | |
| `namn = Kim` ger `command not found` eftersom `namn` tolkas som ett kommando | | ogranskad | |
| `antal=$(ls ~/dokument \| wc -l)` ger `3` (tre filer i simulatorns `~/dokument`) | | ogranskad | |
| `a=5; (( a += 10 ))` ger `15` | | ogranskad | |
| `"$@"` innehåller alla argument, vart och ett för sig | | ogranskad | |
| `[ $n -gt 10 ]` är sant när talet är större än 10; `>` och `=` jämför text | | ogranskad | |
| `[ -d ~/finnsinte ] && echo yes \|\| echo no` skriver `no` | | ogranskad | |
| `case` med `*.txt)` matchar `rapport.txt` | | ogranskad | |
| Funktionen `plus() { echo $(( $1 + $2 )); }` med `4 5` skriver `9` | | ogranskad | |
| `continue` hoppar över resten av varvet (talet 3 skrivs inte ut) | | ogranskad | |
| `local` skapar en variabel som bara finns i funktionen | | ogranskad | |
| `exit 1` låter anroparen se på slutkoden att något gick fel | | ogranskad | |
| Ett here-dokument slutar vid raden med slutordet (`SLUT`) | | ogranskad | |
| `for i in $(seq 1 3)` går igenom 1, 2 och 3 | | ogranskad | |
| Provet kräver 80 % (enligt docs/DEVELOPMENT.md) | | ogranskad | |
| Predict: `echo "x y z" \| awk '{print NF}'` prints `3` |  | ogranskad |  |
| Quiz: an awk program is written in single quotes so the shell does not replace `$3` before awk starts |  | ogranskad |  |
