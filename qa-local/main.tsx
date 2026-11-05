import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ToolsPage } from '@/components/pages/ToolsPage'
import { lcu, LcuEventUri } from '@/lib/lcu'
import { initAssets } from '@/lib/assets'
import { initFeatures } from '@/lib/features'
import { injector } from '@/lib/InjectorManager'
import type { GameflowPhase } from '@/types/lcu'
import { setupNativeHistoryFixture } from './native-history-fixture'

const events = new Map<string, (value: unknown) => void>()
const emit = (uri: string, data: unknown) => events.get(uri)?.({ uri, data, eventType: 'Update' })
Object.assign(window, { qaEmit: emit })
lcu.bindContext({ socket: { observe(uri: string, callback: (value: unknown) => void) { events.set(uri, callback) }, disconnect() {} } } as unknown as Parameters<typeof lcu.bindContext>[0])
await initAssets()
injector.start()
initFeatures()
Object.assign(window, { qaNativeHistory: await setupNativeHistoryFixture() })

function Preview() {
  const [phase, setPhase] = useState<GameflowPhase>('None')
  const move = (next: GameflowPhase) => { setPhase(next); emit(LcuEventUri.GAMEFLOW_PHASE_CHANGE, next) }
  return <><div className="qa-toolbar"><strong>离线界面验证 · 全部数据均为虚构</strong><button type="button" onClick={() => move('ChampSelect')}>模拟 BP</button><button type="button" onClick={() => move('InProgress')}>模拟进游戏</button><button type="button" onClick={() => move('Lobby')}>模拟回大厅</button></div>
    {phase === 'ChampSelect' && <><div className="party visible">{[0,1,2,3,4].map((index) => <div className="summoner-wrapper visible left" key={index}><div className="summoner-container"><div className="champion-icon-container" data-testid={`preview-avatar-${index}`}>{index + 1}</div><div className="player-details">{index + 1} 楼</div></div></div>)}</div><div className="bottom-right-buttons" /></>}
    {phase === 'InProgress' && <div className="game-in-progress-container">游戏仍在进行中</div>}
    <div className="qa-tools"><ToolsPage /></div>
  </>
}

createRoot(document.querySelector('#preview')!).render(<Preview />)
