
## 下载与安装

- **首次使用选 `sona-v1.10.0-personal.25-one-click-windows.zip`**：已含官方 Pengu Loader v1.1.6、Sona、脚本、中文说明和许可证。
- **已有 Loader 可选 `sona-v1.10.0-personal.25.zip`**：仅 Sona 插件。
- `SHA256SUMS.txt` 提供两个 ZIP 的 SHA256。

一键安装：完整解压 → 退出英雄联盟客户端和 Loader 窗口 → 双击 **一键安装.cmd** → 允许管理员授权 → 安装完成后重新启动客户端，按 **F1** 打开。

脚本自动寻找客户端；多个结果时选序号，找不到时粘贴游戏或 LeagueClient 目录。自动备份旧安装、保留本机设置和自定义资源、安装并激活 Loader。缺少 C++ 运行库时才从微软官网下载校验后安装。适用于 64 位 Windows 10（1803 起）／11。

[详细安装、运行库、备份与回退说明](https://github.com/chii-primenumber/sona-personal/blob/v1.10.0-personal.25/installer/INSTALL.md) · [全部新增功能介绍](https://github.com/chii-primenumber/sona-personal/blob/v1.10.0-personal.25/README.md)

## 开源来源

本版基于 **WJZ-P 的 [Sona v1.10.0](https://github.com/WJZ-P/sona/tree/v1.10.0)**。个人版新增功能主要参考 **Hanxven 及贡献者的开源项目 [League Akari](https://github.com/LeagueAkari/LeagueAkari)**，包括个人战绩、队伍卡片、玩家搜索、数据展示与交互，并适配 Akari 评分。Sona 沿用 AGPL-3.0，Akari 评分与 Pengu Loader 保留对应 MIT 许可。

Loader 为 [官方 v1.1.6 便携版](https://github.com/PenguLoader/PenguLoader/releases/tag/v1.1.6) 原文件，固定 SHA256 并保留数字签名。安装包不包含本机的账号、config、datastore 或玩家资料。

生产构建、界面模拟回归、Windows PowerShell 5.1 隔离安装／失败恢复测试和包内文件校验通过。安装测试使用临时目录，系统激活调用采用模拟；本次未在当前正在使用的客户端上重装 Loader。
