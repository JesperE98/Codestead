# valkommen – Welcome to the Linux shell

Huvudkapitel: `start`. Text: `src/Linux/content/chapters/en/valkommen.md` (engelska är källspråket).

Status: **ogranskad**

Påståendena nedan har inte granskats mot officiella källor ännu. Kontrollfrågornas
förväntade utskrifter (predict) och try-kommandon är kontrollerade mot simulatorn av testerna
`PredictionsMatchTheSimulator` och `TryCommandsWork`, men inte mot ett riktigt system.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Linux, strictly speaking, is only the kernel |  | ogranskad |  |
| The kernel talks to the hardware and lets programs share processor, memory and disks |  | ogranskad |  |
| The Linux kernel was created by Linus Torvalds in 1991 |  | ogranskad |  |
| The Linux kernel is free software |  | ogranskad |  |
| A distribution bundles the kernel with a shell, tools, a package manager and perhaps a desktop |  | ogranskad |  |
| Debian, Ubuntu, Arch Linux and Fedora are Linux distributions |  | ogranskad |  |
| Distributions differ mainly in how software is installed |  | ogranskad |  |
| The terminal in the app runs Ubuntu 24.04 LTS (simulator: distro id `ubuntu`) |  | ogranskad |  |
| A shell is the program that reads and runs the commands you type |  | ogranskad |  |
| bash is the most common shell and the default on almost every distribution |  | ogranskad |  |
| zsh is the default shell on macOS |  | ogranskad |  |
| fish is a popular shell |  | ogranskad |  |
| The terminal is the window that shows text; the shell runs inside it |  | ogranskad |  |
| The Ubuntu prompt looks like `elev@ubuntu:~$` (user@host:directory$) |  | ogranskad |  |
| `~` means the home directory |  | ogranskad |  |
| The prompt ends in `$` for a regular user and `#` for root |  | ogranskad |  |
| `echo` prints its arguments |  | ogranskad |  |
| Command structure: command, options (flags), arguments – e.g. `ls -l /etc` |  | ogranskad |  |
| `whoami` prints the name of the logged-in user |  | ogranskad |  |
| `/etc/os-release` describes the distribution |  | ogranskad |  |
| `cat` prints a file |  | ogranskad |  |
| The simulator runs entirely inside the app and cannot harm the computer |  | ogranskad |  |
| The terminal can be reset with *Reset terminal* in the settings |  | ogranskad |  |
| Tab completes commands and file names |  | ogranskad |  |
| Up/Down arrows scroll through earlier commands |  | ogranskad |  |
| Ctrl+L clears the screen |  | ogranskad |  |
| Ctrl+C cancels the line being typed |  | ogranskad |  |
| `help` lists all commands in the simulator; `man command` shows a manual page |  | ogranskad |  |
| Checkpoint (quiz): the shell, not the terminal, reads and runs a typed command |  | ogranskad |  |
| Checkpoint (quiz): `#` at the end of the prompt means you are root |  | ogranskad |  |
| Checkpoint (quiz): in `ls -l /etc`, `-l` is the option |  | ogranskad |  |
| Checkpoint (try): `echo Linux is fun` prints `Linux is fun` |  | ogranskad |  |
| Checkpoint (quiz): pressing Tab after `ech` fills in the rest of the name; Ctrl+C cancels the line and Ctrl+L clears the screen |  | ogranskad |  |
