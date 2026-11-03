# Networking

Almost everything a Linux computer does involves talking to other computers:
fetching updates, showing web pages, logging in to servers. When something
goes wrong, the terminal has the best tools for finding out why. In this
chapter you will learn to find your own address, test connections, look up
names, see which services are running, fetch things from the web and log in
to another computer with SSH.

The simulated computer sits in a small home network:

| Computer | Address | What |
|---|---|---|
| Your computer (`ubuntu`) | `192.168.1.42` | Where you are now |
| The router (gateway) | `192.168.1.1` | The connection out to the internet |
| The server | `192.168.1.10` | Another Linux computer you can log in to |

Behind the router there is an "internet" with, among others, `example.com`,
`linux.org` and `archlinux.org`.

## IP addresses

Every computer on a network has an **IP address**. An IPv4 address is four
numbers between 0 and 255, for example `192.168.1.42`. Addresses starting
with `192.168.`, `10.` or `172.16.`–`172.31.` are **private** – they are only
used inside local networks and are never seen out on the internet.

The command for showing the computer's addresses is `ip` (from the
*iproute2* package). `ip addr` can be shortened to `ip a`:

```sh
ip a
```

You see two **interfaces** (network cards):

- `lo` – *loopback*, a pretend card the computer uses to talk to itself.
- `enp0s3` – the real network card. Cards used to be called `eth0`, and
  wireless cards are often called something like `wlan0` or `wlp2s0`.

The line `inet 192.168.1.42/24` is your IPv4 address. `link/ether` is the
card's **MAC address**, which is built into the hardware, and `state UP`
means the card is running. For a shorter overview there is `-br` (*brief*),
and `hostname -I` shows only the addresses:

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
One line per interface: the name, the state (`UP`) and the addresses.
```

You will still see the older command `ifconfig` (from the *net-tools*
package) in many guides, but it is not installed by default in modern
distributions. `ip` does everything it did and more.

## localhost – the computer itself

The address `127.0.0.1` has the name **localhost** and always means "this
computer". Programs on the same computer often talk to each other through
localhost – for example a web server you are developing and the browser you
test it with. Traffic to localhost never leaves the computer.

## Netmask and gateway

The `/24` after the address is the **netmask**. It says that the first 24
bits (the first three numbers, `192.168.1`) are the network's address. All
computers whose address starts with `192.168.1.` are on the same local
network and can be reached directly. Everything else is sent to the
**gateway** – the router – which passes it on to the internet. You can see
this in the routing table:

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

The first line, **default**, is the default route: "everything not listed
elsewhere goes to 192.168.1.1". The second line says the whole
`192.168.1.0/24` network is reached directly through `enp0s3`. `proto dhcp`
means the computer got its settings automatically from the router via
**DHCP**.

```quiz
Your computer has the address `192.168.1.42/24`. Which addresses can it
reach directly, without going through the gateway?
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
With `/24` the first three numbers are the network's address. Everything
starting with `192.168.1.` is on the same local network – everything else
goes via the default route to the gateway.
```

```predict
$ ip route | grep default | awk '{print $3}'
192.168.1.1
---
The third word on the `default` line is the gateway's address.
```

## ping – can it be reached?

`ping` sends small test packets and measures how long the replies take. With
`-c` (*count*) you choose how many packets – otherwise ping keeps going until
you press **Ctrl+C**:

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` is the reply time. Inside the home network less than a
  millisecond, out to the internet often 10–50 ms.
- `0% packet loss` – no packets disappeared. Lost packets suggest a bad
  network (or a bad wifi connection).
- `Destination Host Unreachable` means that no computer on the local
  network has that address.

Also try pinging the computer itself and a computer out on the internet:

```sh
ping -c 2 localhost
ping -c 3 example.com
```

Note! Many servers and firewalls deliberately don't answer ping. So no reply
does not always mean the computer is down.

## Names and DNS

People remember names, computers use addresses. **DNS** (*Domain Name
System*) is the internet's phone book that translates `example.com` into an
IP address. Which DNS server the computer asks is written in
`/etc/resolv.conf`:

```sh
cat /etc/resolv.conf
```

