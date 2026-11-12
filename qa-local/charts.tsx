import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HistoryTrendPanel } from '@/components/ui/HistoryTrendPanel'
import { HistoryCompareModal } from '@/components/ui/HistoryCompareModal'
import { toHistoryMatches } from '@/lib/history-model'
import { calculatePlayerScore } from '@/lib/player-score'
import { makeGames } from './chart-fixtures'
import '@/styles/Theme.css'
import '@/styles/PersonalHistory.css'

document.documentElement.dataset.sonaTheme = 'client'

const games = makeGames(40)
const matches = toHistoryMatches(games, 'me')
const system = 'akari' as const
const score = calculatePlayerScore(games, 'me', system)

function Preview() {
  const [compareOpen, setCompareOpen] = useState(false)
  useEffect(() => {
    Object.assign(window, {
      qaOpenCompare: () => setCompareOpen(true),
      qaCloseCompare: () => setCompareOpen(false),
      qaTheme: (theme: string) => { document.documentElement.dataset.sonaTheme = theme },
    })
  }, [])
  return <div className="rh-shell">
    <HistoryTrendPanel matches={matches} games={games} puuid="me" system={system} score={score} />
    <HistoryCompareModal
      open={compareOpen}
      onClose={() => setCompareOpen(false)}
      games={games}
      puuid="me"
      system={system}
      candidates={[{ puuid: 'ally', name: '队友 ally' }, { puuid: 'red3', name: '对手 red3' }]}
    />
  </div>
}

createRoot(document.querySelector('#panel')!).render(<Preview />)
