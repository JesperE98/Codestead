# Exam: Networking

Show what you have learned about addresses, names, ports, the web and SSH.
The questions cover the whole part, and you need 80 % right to pass.

```quiz
Which of these addresses are **private** – only used inside local networks?
(Choose all that apply.)
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
A web server you are developing runs on your own computer. Where does the
traffic go when you test it at `http://localhost:8080`?
- [ ] Out to the router and back
- [x] Nowhere – traffic to localhost never leaves the computer
- [ ] To the DNS server, which sends it back
- [ ] To `192.168.1.1`
```

```try
ip route
---
The `default` line shows the gateway that everything else is sent to.
```

The line for `localhost` in `/etc/hosts` is what the system finds. What does
this print?

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

Which DNS server does Ubuntu ask, according to `/etc/resolv.conf`?

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` is systemd-resolved, a local middleman on your own computer that
in turn asks the router.
```

```quiz
You run `ping 192.168.1.1` without any options. When does it stop?
- [ ] After 3 packets
- [ ] After one packet
- [x] When you press Ctrl+C
- [ ] When the first reply arrives
---
With `-c` you choose how many packets to send.
```

The order in which the system looks up names is set in
`/etc/nsswitch.conf`. What does this print?

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
First the file (`/etc/hosts`), then DNS.
```

```quiz
You have added `server.lan` to `/etc/hosts`. `ping server.lan` works, but
`dig +short server.lan` prints nothing. Why?
- [ ] The line in `/etc/hosts` is wrong
- [x] `dig` asks DNS directly and ignores `/etc/hosts`
- [ ] `dig` needs `sudo`
- [ ] `ping` doesn't use names
---
To see what the *system* resolves, use `getent hosts server.lan`.
```

```quiz
`myserver` listens on port 8080 and runs as a normal user. What would be
different if it listened on port 80?
- [ ] Nothing
- [x] Only root may open ports below 1024
- [ ] Port 80 is only for SSH
- [ ] Port 80 can't be used on localhost
```

```quiz
`curl -I http://linux.org` answers `301 Moved Permanently`. How do you get
the actual page?
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org` – follow the redirect
- [ ] `curl -o http://linux.org`
- [ ] It can't be done – 301 means the page is gone
```

```quiz
You connect to `server.lan` with ssh, and ssh warns loudly that the
server's host key has changed. What could it mean?
- [ ] Your password has expired
- [x] Someone could be pretending to be the server
- [ ] The server has a new user
- [ ] Your key pair is broken
---
The host key was saved in `~/.ssh/known_hosts` the first time you
connected.
```

```quiz
You want to log in to the server with a key pair instead of a password.
Which key is put on the server?
- [x] The public key, `id_ed25519.pub`
- [ ] The private key, `id_ed25519`
- [ ] Both
- [ ] Neither – the server creates its own
---
`ssh-copy-id` adds the public key to `~/.ssh/authorized_keys` on the
server. Never show the private key to anyone!
```

```quiz
`ip a` shows an address, and you can ping other computers in
`192.168.1.0/24`, but nothing out on the internet. `ip route` has no
`default` line. What is wrong?
- [ ] DNS
- [x] There is no gateway – nothing knows where to send traffic outside the local network
- [ ] The network card is down
- [ ] `/etc/hosts` is missing
```
