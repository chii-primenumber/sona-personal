# Sona 一键安装说明

适用于 64 位 Windows 10（1803 或更新版本）和 Windows 11。安装包已包含 Sona 个人版和官方 Pengu Loader v1.1.6，无需另外下载 Loader。

## 第一次安装

1. 下载 Release 中名字带 **one-click-windows.zip** 的文件。
2. **把整个 ZIP 解压到一个普通文件夹**，例如桌面的 `Sona安装包`。不要在压缩软件内直接双击，也不要解压到英雄联盟、Riot Client 或现有 Loader 目录中。
3. 退出英雄联盟客户端和 Pengu Loader 管理窗口。脚本不会强制关闭客户端或对局。
4. 双击 **一键安装.cmd**，在 Windows 管理员授权提示中选择“是”。
5. 等待“安装完成”，重新启动英雄联盟客户端，按 **F1** 打开 Sona。

脚本会校验安装包，查找客户端，复用已有 Pengu Loader；未安装时放在 `C:\Program Files\Pengu Loader`。随后完整备份原 Loader、插件与设置，保留已有 `assets`、其他插件和本机配置，安装 Sona，并调用官方 Loader 的激活命令。成功后不需要再手动打开 Loader 激活开关。

自动查找会检查进程路径、既有 Loader 配置、Riot 安装记录、注册表安装信息、桌面／开始菜单快捷方式，以及各本地磁盘的常见 Riot、WeGame 和腾讯游戏目录。找到多个客户端时选择序号；一个都没有找到时，按提示粘贴目录。可以填：

```text
D:\WeGameApps\英雄联盟
D:\WeGameApps\英雄联盟\LeagueClient
C:\Riot Games\League of Legends
```

最终目录必须能找到 **LeagueClient.exe** 和 **LeagueClientUx.exe**；也可以粘贴其中一个 EXE 的路径。输入 `Q` 可以取消。

## 更新已有 Sona

同样退出客户端后运行“一键安装.cmd”。脚本会保留其他插件、原 Loader 的配置和 datastore、已有 Sona 的自定义 assets。备份放在插件目录之外；不会把旧版作为第二个启用的插件留在 plugins 中。较新的 Loader 保留原版本。

已配置绝对路径 plugins_dir 时，安装到该目录并单独备份外置插件；保留其他插件的停用状态，只启用 Sona。相对路径插件目录需要先改成绝对路径。

默认保留现有 Loader 的激活模式；新安装使用官方全局激活方式，并记录所选客户端目录。已有不属于当前 Loader 的激活项或冲突的 version.dll 时会停止并说明，不会覆盖它们。目录链接／联接点需要先处理后重试，以免误改其他位置。

## 运行库与网络

需要 .NET Framework 4.7.2 或更新版本，以上 Windows 版本通常已自带。若缺失，先通过 Windows 更新安装 .NET Framework 4.8 后重试。

脚本会检查 Microsoft Visual C++ x64 运行库。缺少所需版本时，从微软官方地址下载固定版本，校验 SHA256 和微软数字签名后自动安装；这一步需要联网。运行库齐全时，安装 Sona 和 Loader 不需要联网。使用战绩查询与推荐功能时仍需正常联网。

## 备份、失败与回退

- 日志：`C:\ProgramData\Sona\Logs`。
- 完整备份：`C:\ProgramData\Sona\Backups\日期_编号\PenguLoader`，并附 `backup.json` 记录安装位置和原激活项。
- 外置插件目录备份位于同一编号目录的 `ExternalPlugins`；内置的自定义插件目录仍包含在完整 Loader 备份中。
- 安装失败时，脚本会尝试恢复这次写入的文件和原激活项，保留日志与备份。系统运行库属于独立组件，安装后不会随失败回退卸载。
- 回退 Sona：退出客户端，用备份中的 `plugins\sona` 恢复到原 Loader 的 `plugins\sona`。先移走现有 sona，再复制备份，避免混用文件。不要把备份目录整个放入 plugins。
- 全新安装后若要移除 Loader，先以管理员身份运行安装目录里的 `Pengu Loader.exe`，关闭激活开关，再移除该独立目录。使用符号链接模式时尤其需要先停用。

## 手动安装与只读检测

已有 Loader 的用户也可只下载普通 `sona-v版本.zip`，将里面的 `sona` 放入 Loader 的 `plugins`；替换前备份旧版和自定义资源。

一键安装包内的 `PenguLoader` 目录也可复制到固定独立位置，运行其管理器并开启激活，再将 `sona` 放入旁边的 `plugins`。不要把 Loader 文件复制到游戏目录。

需要查看搜索结果而不安装时，在解压目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Sona.ps1 -Diagnose
```

需要直接指定客户端目录时：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-Sona.ps1 -LeaguePath "D:\WeGameApps\英雄联盟\LeagueClient"
```

## 来源

- Sona 原作者 WJZ-P：[原项目](https://github.com/WJZ-P/sona)，AGPL-3.0。
- 个人版主要参考 League Akari 的战绩、队伍信息和评分等功能：[LeagueAkari](https://github.com/LeagueAkari/LeagueAkari)，相关评分适配保留 MIT 许可。
- Pengu Loader 使用官方 v1.1.6 原版文件：[官方 Release](https://github.com/PenguLoader/PenguLoader/releases/tag/v1.1.6)，MIT 许可随包提供。
- [官方 Loader 安装文档](https://pengu.lol/guide/installation)；[微软运行库说明](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)。
