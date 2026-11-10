# 网络

Linux 计算机所做的几乎每件事都需要和其他计算机通信：获取更新、显示网页、登录服务器。出了问题时，终端里有最好用的工具来帮你找出原因。在本章中，你将学习如何查看自己的地址、测试连接、查询域名、查看正在运行哪些服务、从网上获取内容，以及用 SSH 登录到另一台计算机。

这台模拟计算机位于一个小型家庭网络中：

| 计算机 | 地址 | 说明 |
|---|---|---|
| 你的计算机（`ubuntu`） | `192.168.1.42` | 你现在所在的位置 |
| 路由器（网关） | `192.168.1.1` | 通往互联网的出口 |
| 服务器 | `192.168.1.10` | 另一台你可以登录的 Linux 计算机 |

在路由器后面有一个“互联网”，其中包括 `example.com`、`linux.org` 和 `archlinux.org` 等网站。

## IP 地址

网络上的每台计算机都有一个 **IP 地址**。IPv4 地址由四个 0 到 255 之间的数字组成，例如 `192.168.1.42`。以 `192.168.`、`10.` 或 `172.16.`–`172.31.` 开头的地址是**私有地址**——它们只在局域网内部使用，在互联网上永远不会出现。

显示计算机地址的命令是 `ip`（来自 *iproute2* 软件包）。`ip addr` 可以简写为 `ip a`：

```sh
ip a
```

你会看到两个**网络接口**（网卡）：

- `lo`——*loopback*（环回接口），一块计算机用来和自己通信的“虚拟”网卡。
- `enp0s3`——真正的网卡。以前网卡叫 `eth0`，而无线网卡通常叫 `wlan0` 或 `wlp2s0` 之类的名字。

`inet 192.168.1.42/24` 这一行就是你的 IPv4 地址。`link/ether` 是网卡的 **MAC 地址**，它固化在硬件中；`state UP` 表示网卡正在工作。想要更简短的概览，可以用 `-br`（*brief*，简要），而 `hostname -I` 只显示地址：

```sh
ip -br a
hostname -I
```

```try
ip -br a
---
每个网络接口一行：名字、状态（`UP`）以及地址。
```

在很多教程里你仍然会看到旧命令 `ifconfig`（来自 *net-tools* 软件包），但现代发行版默认不再安装它。`ip` 能做它能做的一切，而且更多。

## localhost——计算机自己

地址 `127.0.0.1` 的名字是 **localhost**，它永远表示“这台计算机”。同一台计算机上的程序经常通过 localhost 互相通信——例如你正在开发的 Web 服务器和你用来测试它的浏览器。发往 localhost 的流量永远不会离开这台计算机。

## 子网掩码和网关

地址后面的 `/24` 是**子网掩码**（netmask）。它表示前 24 位（也就是前三个数字 `192.168.1`）是网络地址。所有地址以 `192.168.1.` 开头的计算机都在同一个局域网中，可以直接访问。其他所有流量都会发送给**网关**（gateway）——也就是路由器——由它转发到互联网。你可以在路由表中看到这一点：

```sh
ip route
```

```text
default via 192.168.1.1 dev enp0s3 proto dhcp src 192.168.1.42 metric 100
192.168.1.0/24 dev enp0s3 proto kernel scope link src 192.168.1.42 metric 100
```

第一行 **default** 是默认路由：“所有没有在别处列出的目标都发往 192.168.1.1”。第二行说明整个 `192.168.1.0/24` 网络可以通过 `enp0s3` 直接访问。`proto dhcp` 表示计算机是通过 **DHCP** 从路由器自动获取这些设置的。

```quiz
你的计算机的地址是 `192.168.1.42/24`。它可以不经过网关、直接访问哪些地址？
- [x] `192.168.1.10`
- [x] `192.168.1.1`
- [ ] `192.168.2.10`
- [ ] `1.1.1.1`
---
使用 `/24` 时，前三个数字是网络地址。所有以 `192.168.1.` 开头的地址都在同一个局域网中——其他所有地址都要通过默认路由发往网关。
```

```predict
$ ip route | grep default | cut -d' ' -f3
192.168.1.1
---
`default` 那一行中的第三个单词就是网关的地址。
```

## ping——能连通吗？

`ping` 会发送小的测试数据包，并测量回复需要多长时间。用 `-c`（*count*，次数）可以指定发送多少个包——否则 ping 会一直发下去，直到你按 **Ctrl+C**：

