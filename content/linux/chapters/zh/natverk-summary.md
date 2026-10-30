# 总结：网络

在这一部分中，你在终端里摸清了一个小型家庭网络：你自己的地址、通往互联网的出口、名字和 DNS、端口、Web，以及通过 SSH 访问其他计算机。

## 网络

网络上的每台计算机都有一个 **IP 地址**，以 `192.168.`、`10.` 或 `172.16.`–`172.31.` 开头的地址是**私有地址**。`ip a` 显示计算机的网络接口和地址——`lo` 是回环网卡，而 `127.0.0.1`（**localhost**）永远表示计算机自己。**子网掩码**（`/24`）说明哪些地址在局域网中；其他所有流量都通过默认路由发往**网关**，`ip route` 会显示它。`ping` 测试能否连通某台计算机。

**DNS** 把名字翻译成地址。在询问 DNS 之前，计算机会先查看 `/etc/hosts`；`getent hosts` 显示系统解析的结果，而 `dig` 直接询问 DNS。在 Ubuntu 上，`/etc/resolv.conf` 指向 `127.0.0.53`，也就是 systemd-resolved，而 `dig`、`host` 和 `nslookup` 包含在 `dnsutils` 软件包中。

**端口**指向计算机上的某个程序，`ss -tulpn` 显示哪些端口正在监听。`curl` 获取一个 URL 并把内容打印出来，`wget` 则下载到文件——在 Ubuntu 上，`wget` 是预装的，而 `curl` 要用 apt 安装。借助 **SSH**，你可以在另一台计算机上运行命令，并且传输是加密的；第一次连接时，你需要确认服务器的主机密钥，而有了密钥对，你就不再需要密码了。

当“上不了网”时，要由内向外排查：地址、路由、路由器、互联网上的某个地址，最后是名字。如果地址能通而名字不行，那就是 DNS 的问题。

## 命令

| 命令 | 作用 |
|---|---|
| `ip a`、`ip -br a`、`hostname -I` | 显示 IP 地址 |
| `ip route` | 显示路由表和网关 |
| `ping -c 3 HOST` | 测试能否连通某台计算机 |
| `sudo ip link set CARD down` / `up` | 关闭 / 打开网卡 |
| `cat /etc/resolv.conf` | 查询的是哪个 DNS 服务器 |
| `dig +short NAME`、`dig @SERVER NAME` | 在 DNS 中查询一个名字 |
| `host NAME`、`nslookup NAME` | 查询一个名字（用 `host` 也可以从地址查到名字） |
| `getent hosts NAME` | 像系统那样查询（包括 `/etc/hosts`） |
| `sudo tee -a /etc/hosts` | 以 root 身份把来自管道的内容追加到 `/etc/hosts` |
| `ss -tulpn` | 显示正在监听的端口 |
| `curl URL` | 获取并显示 |
| `curl -I URL`、`curl -L URL` | 只显示头部、跟随重定向 |
| `curl -o FILE URL`、`wget URL`、`wget -O FILE URL` | 下载到文件 |
| `ssh USER@HOST COMMAND` | 在另一台计算机上运行命令 |
| `ssh-keygen`、`ssh-copy-id USER@HOST` | 创建密钥对，并把公钥放到服务器上 |
