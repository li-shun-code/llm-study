---
title: SSH：远程开发基础
source_url: https://missing.csail.mit.edu/2020/command-line/
author: Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: true
order: 4
group: Linux 与 Shell
---
程序员日常工作里用远程服务器已经越来越普遍：无论部署后端软件，还是需要更强算力的机器（训练/调用模型也常常如此），你都离不开安全外壳协议（SSH，Secure Shell）。和本课程涉及的大多数工具一样，SSH 的可配置性极强，非常值得系统学习。

## 连接远程服务器

用 `ssh` 登录服务器的命令形如：

```
ssh foo@bar.mit.edu
```

这里我们以用户 `foo` 的身份登录服务器 `bar.mit.edu`。服务器既可以用 URL（如 `bar.mit.edu`）指定，也可以用 IP（如 `foobar@192.168.1.42`）。后面会看到：修改 ssh 配置文件后，你只需 `ssh bar` 就能连上去。

## 直接执行命令

`ssh` 一个常被忽视的能力是**直接执行命令**。`ssh foobar@server ls` 会在 foobar 的家目录下执行 `ls`。它还能与管道配合：`ssh foobar@server ls | grep PATTERN` 是在**本地**对远程 `ls` 的输出做 grep，而 `ls | ssh foobar@server grep PATTERN` 则是把本地 `ls` 的输出送到**远程**执行 grep。

## SSH 密钥

基于密钥的认证利用公钥密码学向服务器证明"客户端持有对应的私钥"，而不必泄露私钥本身，从此无需每次输密码。不过要注意：私钥（常见路径 `~/.ssh/id_rsa`，更现代的是 `~/.ssh/id_ed25519`）实际上就等价于你的密码，请像保管密码一样保管它。

### 生成密钥对

