# grunder-exam – Exam: The basics

Huvudkapitel: `grunder`. Text: `src/Linux/content/chapters/en/grunder-exam.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Quiz: `/usr/bin` is absolute; `var/log`, `../etc` and `dokument` are relative |  | ogranskad |  |
| Predict: `cd /var/log; cd ../..; pwd` prints `/` |  | ogranskad |  |
| Quiz: `cd -` goes back to the directory you were in last |  | ogranskad |  |
| Quiz: `cp -r bilder bilder-kopia` copies a whole directory; `mv` would move it |  | ogranskad |  |
| Predict: `mkdir -p a/b/c; ls a/b` prints `c` |  | ogranskad |  |
| Quiz: `touch min fil.txt` without quotes creates two files, `min` and `fil.txt` |  | ogranskad |  |
| Quiz: `grep -i error` matches error in any mix of upper and lower case |  | ogranskad |  |
| Quiz: `tail -f` follows a file; stop with Ctrl+C |  | ogranskad |  |
| Quiz: `wc` without options prints lines, words and bytes |  | ogranskad |  |
| Predict: `echo a > x.txt; echo b >> x.txt; echo c > x.txt; cat x.txt` prints `c` |  | ogranskad |  |
| Quiz: in `a \|\| b`, b runs only if a failed |  | ogranskad |  |
| Try: `grep ERROR ~/dokument/server.log \| tee fel.txt \| wc -l` works; tee saves a copy and passes the lines on |  | ogranskad |  |
| Predict: `echo "a,b,c" \| cut -d, -f2` prints `b` |  | ogranskad |  |
| Predict: `echo "x y z" \| awk '{print NF}'` prints `3` |  | ogranskad |  |
| Quiz: an awk program is written in single quotes so the shell does not replace `$3` before awk starts |  | ogranskad |  |
