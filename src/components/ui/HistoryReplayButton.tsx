import { useEffect, useRef, useState } from 'react'
import { deadline } from '@/lib/history-api'
import { lcu } from '@/lib/lcu'
import { prepareReplayMetadata, readReplayMetadata, requestReplay } from '@/lib/replay'
import type { SgpGameSummaryJsonLol } from '@/types/sgp'

export function HistoryReplayButton({ game }: { game: SgpGameSummaryJsonLol }) {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const probe = useRef<AbortController | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => {
    const target = button.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const controller = new AbortController()
    probe.current = controller
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      if (controller.signal.aborted || active.current) return
      void readReplayMetadata(game.gameId, controller.signal).then((metadata) => {
        if (!controller.signal.aborted && metadata?.state === 'watch') setReady(true)
      }).catch(() => {})
    })
    observer.observe(target)
    return () => { observer.disconnect(); controller.abort() }
  }, [game.gameId])

  if (!Number.isSafeInteger(game.gameId) || game.gameId <= 0) return null

  async function activate() {
    if (active.current) return
    probe.current?.abort()
    const controller = new AbortController()
    const signal = controller.signal
    active.current = controller
    setError('')
    setProgress('查询中…')
    try {
      const current = await deadline(() => lcu.getChatMe(), signal, 5000)
      if (!current?.platformId) throw new Error('暂时无法确认当前大区。')
      if (game.platformId && game.platformId.toUpperCase() !== current.platformId.toUpperCase()) {
        throw new Error('请登录这场对局所在大区后查看回放。')
      }
      const metadata = await prepareReplayMetadata(game, signal)
      if (metadata.state === 'watch') {
        if (ready) {
          setProgress('启动中…')
          const response = await requestReplay(game.gameId, 'watch', signal)
          if (!response.ok) throw new Error(`客户端无法播放回放（${response.status}）`)
        }
        setReady(true)
        return
      }

      setReady(false)
      setProgress('下载中…')
      if (metadata.state !== 'downloading') {
        const response = await requestReplay(game.gameId, 'download', signal)
        if (!response.ok) throw new Error(`客户端无法下载回放（${response.status}）`)
      }
      const until = Date.now() + 60_000
      while (!signal.aborted && Date.now() < until) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
        const current = await readReplayMetadata(game.gameId, signal)
        if (current?.state === 'watch') {
          setReady(true)
          return
        }
        const percent = current?.downloadProgress
        if (typeof percent === 'number' && percent > 0 && percent <= 100) setProgress(`下载 ${Math.round(percent)}%`)
      }
      throw new Error('等待下载超时，点击重试可继续查看下载进度。')
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : '回放暂不可用')
    } finally {
      active.current = null
      if (!signal.aborted) setProgress('')
    }
  }

  return <span className="rh-replay">
    <button ref={button} type="button" className="rh-replay-button" aria-description={error || undefined}
      disabled={!!progress} onClick={() => void activate()}>{progress || (error ? '重试回放' : ready ? '播放回放' : '下载回放')}</button>
    {error && <span className="rh-replay-error" role="status">{error}</span>}
  </span>
}
