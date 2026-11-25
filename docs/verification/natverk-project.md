# natverk-project – Project: The website is down!

Huvudkapitel: `natverk` (frivilligt projekt efter provet). Text: `src/Linux/content/chapters/en/natverk-project.md`
(engelska är källspråket); delmålen och deras kontroller: `ts/packages/linux-content/src/Chapters/natverk/natverk-project.ts`.

Status: **ogranskad**

Projektet lär inte ut något nytt: det använder kommandona från Nätverk (och `mkdir`, `>`/`>>` och `myserver` från
tidigare delar). Delmålens lösningar körs i alla distributioner och med alla språks världar av testet `ChaptersTests`
("alla uppgifter går att lösa"); huvudkapitlet körs alltid i Ubuntu. Lösningen till nyckel-delmålet använder
`ssh-keygen -f ~/.ssh/id_ed25519 -N ''` (i simulatorns man-sida) i stället för att trycka Enter på frågorna.

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| `ip a` shows the computer's IP addresses; `ip route` shows the default gateway on the line `default via` |  | ogranskad |  |
| `>` creates or overwrites a file, `>>` appends to it |  | ogranskad |  |
| Without `-c`, `ping` keeps sending until it is stopped |  | ogranskad |  |
| Pinging a name also tests name resolution (DNS); the inside-out order is address, route, router, internet, name |  | ogranskad |  |
| `ss -tulpn` lists listening ports; the Process column is empty for other users' processes unless run as root |  | ogranskad |  |
| On Ubuntu `curl` is not preinstalled and is installed with apt |  | ogranskad |  |
| `curl -I URL` fetches only the response headers; the first line holds the status code (200 = OK) |  | ogranskad |  |
| `ssh-keygen` creates a key pair (default `~/.ssh/id_ed25519`); `-N ''` gives no passphrase and `-f` the file |  | ogranskad |  |
| `ssh-copy-id HOST` appends the public key to `~/.ssh/authorized_keys` on the server; then ssh logs in without a password |  | ogranskad |  |
| A `Host` alias in `~/.ssh/config` works for ssh, scp, rsync and ssh-copy-id |  | ogranskad |  |
| `rsync -av SRC/ HOST:DST/` copies the contents of SRC; a trailing slash on the source means "what is in the directory"; `scp -r` copies a directory |  | ogranskad |  |
| `ssh HOST COMMAND` runs the command on the server; a relative path there is relative to the home directory |  | ogranskad |  |
| `sudo ip link set IFACE down` / `up` turns a network interface off / on |  | ogranskad |  |