On Ubuntu the important line is `nameserver 127.0.0.53` – that is
**systemd-resolved**, a local middleman on your own computer that in turn
asks the router. Some other distributions list the router, `192.168.1.1`,
directly.

To ask DNS yourself you use `dig`, `host` or `nslookup`. They are not
installed from the start. On Ubuntu they come in the package `dnsutils`
(other families call the package something else):

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` shows the whole answer from the DNS server. The important part is under
`ANSWER SECTION`. With `+short` you get only the address:

```sh
dig example.com
dig +short example.com
```

`host` and `nslookup` do the same with shorter output. `nslookup` also exists
on Windows and macOS. `host` can also do a **reverse lookup** – from address
to name:

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

You can ask a specific DNS server with `@`, for example Cloudflare's
`1.1.1.1` or Google's `8.8.8.8`:

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts – the computer's own name list

Before the computer asks DNS, it looks in the file `/etc/hosts`. Among other
things, it says that `localhost` is `127.0.0.1`:

```sh
cat /etc/hosts
```

The server in the home network has the address `192.168.1.10`, but the name
`server.lan` is not in any DNS:

```sh
ping -c 1 server.lan
```

The solution is to add a line to `/etc/hosts`. The file is owned by root, so
you need `sudo`. But watch out – this does **not** work:

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` only applies to `echo`. It is your own shell (running as you, not
root) that opens the file for `>>`. The trick is `tee -a`, which appends what
it gets from the pipe to the end of a file – and `tee` can be run with sudo:

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

Now the name works for every program on the computer. But `dig` asks DNS
directly and ignores `/etc/hosts`, so it still finds nothing. To see what
the *system* resolves, use `getent`:

```sh
dig +short server.lan
getent hosts server.lan
```

`dig` prints nothing, but `getent` answers with the address followed by the
name:

```text
192.168.1.10    server.lan
```

The order (first the file, then DNS) is set by the line `hosts: files dns`
in `/etc/nsswitch.conf`.

```quiz
Why does `sudo echo '192.168.1.10 server.lan' >> /etc/hosts` give
*Permission denied*?
- [ ] `echo` can't be run with sudo
- [x] Your own shell, not root, opens the file for `>>` – sudo only applies to `echo`
- [ ] `/etc/hosts` can't be changed, not even by root
- [ ] `>>` only works on files in your home directory
---
That's why you use `echo ... | sudo tee -a /etc/hosts`: then it is `tee`,
running as root, that opens the file.
```

## Ports and services

An IP address points out a computer. A **port** (a number between 1 and
65535) points out a program on that computer – like a street address and an
apartment number. A program waiting for connections is said to **listen** on
a port. Some well-known ones:

| Port | Service |
|---|---|
| 22 | SSH – log in to other computers |
| 53 | DNS |
| 80 | HTTP – web |
| 443 | HTTPS – encrypted web |
| 8080 | Often web servers during development |

Only root may open ports below 1024. `ss` (*socket statistics*) shows which
ports are listening:

```sh
ss -tulpn
```

The flags are usually remembered as a chant: **t**cp, **u**dp,
**l**istening, **p**rocess, **n**umeric. `0.0.0.0:22` means `sshd` listens on
port 22 on all of the computer's addresses, and `[::]:22` is the same for
IPv6. The *Process* column is empty for processes owned by other users – with
`sudo` you see them all:

```sh
sudo ss -tulpn
```

If the practice server `myserver` from the processes chapter is running,
you see it here on port 8080. The older command `netstat -tulpn` (from
*net-tools*) does the same thing.

## Fetching from the web: curl and wget

`curl` fetches whatever is at an address (a **URL**) and prints it in the
terminal. Try it with myserver on your own computer:

On Ubuntu `curl` is not preinstalled (but `wget` is):

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

Do you get `Couldn't connect to server`? Then nothing is listening on the
port – maybe you stopped myserver in the processes chapter. Start it again:

```sh
myserver
```

With `-I` curl shows only the response **headers**, where the first line is a
**status code**:

```sh
curl -I https://example.com
```

| Code | Means |
|---|---|
| 200 | OK |
| 301, 302 | The page has moved – see `Location:` |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Server error |

