# Akari 评分核对

参考本机 League Akari 1.5.1 与上游 dev 分支的公开评分实现。以下文件按工具返回内容保存，作为独立的算法核对基准。

| 文件 | 上游 Git blob SHA |
|---|---|
| analysis/player/constants.ts | 5daf1b761cf419fab708781951e78b9372abc3f8 |
| analysis/player/scoring.ts | a4bdaa1ea4dd44ae473d6264e7b5464fbbaa09c2 |
| analysis/player/single/summary.ts | 02504eeee8683a0bfa0eb2ae480423c5122ffc9d |
| analysis/player/aggregate/akari.ts | 446a5edfff990610442929178c57acfd3f0d80c9 |

上游目录：https://github.com/LeagueAkari/LeagueAkari/tree/dev/src/shared/data-adapter/analysis/player

utils.ts 和 utils/math.ts 仅提供被核对函数使用的 noZero、avgOrZero。原始版权和 MIT 许可位于 assets/licenses/LeagueAkari-MIT.txt。
