# navigera – Navigating the file system

Huvudkapitel: `grunder`. Text: `content/linux/chapters/en/navigera.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Linux has no drive letters; everything is in one tree starting at the root `/` |  | ogranskad |  |
| `/home` holds users' home directories, e.g. `/home/elev` |  | ogranskad |  |
| `/root` is root's home directory |  | ogranskad |  |
| `/etc` holds system configuration files |  | ogranskad |  |
| `/usr/bin` holds programs such as `ls` and `cat` |  | ogranskad |  |
| `/var/log` holds log files |  | ogranskad |  |
| `/tmp` holds temporary files that anyone may write |  | ogranskad |  |
| `/dev` holds devices, e.g. disks |  | ogranskad |  |
| `/proc` holds information about processes and the kernel |  | ogranskad |  |
| `/boot` holds files needed to start the computer |  | ogranskad |  |
| The layout is called the Filesystem Hierarchy Standard and is almost identical across distributions |  | ogranskad |  |
| `pwd` = print working directory, shows the current directory |  | ogranskad |  |
| `ls` lists a directory, the current one without arguments |  | ogranskad |  |
| `ls -l` gives a long format |  | ogranskad |  |
| Files whose names start with a dot are hidden and not shown by `ls` by default |  | ogranskad |  |
| `.bashrc` is a hidden settings file |  | ogranskad |  |
| `ls -a` (all) shows hidden files |  | ogranskad |  |
| `ls -la` is the same as `ls -l -a` |  | ogranskad |  |
| `cd` = change directory |  | ogranskad |  |
| An absolute path starts with `/`; a relative path starts from the current directory |  | ogranskad |  |
| `.` is the current directory, `..` the parent, `~` the home directory |  | ogranskad |  |
| `cd -` goes to the previous directory |  | ogranskad |  |
| `cd` without arguments goes to the home directory |  | ogranskad |  |
| Tab completes names; with several possibilities they are shown when pressing Tab |  | ogranskad |  |
| Checkpoint (quiz): log files are expected in `/var/log` |  | ogranskad |  |
| Checkpoint (quiz): `.bashrc` is not shown by plain `ls` because its name starts with a dot |  | ogranskad |  |
| Checkpoint (try): `ls -la` works in a fresh shell |  | ogranskad |  |
| Checkpoint (quiz): from `/home`, both `cd elev/dokument` and `cd /home/elev/dokument` reach `/home/elev/dokument`; `cd /elev/dokument` and `cd dokument` do not |  | ogranskad |  |
| Checkpoint (predict): `cd /usr/bin; cd ..; pwd` prints `/usr` |  | ogranskad |  |
