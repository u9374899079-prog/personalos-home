# PersonalOS Home

iPhone 和 Windows Obsidian 通用的 PersonalOS 主页插件（插件 ID：`personalos-home`）。

本仓库公开的内容仅包括插件源码、样式和发布工作流。**不要将日记、笔记、Dropbox 授权信息或其他私人文件提交到这里。**

## 初次安装

1. 在 Obsidian 设置 → 第三方插件 → 社区插件中安装 **BRAT**。
2. BRAT → Add beta plugin → 输入 `u9374899079-prog/personalos-home`，选择最新版本，不要固定版本。
3. 安装完成后，在第三方插件列表中启用 PersonalOS Home，点击侧栏 PersonalOS 图标。
4. iPhone 与 Windows 分别执行一次；你的 Markdown 笔记由 Remotely Save + Dropbox 单独同步。

后续修订增加 `manifest.json` 的版本号，GitHub Actions 校验并发布同版本 Release（`main.js`、`manifest.json`、`styles.css`）。BRAT 负责在 Obsidian 启动/更新检查时下载新版，**不保证实时推送，更新过程中可能需要重新加载插件**。

## 数据与隐私

- 本插件通过 Obsidian Vault API 在当前笔记库读写 Markdown，不上传私人内容到 GitHub。
- 文档路径：`01 收集/记录/`、`10 日记/`、`20 笔记/`。
- GitHub 的程序更新与 Dropbox 的个人数据同步，是独立的两种机制。
- 第三方插件运行在 Obsidian 的权限范围内，安装前应检查代码；重要数据请另设备份。

参考：https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md
