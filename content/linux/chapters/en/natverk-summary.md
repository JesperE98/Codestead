# Summary: Networking

In this part you found your way around a small home network from the
terminal: your own address, the way out to the internet, names and DNS,
ports, the web and other computers over SSH.

## Networking

Every computer on a network has an **IP address**, and addresses starting
with `192.168.`, `10.` or `172.16.`–`172.31.` are **private**. `ip a` shows
the computer's interfaces and addresses – `lo` is the loopback card, and
`127.0.0.1` (**localhost**) always means the computer itself. The
**netmask** (`/24`) says which addresses are on the local network; everything
else goes via the default route to the **gateway**, which `ip route` shows.
`ping` tests whether a computer can be reached.

**DNS** translates names into addresses. Before asking DNS the computer looks
in `/etc/hosts`, and `getent hosts` shows what the system resolves, while
`dig` asks DNS directly. On Ubuntu `/etc/resolv.conf` points to
`127.0.0.53`, systemd-resolved, and `dig`, `host` and `nslookup` come in the
package `dnsutils`.

A **port** points out a program on a computer, and `ss -tulpn` shows which
ports are listening. `curl` fetches a URL and prints it, `wget` downloads to
a file – on Ubuntu `wget` is preinstalled and `curl` is installed with apt.
With **SSH** you run commands on another computer, encrypted; the first time,
you confirm the server's host key, and with a key pair you no longer need a
password.

When "the internet doesn't work", go from the inside out: address, route,
router, an address on the internet, and finally a name. If addresses work but
names don't, it is DNS.

## Commands

| Command | Does |
|---|---|
| `ip a`, `ip -br a`, `hostname -I` | Show IP addresses |
| `ip route` | Show the routing table and the gateway |
| `ping -c 3 HOST` | Test whether a computer can be reached |
| `sudo ip link set CARD down` / `up` | Turn a network card off / on |
| `cat /etc/resolv.conf` | Which DNS server is asked |
| `dig +short NAME`, `dig @SERVER NAME` | Look up a name in DNS |
| `host NAME`, `nslookup NAME` | Look up a name (also from address to name with `host`) |
| `getent hosts NAME` | Look up like the system does (with `/etc/hosts`) |
| `sudo tee -a /etc/hosts` | Append what comes from a pipe to `/etc/hosts`, as root |
| `ss -tulpn` | Show listening ports |
| `curl URL` | Fetch and show |
| `curl -I URL`, `curl -L URL` | Only the headers, follow redirects |
| `curl -o FILE URL`, `wget URL`, `wget -O FILE URL` | Download to a file |
| `ssh USER@HOST COMMAND` | Run a command on another computer |
| `ssh-keygen`, `ssh-copy-id USER@HOST` | Create a key pair and put the public key on the server |
