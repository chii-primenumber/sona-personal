# 评分机制

主菜单左下角的「评分：Akari／Sona」按钮切换全局机制。新配置默认使用 Akari，选择保存在本机。已打开的个人页、队伍卡片及大厅评分立即重算；选人分析之后使用当前机制。评分切换不重新请求战绩，不自动发送消息。

## Akari

依据本机 League Akari 1.5.1 和上游公开评分源码适配，保留 0–17 原始范围，显示两位小数。Sona 保留原来的 3–16 分机制及一位小数。

Akari 的九个分项为 KDA、胜率、输出、承伤、治疗、补刀、金币、参团和视野。伤害、承伤、金币及视野按同队人数计算理应贡献比；治疗使用总治疗相对于本队平均承伤。KDA 以总击杀加总助攻除以总死亡后评分，胜率也在聚合后评分；其余项目先逐场评分，再取算术平均。没有加入 Sona 的时间权重、置信度或趋势修正。

过滤重开、取消、已知 PVE 及明确标记为非匹配的对局。旧记录未提供 gameType 时保留；核心计分数据缺失时不生成 Akari 分数。视野未返回时按 Akari 的零值规则处理。对外评分名称、精度和颜色使用所选机制。

## 来源与核对

- [评分常量与函数](https://github.com/LeagueAkari/LeagueAkari/tree/dev/src/shared/data-adapter/analysis/player)
- [聚合评分](https://github.com/LeagueAkari/LeagueAkari/blob/dev/src/shared/data-adapter/analysis/player/aggregate/akari.ts)
- [单场数据口径](https://github.com/LeagueAkari/LeagueAkari/blob/dev/src/shared/data-adapter/analysis/player/single/summary.ts)
- 独立核对源码及 Git blob SHA 保存在 qa-local/fixtures/akari。
- 原作者 Hanxven 的 MIT 许可随 assets/licenses/LeagueAkari-MIT.txt 分发。

同一玩家的最终数值还受已加载场次、模式及页面筛选影响；项目按当前页面实际样本计算。
