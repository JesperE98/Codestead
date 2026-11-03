# 测验：网络

展示你在地址、名称、端口、Web 和 SSH 方面学到了什么。问题覆盖整个部分，
你需要答对 80% 才能通过。

```quiz
下面哪些地址是**私有**地址——只在本地网络内部使用？（选择所有符合的选项。）
- [x] `10.0.0.5`
- [x] `172.20.1.1`
- [x] `192.168.0.7`
- [ ] `8.8.8.8`
- [ ] `1.1.1.1`
```

```quiz
你正在开发的一个 Web 服务器运行在你自己的计算机上。当你在 `http://localhost:8080`
测试它时，流量会去哪里？
- [ ] 出去到路由器再回来
- [x] 哪里都不去——发往 localhost 的流量永远不会离开这台计算机
- [ ] 发到 DNS 服务器，再由它送回来
- [ ] 发到 `192.168.1.1`
```

```try
ip route
---
`default` 那一行显示的是网关，其他所有流量都发往那里。
```

系统找到的是 `/etc/hosts` 中 `localhost` 那一行。这条命令会输出什么？

```predict
$ getent hosts localhost
127.0.0.1 localhost
```

根据 `/etc/resolv.conf`，Ubuntu 会询问哪个 DNS 服务器？

```predict
$ grep nameserver /etc/resolv.conf
nameserver 127.0.0.53
---
`127.0.0.53` 是 systemd-resolved，它是你自己计算机上的一个本地中间人，会再去询问路由器。
```

```quiz
你不加任何选项运行 `ping 192.168.1.1`。它什么时候停止？
- [ ] 发送 3 个数据包之后
- [ ] 发送一个数据包之后
- [x] 当你按下 Ctrl+C 时
- [ ] 收到第一个回复时
---
用 `-c` 可以指定要发送多少个数据包。
```

系统查找名称的顺序由 `/etc/nsswitch.conf` 设置。这条命令会输出什么？

```predict
$ grep hosts: /etc/nsswitch.conf
hosts: files dns
---
先查文件（`/etc/hosts`），再查 DNS。
```

```quiz
你把 `server.lan` 添加到了 `/etc/hosts`。`ping server.lan` 可以用，但
`dig +short server.lan` 什么也不输出。为什么？
- [ ] `/etc/hosts` 中的那一行写错了
- [x] `dig` 直接询问 DNS，会忽略 `/etc/hosts`
- [ ] `dig` 需要 `sudo`
- [ ] `ping` 不使用名称
---
想看*系统*解析出什么，请用 `getent hosts server.lan`。
```

```quiz
`myserver` 监听 8080 端口，并以普通用户身份运行。如果它监听的是 80 端口，会有什么不同？
- [ ] 没有不同
- [x] 只有 root 才能打开 1024 以下的端口
- [ ] 80 端口只用于 SSH
- [ ] 80 端口不能在 localhost 上使用
```

```quiz
`curl -I http://linux.org` 回答 `301 Moved Permanently`。你怎样才能拿到真正的页面？
- [ ] `curl -s http://linux.org`
- [x] `curl -L http://linux.org`——跟随重定向
- [ ] `curl -o http://linux.org`
- [ ] 做不到——301 表示页面已经没了
```

```quiz
你用 ssh 连接 `server.lan`，ssh 大声警告说服务器的主机密钥已经改变。这可能意味着什么？
- [ ] 你的密码过期了
- [x] 有人可能在冒充这台服务器
- [ ] 服务器有了一个新用户
- [ ] 你的密钥对坏了
---
主机密钥是在你第一次连接时保存到 `~/.ssh/known_hosts` 中的。
```

```quiz
你想用密钥对而不是密码登录服务器。哪个密钥要放到服务器上？
- [x] 公钥 `id_ed25519.pub`
- [ ] 私钥 `id_ed25519`
- [ ] 两个都放
- [ ] 都不放——服务器会自己创建
---
`ssh-copy-id` 会把公钥添加到服务器上的 `~/.ssh/authorized_keys` 中。永远不要把私钥给任何人看！
```

```quiz
`ip a` 显示了一个地址，你可以 ping 通 `192.168.1.0/24` 中的其他计算机，
但互联网上的什么都 ping 不通。`ip route` 中没有 `default` 这一行。哪里出了问题？
- [ ] DNS
- [x] 没有网关——没人知道该把发往本地网络之外的流量送到哪里
- [ ] 网卡已关闭
- [ ] 缺少 `/etc/hosts`
```

```quiz
你希望 `/tmp/x` 中包含 `{{documents}}` 里的文件，而不是一个 `{{documents}}` 目录。哪条命令是正确的？
- [ ] `rsync -a {{documents}} /tmp/x`
- [x] `rsync -a {{documents}}/ /tmp/x`
- [ ] `scp {{documents}} /tmp/x`
---
源末尾的斜杠表示“目录里面的内容”。
```
