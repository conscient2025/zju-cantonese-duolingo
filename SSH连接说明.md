# 为 admin 配置 SSH 密钥

目标：从这台 Windows 电脑，通过 SSH 连接 `admin@118.178.91.193`。下面是需要由你执行的准备步骤，尚未创建密钥或修改服务器。

截图中的阿里云控制台密钥绑定默认关联 `root`，不直接配置给 `admin`；控制台绑定还涉及重启生效。要使用指定的 admin 账号，可在本机生成密钥，通过现有 Workbench 会话把公钥添加到 admin 的 `authorized_keys`。[阿里云密钥对说明](https://help.aliyun.com/zh/simple-application-server/user-guide/manage-key-pairs-linux)

## 1. 在 Windows PowerShell 生成密钥

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\yue-server" -C 'yue-server'
Get-Content "$env:USERPROFILE\.ssh\yue-server.pub"
```

如果同名文件已存在，不要覆盖；使用已有合适密钥，或改一个新的文件名。生成时如设置密钥口令，由你自行保管和输入。

生成的 `yue-server` 是私钥，保留在本机 `.ssh` 目录；`yue-server.pub` 是可复制到服务器的公钥。终端输出的公钥应是一整行，以 `ssh-ed25519` 开头。[Windows OpenSSH 密钥说明](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement)

## 2. 在阿里云 Workbench 为 admin 添加公钥

使用现有的阿里云远程连接进入服务器终端，先运行：

```bash
whoami
```

应显示 `admin`。如果显示 `root`，先执行 `sudo -iu admin` 切换，再核对身份。以下命令要在 admin 身份下运行：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

把第1步输出的完整公钥追加到文件末尾，独占一行，保留已有公钥。按 `Ctrl+O`、回车保存，再按 `Ctrl+X` 退出。随后运行：

```bash
chmod 600 ~/.ssh/authorized_keys
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

最后一条显示服务器的主机密钥指纹，留作首次连接时核对。通常无需重启服务器或SSH服务；如果服务器定制过SSH配置，应核对是否启用公钥认证及其 `AuthorizedKeysFile` 路径。

## 3. 从 Windows 试连

确认阿里云防火墙及服务器防火墙允许这台电脑的公网IP访问SSH端口，默认是22。随后在 Windows PowerShell 执行：

```powershell
ssh -i "$env:USERPROFILE\.ssh\yue-server" admin@118.178.91.193
```

如果不是22端口，在命令中加 `-p 实际端口`。首次连接会提示服务器指纹，与Workbench中看到的相同算法指纹一致后再接受。不要忽略指纹不匹配的报错。

登录后运行 `whoami`，应显示 `admin`，然后执行 `exit` 退出。

## 4. 让助手使用本机密钥连接

告诉助手以下信息即可：

- 连接地址：`admin@118.178.91.193`。
- SSH端口：22，或实际使用的端口。
- 私钥的本机完整路径，例如 `C:\Users\33941\.ssh\yue-server`。
- 是否已经试连成功，以及希望执行的操作，例如“连接并检查现有Nginx配置”。

无需在聊天中粘贴私钥、密钥口令或服务器密码，也不要将私钥放进项目或GitHub。助手可以让本机SSH客户端使用指定文件完成认证。

若密钥有口令，可由你先在本机SSH agent中解锁；Windows的 `ssh-agent` 服务需要处于运行状态，然后使用 `ssh-add` 添加私钥。不要为此把口令发到聊天中。若部署需要sudo密码，也由你在本机交互终端输入。

完成连接准备不等于已执行部署。实际部署步骤见 [部署说明](部署说明.md)。
