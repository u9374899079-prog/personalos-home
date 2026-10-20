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

## v3.2 起的质量控制

- 快速记录采用插件内部编辑页，保留取消/返回/保存入口，不再出现无法退出的全局输入弹窗。
- 每次发布前 GitHub Actions 自动检查 Chromium 手机/桌面布局、入口切换、未保存内容保护、保存后返回首页及 Markdown 创建；保留检查截图。
- 插件在启动后自动写出 `90 系统/界面诊断-移动端.md` 或 `90 系统/界面诊断-桌面端.md`，只记录屏幕尺寸、界面位置、版本号。**不包含笔记正文、文件清单、同步密钥**。文件只保存在个人 Vault 内，用户启用同步后才会进入私人 Dropbox；不上传到公共 GitHub。
- Obsidian iOS 的系统状态栏与原生工具栏并非插件本身；真实 iPhone 的几何诊断应与模拟截图结合验证。浏览器模拟不能冒充真机验收。

## 一次性清理旧库

已授权丢弃旧版演示资料时，使用 Obsidian 命令面板中的 `PersonalOS Home: 一次性清理旧版文件与文件夹（保留插件与同步设置）`。确认后将当前库可见文件移入 Obsidian 回收站，并清除空目录；保留 `.obsidian`、BRAT、Remotely Save 和自动布局诊断。

**务必先暂停旧版 Remotely Save 同步**，在 iPhone 与 Windows 上清理各自的本地旧数据，再统一设置新的远程基础目录 `PersonalOS-v3`。否则旧版远程内容仍可能重新下载。此命令不执行后台自动删除，也不会直接改动 Dropbox 授权参数。 


## v3.3 — 成熟社区插件的可选集成

首页「成熟模块」直接调用已启用插件的实际命令（不是网址跳转，也不复制其 UI）：

| 模块 | 插件 ID | 指令 | 版本门槛 |
|---|---|---|---|
| 笔记导航 | `notebook-navigator` | `notebook-navigator:open` | Obsidian ≥1.13.0 |
| 智能收集 | `quickadd` | `quickadd:runQuickAdd` | Obsidian ≥1.13.0 |
| 全文搜索 | `omnisearch` | `omnisearch:show-modal` | Obsidian ≥1.13.3 |
| 任务日程 | `tasknotes` | `tasknotes:open-tasks-view` | Obsidian ≥1.12.2 |

候选插件须用户自行从 Obsidian「设置 → 社区插件 → 浏览」安装并启用；本插件不会执行安装或静默写入插件配置。QuickAdd、Notebook Navigator 和 Omnisearch 未启用时分别回退到 PersonalOS 原生速记、笔记资料页及搜索页；TaskNotes 未启用时提示安装。现有 Markdown 路径与格式不变。

**兼容性说明：** 第三方命令注册表属于 Obsidian 内部实现，虽然已比对上述开源插件的真实命令声明，Obsidian 或插件未来版本仍可能更改。上线前运行 `qa/integrations.mjs` 和 `qa/layout.mjs`，并在隔离 Obsidian Vault 中实际点按四个入口，分别确认可用与后备行为。隔离测试不等于 iPhone 真机通过。

对应插件源码：
- https://github.com/johansan/notebook-navigator
- https://github.com/chhoumann/quickadd
- https://github.com/scambier/obsidian-omnisearch
- https://github.com/callumalpass/tasknotes
