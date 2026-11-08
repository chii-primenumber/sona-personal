import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { OpggBuildRecommendationPanel, OPGG_TIER_OPTIONS } from './OpggBuildRecommendationPanel'
import { store } from '@/lib/store'
import { resolveMostCommonPosition } from '@/lib/features/opgg-build-recommendation'
import { mapOpggMatchups, opggApi, type OpggMatchup, type OpggPosition, type OpggTier } from '@/lib/opgg-api'

interface MatchupQuery {
  key: string
  items: OpggMatchup[]
  version?: string
  error: string
}

export function EnemyOpggMatchupModal({ championId, queueId, initialPosition, onClose }: {
  championId: number
  queueId: number
  initialPosition: OpggPosition
  onClose: () => void
}) {
  const [position, setPosition] = useState(initialPosition)
  const [tier, setTier] = useState<OpggTier>(()=>{
    const saved = store.get('enemyOpggMatchupTier')
    return OPGG_TIER_OPTIONS.some((option)=>option.value===saved) ? saved : 'emerald_plus'
  })
  const [query, setQuery] = useState<MatchupQuery | null>(null)
  const key = `${championId}:${position}:${tier}`
  const current = query?.key === key ? query : null

  useEffect(() => setPosition(initialPosition), [championId, initialPosition])
  useEffect(() => {
    if (position !== 'none') return
    let active = true
    void resolveMostCommonPosition(championId, tier, 'kr').then((popular) => {
      if (active && popular) setPosition((current) => current === 'none' ? popular : current)
    })
    return () => { active = false }
  }, [championId, tier, position])

  useEffect(() => {
    if (position === 'none') return
    const controller = new AbortController()
    setQuery(null)
    void opggApi.getChampion({
      id: championId,
      region: 'kr',
      mode: 'ranked',
      position,
      tier,
      signal: controller.signal,
    }).then((response) => {
      if (controller.signal.aborted) return
      const counters = response?.data && 'counters' in response.data ? response.data.counters : undefined
      setQuery({
        key,
        items: mapOpggMatchups(Array.isArray(counters) ? counters : []),
        version: response?.meta?.version,
        error: '',
      })
    }).catch(() => {
      if (!controller.signal.aborted) {
        setQuery({ key, items: [], error: '暂时无法获取韩服数据，请稍后重新打开面板。' })
      }
    })
    return () => controller.abort()
  }, [championId, position, tier, key])

  return (
    <Modal open onClose={onClose} width="min(990px, 94vw)" height="min(640px, 89vh)" closable={false}>
      <div className="sona-opgg-modal-content" data-testid="enemy-opgg-matchups">
        <OpggBuildRecommendationPanel
          context={{ championId, queueId, position, gameVersion: '', gameMode: 'CLASSIC' }}
          recommendation={null}
          koreanMatchups={{ items: current?.items ?? [], version: current?.version }}
          isLoading={position !== 'none' && !current}
          loadError={current?.error ?? ''}
          selectedTier={tier}
          onTierChange={(value)=>{setTier(value);store.set('enemyOpggMatchupTier',value)}}
          onPositionChange={setPosition}
          onClose={onClose}
        />
      </div>
    </Modal>
  )
}
