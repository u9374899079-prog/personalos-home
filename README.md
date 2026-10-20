# PersonalOS v4 Native-first 候选版（隔离验证）

**本文件包没有获准安装到正式库，不是 BRAT 正式 Release。** 生产版仍为 v3.2.2。

## 开发原则
- 官方 Obsidian TypeScript / esbuild 模板、一个插件、少量模块、Markdown 原生保存。
- 使用 Obsidian 原生编辑器、标签页、返回和宿主状态栏。不重造固定顶部或底部导航。
- 新增文件不覆盖旧内容；草稿按设备本地状态保存；无自动删除、自动迁移、外部遥测。

## 运行测试（只用于独立开发环境）
- `npm install`（初次安装开发依赖；正式发布须生成并提交 package-lock.json，改为 `npm ci`）。
- `npm run check`：数据层单测 + 使用官方 obsidian 类型的类型检查 + esbuild 构建。
- 生成的 `main.js` 与 `manifest.json`、`styles.css` 只可进入**隔离的 Obsidian 测试库**；不得装入正式个人库。
- 本地 qa/bundle-for-local-qa.mjs 使用 `new Function` 是模拟测试的简化装载器，**不是生产构建**，请勿分发其生成的 main.js。
- `qa/test_browser.py` 用模拟宿主 Chromium 检查列表、记录、草稿与日记，并不代表真实 iOS 测试。

## 已知缺口
- 未使用官方 Obsidian 类型包完成 npm 构建（当前环境无 npm 网络）。
- 本候选版未在真正 Obsidian 1.14.4 宿主运行；前一版 v3.2.2 的宿主结果不能算此版本通过。
- Dropbox 真同步、冲突和 iPhone 真机输入仍待隔离环境验收。
- 发布前必须提供同步之外的备份、恢复实测证据。

## 目录
- src/contract.ts：数据分类与文件命名纯函数
- src/store.ts：Obsidian Vault API 文件操作与查找
- src/view.ts：唯一记录视图、快速输入、筛选、系统编辑器入口
- src/main.ts：插件生命周期、命令、设备本地草稿
- docs/架构与模块扩展规范.md：长期规则、模块合同和发布门槛
- qa-vault/：虚构测试数据，无实际个人信息与授权

## 跟踪
[GitHub 发布审核门槛](https://github.com/u9374899079-prog/personalos-home/issues/1)