```sh
ping -c 3 192.168.1.1
```

```text
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.756 ms
...
3 packets transmitted, 3 received, 0% packet loss, time 2004ms
```

- `time=` 是回复时间。在家庭网络内部不到一毫秒，到互联网上通常是 10–50 毫秒。
- `0% packet loss`——没有丢包。丢包说明网络质量不好（或者 Wi-Fi 信号差）。
- `Destination Host Unreachable` 表示局域网中没有任何计算机使用这个地址。

也试试 ping 计算机自己，以及互联网上的一台计算机：

```sh
ping -c 2 localhost
ping -c 3 example.com
```

注意！很多服务器和防火墙故意不响应 ping。所以没有回复并不总是意味着那台计算机宕机了。

## 域名和 DNS

人记得住名字，计算机用的是地址。**DNS**（*Domain Name System*，域名系统）就是互联网的电话簿，它把 `example.com` 翻译成 IP 地址。计算机向哪个 DNS 服务器查询，写在 `/etc/resolv.conf` 中：

```sh
cat /etc/resolv.conf
```

在 Ubuntu 上，重要的是 `nameserver 127.0.0.53` 这一行——那是 **systemd-resolved**，一个运行在你自己计算机上的本地“中间人”，它再去询问路由器。另外一些发行版直接列出路由器 `192.168.1.1`。

要自己查询 DNS，可以使用 `dig`、`host` 或 `nslookup`。它们并不是一开始就安装好的。在 Ubuntu 上，它们包含在 `dnsutils` 软件包中（其他家族给这个软件包起了别的名字）：

```sh
sudo apt update
sudo apt install dnsutils
```

`dig` 会显示 DNS 服务器返回的完整应答。重要的部分在 `ANSWER SECTION` 下面。加上 `+short` 就只显示地址：

```sh
dig example.com
dig +short example.com
```

`host` 和 `nslookup` 做的是同样的事，只是输出更简短。`nslookup` 在 Windows 和 macOS 上也有。`host` 还能做**反向查询**——从地址查到名字：

```sh
host example.com
nslookup archlinux.org
host 1.1.1.1
```

你可以用 `@` 向指定的 DNS 服务器查询，例如 Cloudflare 的 `1.1.1.1` 或 Google 的 `8.8.8.8`：

```sh
dig @8.8.8.8 +short debian.org
```

## /etc/hosts——计算机自己的名字列表

在询问 DNS 之前，计算机会先查看 `/etc/hosts` 文件。这个文件里写着 `localhost` 就是 `127.0.0.1` 等内容：

```sh
cat /etc/hosts
```

家庭网络中的服务器地址是 `192.168.1.10`，但名字 `server.lan` 并不在任何 DNS 中：

```sh
ping -c 1 server.lan
```

解决办法是在 `/etc/hosts` 中添加一行。这个文件属于 root，所以你需要 `sudo`。但要小心——下面这样做是**不行**的：

```text
sudo echo '192.168.1.10 server.lan' >> /etc/hosts
bash: /etc/hosts: Permission denied
```

`sudo` 只作用于 `echo`。为 `>>` 打开文件的是你自己的 shell（以你的身份运行，而不是 root）。窍门是用 `tee -a`，它会把从 pipe 收到的内容追加到文件末尾——而 `tee` 是可以用 sudo 运行的：

```sh
echo '192.168.1.10 server.lan' | sudo tee -a /etc/hosts
ping -c 3 server.lan
```

现在这个名字对计算机上的所有程序都生效了。但 `dig` 直接询问 DNS，会忽略 `/etc/hosts`，所以它仍然什么也找不到。要查看*系统*实际解析出的结果，可以用 `getent`：

```sh
dig +short server.lan
getent hosts server.lan
```

`dig` 什么也不打印，而 `getent` 会给出地址，后面跟着名字：

```text
192.168.1.10    server.lan
```

查找顺序（先查文件，再查 DNS）由 `/etc/nsswitch.conf` 中的 `hosts: files dns` 这一行决定。

```quiz
为什么 `sudo echo '192.168.1.10 server.lan' >> /etc/hosts` 会报 *Permission denied*？
- [ ] `echo` 不能用 sudo 运行
- [x] 为 `>>` 打开文件的是你自己的 shell，而不是 root——sudo 只作用于 `echo`
- [ ] `/etc/hosts` 无法修改，连 root 也不行
- [ ] `>>` 只能用于你主目录中的文件
---
所以要用 `echo ... | sudo tee -a /etc/hosts`：这样打开文件的就是以 root 身份运行的 `tee`。
```

