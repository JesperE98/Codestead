# filer – Files and directories

Huvudkapitel: `grunder`. Text: `content/linux/chapters/en/filer.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `mkdir` creates a directory |  | ogranskad |  |
| `mkdir -p` (parents) creates several levels at once; without it `mkdir` complains if the parent does not exist |  | ogranskad |  |
| `touch` creates an empty file if it does not exist, otherwise updates its timestamp |  | ogranskad |  |
| `cp` copies; if the target is a directory the copy ends up inside it with the same name |  | ogranskad |  |
| `cp -r` (recursive) copies a whole directory |  | ogranskad |  |
| Moving and renaming are the same operation; `mv` does both |  | ogranskad |  |
| `rm` deletes files |  | ogranskad |  |
| `rmdir` removes only empty directories |  | ogranskad |  |
| `rm -r` removes a directory and everything in it |  | ogranskad |  |
| There is no recycle bin in the terminal; what `rm` deletes is gone |  | ogranskad |  |
| `rm -rf` (recursive, force) asks no questions and never complains |  | ogranskad |  |
| The shell expands wildcards into file names before the command runs |  | ogranskad |  |
| `*` matches zero or more characters, `?` exactly one character, `[abc]` one of a, b or c |  | ogranskad |  |
| `ls` never sees the `*`; the shell has already replaced the pattern |  | ogranskad |  |
| In the simulator, `~/dokument` contains `betyg.csv`, `frukter.txt` and `server.log` |  | ogranskad |  |
| The shell splits the command line at spaces; names with spaces need quotes or a backslash before the space |  | ogranskad |  |
| Checkpoint (quiz): `touch` on an existing file only updates its timestamp; contents stay the same |  | ogranskad |  |
| Checkpoint (predict): `mkdir kopior; cp anteckningar.txt kopior; ls kopior` prints `anteckningar.txt` |  | ogranskad |  |
| Checkpoint (quiz): `mv a.txt b.txt` (b.txt does not exist) renames a.txt to b.txt |  | ogranskad |  |
| Checkpoint (quiz): `rmdir gammalt` removes the directory only if it is empty |  | ogranskad |  |
| Checkpoint (predict): `ls dokument/?????.*` prints `dokument/betyg.csv` |  | ogranskad |  |
