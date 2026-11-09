# Faktagranskning: natverk

Kapitel: Nätverk (`src/Linux/content/chapters/en/natverk.md`)

Status: **ogranskad**

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| Simulatorns hemnätverk: `ubuntu` 192.168.1.42, router 192.168.1.1, server 192.168.1.10 |  | ogranskad |  |
| IPv4-adress = fyra tal 0–255; `192.168.`, `10.` och `172.16.`–`172.31.` är privata |  | ogranskad |  |
| `ip` kommer från iproute2; `ip addr` kan förkortas `ip a` |  | ogranskad |  |
| `lo` är loopback; `enp0s3` är nätverkskortet; förr `eth0`, trådlösa ofta `wlan0`/`wlp2s0` |  | ogranskad |  |
| `inet` = IPv4-adress, `link/ether` = MAC-adress, `state UP` = kortet är igång |  | ogranskad |  |
| `ip -br a` och `hostname -I` |  | ogranskad |  |
| `ifconfig` (net-tools) är inte installerat från början i moderna distributioner |  | ogranskad |  |
| `127.0.0.1` = localhost = den här datorn; trafiken lämnar aldrig datorn |  | ogranskad |  |
| `/24` = de första 24 bitarna är nätets adress; annat skickas till gatewayen |  | ogranskad |  |
| `ip route`: `default via 192.168.1.1`; `proto dhcp` = inställningar via DHCP |  | ogranskad |  |
| Kontrollfråga: `ip route \| grep default \| cut -d' ' -f3` ger 192.168.1.1 |  | ogranskad |  |
| `ping -c`; utan `-c` tills Ctrl+C; `time=`, packet loss, `Destination Host Unreachable` |  | ogranskad |  |
| Många servrar och brandväggar svarar inte på ping med flit |  | ogranskad |  |
| DNS översätter namn till adresser; DNS-servern står i `/etc/resolv.conf` |  | ogranskad |  |
| I Ubuntu står `127.0.0.53` = systemd-resolved som frågar routern; vissa andra distributioner listar routern direkt |  | ogranskad |  |
| `dig`, `host`, `nslookup` är inte installerade från början; i Ubuntu kommer de i paketet `dnsutils` |  | ogranskad |  |
| `dig` visar hela svaret (`ANSWER SECTION`), `+short` bara adressen, `@` väljer DNS-server |  | ogranskad |  |
| `nslookup` finns även i Windows och macOS; `host` kan göra omvända uppslag |  | ogranskad |  |
| Datorn tittar i `/etc/hosts` före DNS; ordningen styrs av `hosts:` i `/etc/nsswitch.conf` |  | ogranskad |  |
| `sudo echo … >> /etc/hosts` misslyckas eftersom skalet öppnar filen; `tee -a` med sudo fungerar |  | ogranskad |  |
| `dig` ignorerar `/etc/hosts`; `getent hosts` visar vad systemet slår upp |  | ogranskad |  |
| Port 1–65535; portarna 22, 53, 80, 443, 8080 |  | ogranskad |  |
| Bara root får öppna portar under 1024 |  | ogranskad |  |
| `ss -tulpn` och flaggornas betydelse; `0.0.0.0:22` och `[::]:22`; processkolumnen tom för andras processer |  | ogranskad |  |
| `netstat -tulpn` (net-tools) gör samma sak |  | ogranskad |  |
| I Ubuntu är `curl` inte förinstallerat men `wget` är det |  | ogranskad |  |
| `curl -I` visar huvuden; statuskoderna 200, 301/302, 403, 404, 500 |  | ogranskad |  |
| `curl -L` följer omdirigeringar; `-s` stänger av förloppsmätaren |  | ogranskad |  |
| `curl -o FIL` och `-O` (namn från adressen) |  | ogranskad |  |
| `wget` sparar alltid till fil, visar förlopp och följer omdirigeringar; `wget -O` |  | ogranskad |  |
| SSH krypterar; servern kör `sshd` på port 22 |  | ogranskad |  |
| `ssh användare@värd kommando` kör kommandot på servern |  | ogranskad |  |
| Värdnyckeln sparas i `~/.ssh/known_hosts`; ändrad nyckel kan betyda att någon låtsas vara servern |  | ogranskad |  |
| `ssh-keygen` skapar `~/.ssh/id_ed25519`; `ssh-copy-id` lägger den publika nyckeln i `~/.ssh/authorized_keys` |  | ogranskad |  |
| Felsökningsstegen inifrån och ut (ip a, ip route, ping router, ping 1.1.1.1, ping namn) |  | ogranskad |  |
| Fungerar steg 4 men inte steg 5 är det nästan alltid DNS |  | ogranskad |  |
| `sudo ip link set enp0s3 down/up` |  | ogranskad |  |
| Paketnamn i Ubuntu: `iproute2`, `iputils-ping`, `dnsutils`, `traceroute`, `openssh-client`; andra familjer kallar vissa paket något annat |  | ogranskad |  |
| `traceroute` visar varje router paketen passerar |  | ogranskad |  |