## 端口和服务

IP 地址指向一台计算机。**端口**（port，1 到 65535 之间的一个数字）则指向这台计算机上的某个程序——就像街道地址和门牌号。一个等待连接的程序，我们说它在某个端口上**监听**（listen）。一些常见的端口：

| 端口 | 服务 |
|---|---|
| 22 | SSH——登录到其他计算机 |
| 53 | DNS |
| 80 | HTTP——网页 |
| 443 | HTTPS——加密的网页 |
| 8080 | 开发时常用的 Web 服务器端口 |

只有 root 才能打开 1024 以下的端口。`ss`（*socket statistics*，套接字统计）显示哪些端口正在监听：

```sh
ss -tulpn
```

这些选项通常像口诀一样记：**t**cp、**u**dp、**l**istening（监听中）、**p**rocess（进程）、**n**umeric（数字形式）。`0.0.0.0:22` 表示 `sshd` 在计算机所有地址的 22 端口上监听，`[::]:22` 则是 IPv6 的同样情况。对于属于其他用户的进程，*Process* 列是空的——加上 `sudo` 就能全部看到：

```sh
sudo ss -tulpn
```

如果进程那一章中的练习服务器 `myserver` 正在运行，你会在这里看到它监听在 8080 端口。旧命令 `netstat -tulpn`（来自 *net-tools*）的作用相同。

## 从网上获取内容：curl 和 wget

`curl` 会获取某个地址（**URL**）上的内容，并把它打印到终端上。用你自己计算机上的 myserver 试一试：

在 Ubuntu 上，`curl` 没有预装（但 `wget` 有）：

```sh
sudo apt install curl
```

```sh
curl http://localhost:8080
```

你得到的是 `Couldn't connect to server` 吗？那说明没有程序在这个端口上监听——也许你在进程那一章里把 myserver 停掉了。重新启动它：

```sh
myserver
```

加上 `-I`，curl 只显示响应的**头部**（headers），其中第一行是**状态码**：

```sh
curl -I https://example.com
```

| 状态码 | 含义 |
|---|---|
| 200 | OK（成功） |
| 301, 302 | 页面已移动——看 `Location:` |
| 403 | 禁止访问 |
| 404 | 未找到 |
| 500 | 服务器错误 |

很多网站会把 `http://` 重定向到 `https://`。这时你只会得到一个简短的“301 Moved Permanently”。加上 `-L`，curl 就会跟随重定向：

```sh
curl -I http://linux.org
curl -L http://linux.org
```

由于 curl 输出到终端，它非常适合放在 pipe 中使用。`-s`（*silent*，静默）会关闭进度条：

```sh
curl -s https://example.com | grep title
```

要保存到文件，使用 `-o FILE`（或者 `-O`，它会从地址中取文件名）：

```sh
cd ~
curl -o {{exampleHtml}} https://example.com
```

`wget` 是专门用来下载文件的。它总是保存到文件，会显示进度，并且会自动跟随重定向：

```sh
wget https://example.com/cheatsheet.txt
cat cheatsheet.txt
```

要自己指定文件名，使用大写的 `-O`：`wget -O file.html URL`。

## SSH——登录到另一台计算机

**SSH**（*Secure Shell*，安全外壳）是远程控制 Linux 计算机的常用方式，所有传输的内容都是加密的。服务器在 22 端口上运行 `sshd` 服务，你用客户端 `ssh` 连接它：

```sh
ssh {{user}}@server.lan hostname
```

`{{user}}@server.lan` 的意思是“计算机 server.lan 上的用户 {{user}}”。主机后面的命令（`hostname`）在服务器上运行，结果显示在这里——它显示的是 `server`，而不是 `ubuntu`。

第一次连接某台计算机时，ssh 会问你是否信任它：

