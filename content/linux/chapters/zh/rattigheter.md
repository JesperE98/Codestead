# 用户、权限和 sudo

Linux 的设计允许多个用户共用同一台计算机。因此每个文件都有一个所有者，以及规定谁可以做什么的规则。

## 用户和组

你是以用户 `elev` 的身份登录的。每个用户都属于一个或多个**组**（group）：

```sh
id
```

最重要的用户是 **root**——也就是管理员，可以做任何事情。你很少会直接以 root 身份登录，而是使用 `sudo`（见下文）。

## 读懂权限

运行 `ls -l`，看看第一列：

```text
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
```

第一个字符表示类型：`-` 表示文件，`d` 表示目录。接下来是三组字符，每组三个，依次对应所有者（owner）、所属组（group）和其他人（others）：

```text
-     rw-     r--     r--
type  owner   group   others
```

| 字符 | 对文件而言 | 对目录而言 |
|---|---|---|
| `r`（读） | 读取内容 | 列出内容 |
| `w`（写） | 修改内容 | 在其中创建和删除文件 |
| `x`（执行） | 把文件作为程序运行 | 用 `cd` 进入该目录 |

再往后是所有者（`elev`）和所属组（`elev`）。

## 修改权限——`chmod`

权限可以用**数字**表示。每组对应一个数字，它是 r = 4、w = 2 和 x = 1 之和：

| 数字 | 权限 | 常用于 |
|---|---|---|
| `755` | `rwxr-xr-x` | 程序和目录 |
| `644` | `rw-r--r--` | 普通文件 |
| `600` | `rw-------` | 机密文件 |

```sh
chmod 644 anteckningar.txt
```

也可以用**符号**表示：`u`（所有者）、`g`（所属组）、`o`（其他人）、`a`（所有人），后面跟上 `+`、`-` 或 `=` 以及具体的权限：

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## 脚本

**脚本**（script）是包含命令的文本文件。第一行 `#!/bin/bash` 叫做 *shebang*，它告诉系统应该用哪个程序来运行这个文件：

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Today is:"; date' >> datum.sh
cat datum.sh
```

要把脚本作为程序运行，它必须是可执行的：

```sh
chmod +x datum.sh
./datum.sh
```

之所以需要 `./`，是因为你当前所在的目录不在 `PATH` 中。

## root 和 sudo

有些文件只有 root 才能读取，比如存放密码的 `/etc/shadow`。使用 `sudo`（*superuser do*，以超级用户身份执行），你可以以 root 身份运行单条命令：

```sh
sudo whoami
```

第一次使用时，`sudo` 会要求你输入**你自己的**密码。只有管理员组中的用户才能使用 sudo。在 {{distro}} 上，这个组叫做 **{{adminGroup}}**：

:::debian
在 Debian 家族中，这个组叫做 `sudo`。
:::

:::arch
在 Arch 家族中，这个组叫做 `wheel`——这是 Unix 中一个古老的称呼，指“说了算的人”（英语里的 *big wheel*，即大人物）。
:::

:::redhat
在 Red Hat 家族中，这个组叫做 `wheel`——这是 Unix 中一个古老的称呼，指“说了算的人”（英语里的 *big wheel*，即大人物）。
:::

如果你需要以 root 身份运行很多命令，可以用 `sudo -i` 启动一个 root shell。这时提示符会变成 `#`。用 `exit` 返回。

> **请记住！** 使用 sudo 时没有任何安全网。只运行你理解的命令。

### 一个常见的陷阱

```text
sudo echo "text" > /etc/file     # 这样行不通
```

为 `>` 打开文件的是*你自己的* shell，而不是 sudo。应该改用 `tee`，它会在 sudo 下运行：

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