Many websites redirect from `http://` to `https://`. Then you only get a
short "301 Moved Permanently". With `-L` curl follows along:

```sh
curl -I http://linux.org
curl -L http://linux.org
```

Since curl writes to the terminal, it works great in a pipe. `-s` (*silent*)
turns off the progress meter:

```sh
curl -s https://example.com | grep title
```

To save to a file, use `-o FILE` (or `-O`, which takes the file name from
the address):

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` is made for downloading files. It always saves to a file, shows
progress and follows redirects on its own:

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

To choose the file name yourself, use capital `-O`: `wget -O file.html URL`.

## SSH – logging in to another computer

**SSH** (*Secure Shell*) is the usual way to control a Linux computer
remotely, and everything sent is encrypted. The server runs the service
`sshd` on port 22, and you connect with the client `ssh`:

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` means "the user {{user}} on the computer server.lan". The
command after the host (`hostname`) runs on the server and the answer is
shown here – it says `server`, not `ubuntu`.

The first time you connect to a computer, ssh asks whether you trust it:

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` (the whole word). The server's **host key** is then saved in
`~/.ssh/known_hosts`. If the key changes later, ssh warns loudly – it could
mean someone is pretending to be the server.

The command can be several commands inside quotes:

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

Without a command, ssh logs in and you get a shell on the other computer,
which you leave with `exit`. That is not supported in the simulator – there
you always write the command right after the host.

### Keys instead of passwords

Instead of a password you can log in with a **key pair**. The private key
stays with you, and the public one is put on the server:

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

Press Enter at the questions from `ssh-keygen` to use the default file
`~/.ssh/id_ed25519` without a passphrase. `ssh-copy-id` adds the public key
(`id_ed25519.pub`) to `~/.ssh/authorized_keys` on the server. After that ssh
no longer asks for a password. Never show the private key to anyone!

Copying files over SSH with `scp` and `rsync`, and giving servers short
names in `~/.ssh/config`, comes in the next chapter.

## When the network doesn't work

"The internet doesn't work" can have many causes. Go through the steps in
order, from the inside out – the first step that fails shows where the
problem is:

| Step | Command | If it fails |
|---|---|---|
| 1. Do I have an address? | `ip a` | The card is down (`state DOWN`) or got no address |
| 2. Is there a way out? | `ip route` | No `default` line – no gateway |
| 3. Can I reach the router? | `ping -c 3 192.168.1.1` | Problem in the local network (cable, wifi) |
| 4. Can I reach the internet? | `ping -c 3 1.1.1.1` | Problem at the router or the provider |
| 5. Does DNS work? | `ping -c 3 example.com` | Name lookups fail – check `/etc/resolv.conf` |

Step 4 pings an address directly, without any name. If step 4 works but not
step 5, it is almost always DNS that is broken – one of the most common
problems.

```quiz
`ping -c 3 1.1.1.1` works, but `ping -c 3 example.com` answers
*Name or service not known*. Where is the problem most likely?
- [ ] The network card is down
- [ ] There is no default route
- [x] DNS – name lookups don't work
- [ ] example.com doesn't answer ping
---
If you can reach an address on the internet, the card, the route and the
router work. What's left is translating the name – check
`/etc/resolv.conf`.
```

Try it yourself! Turn off the network card, go through the steps and then
turn it on again:

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## The packages

The network tools live in different packages. On Ubuntu they are called:

| Tool | Package on Ubuntu |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

As usual, other families call some of the packages something else – the part
on distributions and packages is about such differences.

`traceroute` shows every router the packets pass on the way. Install it and
try `traceroute example.com`!

## Summary

| Command | Does |
|---|---|
| `ip a` | Show IP addresses |
| `ip route` | Show the routing table and the gateway |
| `ping -c 3 HOST` | Test whether a computer can be reached |
| `dig +short NAME` | Look up a name in DNS |
| `getent hosts NAME` | Look up like the system does (with `/etc/hosts`) |
| `ss -tulpn` | Show listening ports |
| `curl URL` | Fetch and show |
| `curl -o FILE URL`, `wget URL` | Download to a file |
| `ssh USER@HOST COMMAND` | Run a command on another computer |