```text
The authenticity of host 'server.lan (192.168.1.10)' can't be established.
ED25519 key fingerprint is SHA256:q7Jx3MmP0yZk8VbW1sTn4dLr9HcE2uFgA6oYiKjN5Rw.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

输入 `yes`（完整的单词）。服务器的**主机密钥**（host key）随后会保存到 `~/.ssh/known_hosts` 中。如果以后这个密钥变了，ssh 会发出醒目的警告——这可能意味着有人在冒充这台服务器。

命令也可以是放在引号里的多条命令：

```sh
ssh {{user}}@server.lan 'whoami; uptime; ls'
ssh {{user}}@server.lan cat {{welcomeFile}}
```

如果不带命令，ssh 会直接登录，你会得到另一台计算机上的 shell，用 `exit` 退出。模拟器不支持这种方式——在这里你总是要把命令直接写在主机后面。

### 用密钥代替密码

除了密码，你还可以用**密钥对**登录。私钥留在你这里，公钥则放到服务器上：

```sh
ssh-keygen
ssh-copy-id {{user}}@server.lan
```

在 `ssh-keygen` 提问时按 Enter，就会使用默认文件 `~/.ssh/id_ed25519`，并且不设密码短语（passphrase）。`ssh-copy-id` 会把公钥（`id_ed25519.pub`）添加到服务器上的 `~/.ssh/authorized_keys` 中。之后 ssh 就不再询问密码了。永远不要把私钥给任何人看！

用 `scp` 和 `rsync` 通过 SSH 复制文件，以及在 `~/.ssh/config` 中给服务器起简短的名字，将在下一章中介绍。

## 网络不通的时候

“上不了网”可能有很多原因。按顺序、由内向外逐步检查——第一个失败的步骤会告诉你问题出在哪里：

| 步骤 | 命令 | 如果失败 |
|---|---|---|
| 1. 我有地址吗？ | `ip a` | 网卡已关闭（`state DOWN`）或者没有获取到地址 |
| 2. 有出去的路吗？ | `ip route` | 没有 `default` 行——没有网关 |
| 3. 能连到路由器吗？ | `ping -c 3 192.168.1.1` | 局域网有问题（网线、Wi-Fi） |
| 4. 能连到互联网吗？ | `ping -c 3 1.1.1.1` | 路由器或网络运营商有问题 |
| 5. DNS 正常吗？ | `ping -c 3 example.com` | 域名查询失败——检查 `/etc/resolv.conf` |

第 4 步直接 ping 一个地址，不涉及任何名字。如果第 4 步成功而第 5 步失败，那几乎总是 DNS 出了问题——这是最常见的问题之一。

```quiz
`ping -c 3 1.1.1.1` 能成功，但 `ping -c 3 example.com` 回答 *Name or service not known*。问题最有可能出在哪里？
- [ ] 网卡关闭了
- [ ] 没有默认路由
- [x] DNS——域名查询不起作用
- [ ] example.com 不响应 ping
---
如果你能访问互联网上的某个地址，就说明网卡、路由和路由器都正常。剩下的就是名字的翻译——检查 `/etc/resolv.conf`。
```

自己试试吧！关掉网卡，逐步检查，然后再把它打开：

```sh
sudo ip link set enp0s3 down
ip a
ip route
ping -c 3 192.168.1.1
ping -c 3 example.com
sudo ip link set enp0s3 up
```

## 软件包

网络工具分布在不同的软件包中。在 Ubuntu 上，它们叫做：

| 工具 | Ubuntu 上的软件包 |
|---|---|
| `ip`, `ss` | `iproute2` |
| `ping` | `iputils-ping` |
| `dig`, `host`, `nslookup` | `dnsutils` |
| `traceroute` | `traceroute` |
| `ssh`, `ssh-keygen` | `openssh-client` |

和往常一样，其他家族给其中一些软件包起了别的名字——关于发行版和软件包的部分讲的就是这类差异。

`traceroute` 会显示数据包一路上经过的每一台路由器。安装它，然后试试 `traceroute example.com`！

## 小结

| 命令 | 作用 |
|---|---|
| `ip a` | 显示 IP 地址 |
| `ip route` | 显示路由表和网关 |
| `ping -c 3 HOST` | 测试某台计算机能否连通 |
| `dig +short NAME` | 在 DNS 中查询一个名字 |
| `getent hosts NAME` | 像系统那样查询（包括 `/etc/hosts`） |
| `ss -tulpn` | 显示正在监听的端口 |
| `curl URL` | 获取并显示内容 |
| `curl -o FILE URL`, `wget URL` | 下载到文件 |
| `ssh USER@HOST COMMAND` | 在另一台计算机上运行命令 |
