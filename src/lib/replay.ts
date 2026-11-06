import { deadline } from '@/lib/history-api'
import type { SgpGameSummaryJsonLol } from '@/types/sgp'

export interface ReplayMetadata {
  state: string
  downloadProgress?: number
}

export async function readReplayMetadata(gameId: number, parent?: AbortSignal): Promise<ReplayMetadata | null> {
  return deadline(async (signal) => {
    const response = await fetch(`/lol-replays/v1/metadata/${gameId}`, { signal })
    if (response.status === 404 || response.status === 204) return null
    if (!response.ok) throw new Error(`读取回放状态失败（${response.status}）`)
    return response.json() as Promise<ReplayMetadata>
  }, parent, 7000)
}

export async function prepareReplayMetadata(game: SgpGameSummaryJsonLol, signal: AbortSignal) {
  const current = await readReplayMetadata(game.gameId, signal)
  if (current) return current
  if (!game.gameVersion || !game.gameType) throw new Error('客户端没有这场回放的记录。')
  const path = `/lol-replays/v1/metadata/${game.gameId}/create/gameVersion/${encodeURIComponent(game.gameVersion)}/gameType/${encodeURIComponent(game.gameType)}/queueId/${game.queueId}`
  const response = await deadline((requestSignal) => fetch(path, { method: 'POST', signal: requestSignal }), signal, 7000)
  if (!response.ok && response.status !== 409) throw new Error(`客户端无法准备回放（${response.status}）`)
  const metadata = await readReplayMetadata(game.gameId, signal)
  if (!metadata) throw new Error('客户端没有这场回放的记录。')
  return metadata
}

export async function requestReplay(gameId: number, action: 'download' | 'watch', parent?: AbortSignal) {
  return deadline((signal) => fetch(`/lol-replays/v1/rofls/${gameId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ componentType: 'replay', contextData: 'match-history' }),
    signal,
  }), parent, 10000)
}
