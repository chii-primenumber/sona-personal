/**
 * 玩家对比弹窗（DSH 优化版）
 *
 * 两名玩家都从同一批已加载对局取数，不额外请求；样本、模式、时间窗口天然一致。
 */
import { useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import type { PlayerScoreSystem } from '@/lib/player-score'
import { formatPlayerScore, playerScoreLabel } from '@/lib/player-score'
import { compareHighlight, comparePlayers, formatCompareDelta, formatCompareValue, type CompareRow } from '@/lib/chart-compare'
import type { SgpGameSummaryLol } from '@/types/sgp'
import '@/styles/HistoryCharts.css'

export interface CompareCandidate { puuid: string; name: string }

const RADAR = { width: 320, height: 300, cx: 160, cy: 152, radius: 102 }

function point(index: number, total: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total
  return { x: RADAR.cx + Math.cos(angle) * radius, y: RADAR.cy + Math.sin(angle) * radius }
}

function ring(total: number, radius: number) {
  return Array.from({ length: total }, (_, index) => point(index, total, radius))
    .map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`)
    .join(' ')
}

export function HistoryCompareModal({ open, onClose, games, puuid, system, candidates }: {
  open: boolean
  onClose: () => void
  games: SgpGameSummaryLol[]
  puuid: string
  system: PlayerScoreSystem
  candidates: CompareCandidate[]
}) {
  const [selected, setSelected] = useState('')
  const key = candidates.map((candidate) => candidate.puuid).join(',')
  useEffect(() => {
    if (!open) return
    setSelected((current) => (current && candidates.some((candidate) => candidate.puuid === current) ? current : candidates[0]?.puuid ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])

  const result = useMemo(() => {
    if (!open || !selected) return null
    return comparePlayers(games, puuid, selected, system)
  }, [open, games, puuid, selected, system])

  const axes = result ? result.a.axes : []
  const rows: CompareRow[] = result ? result.rows : []

  return <Modal open={open} onClose={onClose} width="min(1080px, 94vw)" height="min(700px, 88vh)">
    <div className="rh-shell rh-compare">
      <header className="rh-chart-head">
        <h3>玩家对比</h3>
        <span className="rh-dsh-badge">DSH 优化版</span>
        <span className="rh-chart-hint">同批对局 · Sona 八维雷达</span>
      </header>
      {!candidates.length ? <p className="rh-muted">当前对局里没有其他可对比的玩家。</p> : (
        <>
          <div className="rh-compare-pick">
            <label>对比对象
              <select aria-label="选择对比玩家" value={selected} onChange={(event) => setSelected(event.target.value)}>
                {candidates.map((candidate) => <option key={candidate.puuid} value={candidate.puuid}>{candidate.name}</option>)}
              </select>
            </label>
            {result && <span className="rh-muted">同场 {result.sharedGames} 局 · 各自有效样本 {result.a.validGames} / {result.b.validGames}</span>}
          </div>
          {result ? (
            <div className="rh-compare-body">
              <div className="rh-compare-radar">
                <svg viewBox={`0 0 ${RADAR.width} ${RADAR.height}`} role="img"
                  aria-label={`${result.aName} 与 ${result.bName} 的雷达对比`}>
                  {[1, 2, 3, 4].map((level) => <polygon key={level} points={ring(axes.length, (RADAR.radius * level) / 4)} className="rh-radar-ring" />)}
                  {axes.map((axis, index) => {
                    const end = point(index, axes.length, RADAR.radius)
                    return <line key={axis.key} x1={RADAR.cx} y1={RADAR.cy} x2={end.x} y2={end.y} className="rh-radar-spoke" />
                  })}
                  <polygon className="rh-radar-shape-b" points={result.b.axes
                    .map((axis, index) => point(index, axes.length, RADAR.radius * axis.value))
                    .map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(' ')} />
                  <polygon className="rh-radar-shape" points={result.a.axes
                    .map((axis, index) => point(index, axes.length, RADAR.radius * axis.value))
                    .map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(' ')} />
                  {axes.map((axis, index) => {
                    const label = point(index, axes.length, RADAR.radius + 18)
                    const anchor = Math.abs(label.x - RADAR.cx) < 10 ? 'middle' : label.x > RADAR.cx ? 'start' : 'end'
                    const dy = label.y < RADAR.cy - 20 ? -2 : label.y > RADAR.cy + 20 ? 9 : 3
                    return <text key={axis.key} x={label.x} y={label.y + dy} textAnchor={anchor} className="rh-radar-label">{axis.label}</text>
                  })}
                </svg>
                <div className="rh-compare-legend">
                  <span><i className="is-a" />{result.aName} · {playerScoreLabel(system)} {formatPlayerScore(result.aScore ?? NaN, system)}</span>
                  <span><i className="is-b" />{result.bName} · {playerScoreLabel(system)} {formatPlayerScore(result.bScore ?? NaN, system)}</span>
                </div>
              </div>
              <div className="rh-compare-table-wrap">
                <table className="rh-compare-table">
                  <thead><tr><th>指标</th><th>{result.aName}</th><th>{result.bName}</th><th>差值 A−B</th></tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const highlight = compareHighlight(row)
                      return <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className={highlight === 'a' ? 'is-higher' : ''}>{formatCompareValue(row.a, row.format, system)}</td>
                        <td className={highlight === 'b' ? 'is-higher' : ''}>{formatCompareValue(row.b, row.format, system)}</td>
                        <td className="rh-compare-delta">{formatCompareDelta(row, system)}</td>
                      </tr>
                    })}
                  </tbody>
                </table>
                <p className="rh-chart-note">
                  高亮为数值较高一方；承伤、治疗等指标高低不直接等于优劣。双方样本若明显不等（例如其中一方多为补位局），
                  对比只反映当前已加载范围，不做跨段位结论。
                </p>
              </div>
            </div>
          ) : <p className="rh-muted">该玩家在当前已加载对局中样本不足，无法生成对比。</p>}
        </>
      )}
    </div>
  </Modal>
}