用 [`ssh-keygen`](https://www.man7.org/linux/man-pages/man1/ssh-keygen.1.html) 生成密钥对：

```
ssh-keygen -a 100 -t ed25519 -f ~/.ssh/id_ed25519
```

请务必设置口令（passphrase），避免私钥一旦泄露就被人畅通无阻地访问你授权过的服务器。可以配合 [`ssh-agent`](https://www.man7.org/linux/man-pages/man1/ssh-agent.1.html) 或 [`gpg-agent`](https://linux.die.net/man/1/gpg-agent)，免去每次输入口令的麻烦。

如果你以前用 SSH 密钥配置过向 GitHub 推送，多半已经走过[官方文档](https://help.github.com/articles/connecting-to-github-with-ssh/)的流程、手里已有一对可用密钥。想验证密钥是否带口令并校验口令，可运行 `ssh-keygen -y -f /path/to/key`。

### 基于密钥的认证

`ssh` 会检查服务器上的 `.ssh/authorized_keys` 文件来决定放行哪些客户端。把公钥追加过去可以这样：

```
cat .ssh/id_ed25519.pub | ssh foobar@remote 'cat >> ~/.ssh/authorized_keys'
```

更简单的方案（在可用时）是 `ssh-copy-id`：

```
ssh-copy-id -i .ssh/id_ed25519 foobar@remote
```

## 通过 SSH 拷贝文件

经由 ssh 拷贝文件的方式很多：

- `ssh + tee`：最朴素的做法，利用 ssh 执行命令加 STDIN 输入：`cat localfile | ssh remote_server tee serverfile`。回忆一下，[`tee`](https://www.man7.org/linux/man-pages/man1/tee.1.html) 会把 STDIN 的内容写入文件。
- [`scp`](https://www.man7.org/linux/man-pages/man1/scp.1.html)：拷贝大量文件/目录时，secure copy 更方便，因为它能轻松递归整个路径。语法：`scp path/to/local_file remote_host:path/to/remote_file`。
- [`rsync`](https://www.man7.org/linux/man-pages/man1/rsync.1.html)：在 `scp` 基础上更进一步——检测本地与远程相同的文件、避免重复拷贝；对符号链接、权限提供更细粒度的控制；还有 `--partial`（从上次中断处续传）等实用特性。语法与 `scp` 相近。

> 译注：做 LLM 应用时经常要在本机与 GPU 服务器之间同步代码与数据，`rsync -avz` 是最常用的组合。

## 端口转发

很多软件会监听机器上的特定端口。服务跑在本地时，你访问 `localhost:PORT` 或 `127.0.0.1:PORT` 即可；但远程服务器的端口并不直接暴露在网络/公网中时怎么办？

这就是**端口转发**（port forwarding），分两类：本地端口转发（Local）与远程端口转发（Remote）（示意图见 [StackOverflow 上的这篇回答](https://unix.stackexchange.com/questions/115897/whats-ssh-port-forwarding-and-whats-the-difference-between-ssh-local-and-remot)）。

最常见的场景是**本地端口转发**：远程机器上的某服务监听某端口，你希望把本地的一个端口接到那个远程端口上。例如在远程服务器上运行 `jupyter notebook`，它监听 `8888` 端口；要把转发到本地 `9999` 端口，执行：

```
ssh -L 9999:localhost:8888 foobar@remote_server
```

然后在本地浏览器打开 `localhost:9999` 即可。

## SSH 配置

前面已经积累了不少命令行参数。一个诱人的做法是给它们做 Shell 别名：

```
alias my_server="ssh -i ~/.ssh/id_ed25519 --port 2222 -L 9999:localhost:8888 foobar@remote_server"
```

但有更好的方案——`~/.ssh/config`：

```
Host vm
    User foobar
    HostName 172.16.174.141
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    LocalForward 9999 localhost:8888

# 配置还支持通配符
Host *.mit.edu
    User foobaz
```

相对别名，`~/.ssh/config` 的另一个优势：`scp`、`rsync`、`mosh` 等其他程序也能读取它，并自动把配置转换成对应的参数。

注意 `~/.ssh/config` 也属于 dotfile，通常可以和其他 dotfiles 一起纳入版本管理。但要公开发布时请想清楚：你正在向互联网上的陌生人暴露服务器的地址、用户名、开放端口等信息——这可能为某些攻击提供便利，分享 SSH 配置务必谨慎。

服务器端配置通常在 `/etc/ssh/sshd_config` 中指定：可以禁用密码认证、修改 ssh 端口、开启 X11 转发等，还支持按用户分别设置。

> 译注：拿到一台新服务器后的常见加固顺序——先禁用密码登录（`PasswordAuthentication no`）与 root 直接登录（`PermitRootLogin no`），只保留密钥认证。

## 其他实用工具

连接远程服务器常见的痛点：本机关机、休眠或切换网络导致的断连；以及高延迟链路下 ssh 的卡顿体验。[Mosh](https://mosh.org/)（mobile shell）针对这些做了改进：支持漫游（换网络不断线）、间歇性连接，并提供智能本地回显。

有时把远程目录挂载到本地会更顺手：[sshfs](https://github.com/libfuse/sshfs) 可以把远程服务器上的目录挂载为本地文件夹，之后你可以继续用本地编辑器编辑远程文件。

## 练习

原讲义为本节配套的练习（建议在 Linux 虚拟机中完成；虚拟机的安装可参考[这个教程](https://hibbard.eu/install-ubuntu-virtual-box/)）：

1. 进入 `~/.ssh/` 检查是否已有密钥对；没有则用 `ssh-keygen -a 100 -t ed25519` 生成。建议设置口令并配合 `ssh-agent` 使用。
2. 编辑 `.ssh/config`，加入如下条目：

   ```
   Host vm
       User 你的用户名
       HostName 虚拟机的IP
       IdentityFile ~/.ssh/id_ed25519
       LocalForward 9999 localhost:8888
   ```

3. 用 `ssh-copy-id vm` 把你的 ssh 公钥拷到服务器。
4. 在虚拟机里执行 `python -m http.server 8888` 起一个网页服务器，然后在本地浏览器访问 `http://localhost:9999` 验证端口转发。
5. 编辑服务器配置 `sudo vim /etc/ssh/sshd_config`：把 `PasswordAuthentication` 设为 no 禁用密码认证，把 `PermitRootLogin` 设为 no 禁止 root 登录，然后 `sudo service sshd restart` 重启 ssh 服务，再次尝试登录。
6. （挑战）在虚拟机里安装 [mosh](https://mosh.org/) 并建立连接，然后断开服务器的网络适配器——mosh 能正确恢复吗？
7. （挑战）查一查 `ssh` 的 `-N` 与 `-f` 参数的作用，写出让端口转发在后台运行的命令。

---

> **来源**：本文翻译自 [Command-line Environment](https://missing.csail.mit.edu/2020/command-line/)（Remote Machines 一节），作者 Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT），许可 CC BY-SA 4.0。抓取于 2026-09-13。

---

> 编者按：原讲义还包含作业控制（Job Control）、终端复用器（tmux）、别名与 dotfiles 等内容，本篇聚焦其中与远程开发直接相关的 SSH 部分并全文译出；SSH 配置文件 `~/.ssh/config` 本身也是一种 dotfile，与原讲义其余部分相互呼应。
