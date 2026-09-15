# SSH连接

当前已验证可用的连接为 `admin@118.178.91.193`，端口22，复用本机 `Downloads/root.pem` 私钥。

在 Windows PowerShell 中执行：

```powershell
ssh -i "$env:USERPROFILE\Downloads\root.pem" admin@118.178.91.193
```

私钥只保存在本机；服务器的admin账号已经配置对应公钥。不要将私钥放进项目、上传GitHub或粘贴到聊天中。

当前账户已验证可以通过sudo检查及维护本项目需要的Nginx配置和网页目录。应用已部署，后续手动更新见 [部署与OTA说明](部署说明.md)。

## 更换本机密钥时

可以使用 `ssh-keygen` 生成新密钥，将新公钥追加到服务器admin用户的 `~/.ssh/authorized_keys`，保留已有公钥并确认新密钥可以连接后再处理旧密钥。私钥文件名与远程用户名没有绑定关系，名为 `root.pem` 的私钥也可以用于已配置其公钥的admin账号。

阿里云轻量服务器控制台绑定的密钥默认关联root账号；为admin配置公钥应在该用户自己的授权文件中进行。[阿里云密钥对说明](https://help.aliyun.com/zh/simple-application-server/user-guide/manage-key-pairs-linux)

更换电脑或出现新的主机指纹提示时，应先通过阿里云Workbench核对服务器主机指纹，再接受首次连接；不要忽略主机指纹发生变化的提示。

## 让助手连接

提供目标账号、地址、端口、私钥的本机路径及需要执行的操作即可。助手让本机SSH客户端使用该文件认证，不需要读取或展示私钥正文。密钥口令或sudo密码如需交互输入，由你在本机终端完成。
