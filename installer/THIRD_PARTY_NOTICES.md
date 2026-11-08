# 第三方项目与许可

| 项目 | 用途与来源 | 许可 |
|---|---|---|
| Sona，WJZ-P | 个人版的基础项目：[WJZ-P/sona v1.10.0](https://github.com/WJZ-P/sona/tree/v1.10.0) | AGPL-3.0，见 sona/LICENSE |
| League Akari，Hanxven 及贡献者 | 本个人版主要参考其个人战绩、队伍卡片、玩家搜索、数据展示和交互等功能，并适配 Akari 评分：[LeagueAkari/LeagueAkari](https://github.com/LeagueAkari/LeagueAkari) | 评分适配保留 MIT 许可，见 sona/assets/licenses/LeagueAkari-MIT.txt 与 AKARI评分说明.md |
| Pengu Loader | 官方 v1.1.6 便携版原始文件：[官方发布](https://github.com/PenguLoader/PenguLoader/releases/tag/v1.1.6)，源码提交 4d641f52bc5d70aac4c09dfa1fa7a043a9069aff | MIT，见 PenguLoader/LICENSE.txt |

Pengu Loader ZIP SHA256：`D9AAFFD776A1594E4FB5EF060814C40CAB0CB4DE07F1F0CE3246E9C12EDA8836`。内置文件未从本机已安装目录打包，未携带任何用户的 config、datastore、账号或自定义资源。

Microsoft Visual C++ 运行库不打包进 ZIP；仅在缺少所需版本时，从微软官方地址下载原始安装程序，按微软许可安装。固定下载地址、版本与 SHA256 见 vendor.json。

个人版源码、修改记录与本版本对应的标签见 [sona-personal](https://github.com/chii-primenumber/sona-personal)。
