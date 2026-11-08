import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ToolsPage } from '@/components/pages/ToolsPage'
import { SettingsPage } from '@/components/pages/SettingsPage'
import { Sidebar } from '@/components/ui/Sidebar'
import { LcuEventUri } from '@/lib/lcu'
import { initAssets } from '@/lib/assets'
import { initFeatures } from '@/lib/features'
import { injector } from '@/lib/InjectorManager'
import { initSonaTheme } from '@/lib/theme'
import type { GameflowPhase } from '@/types/lcu'
import { setupNativeHistoryFixture } from './native-history-fixture'

const events = new Map<string, (value: unknown) => void>()
const emit = (uri: string, data: unknown) => events.get(uri)?.({ uri, data, eventType: 'Update' })
Object.assign(window, { qaEmit: emit })
const { mountHistory, mountSummoner } = await setupNativeHistoryFixture({
  observe(uri, callback) { events.set(uri, callback) },
  disconnect() {},
})
await initAssets()
initSonaTheme()
injector.start()
initFeatures()
Object.assign(window, { qaNativeHistory: mountHistory })

function EnemyRows() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rows = Array.from(host.current!.querySelectorAll<HTMLElement>('.summoner-object')).map((element, index) =>
      mountSummoner(element, {
        queueId: 440,
        isLeft: false,
        isChampSelectShown: true,
        'summoner.isOnPlayersTeam': false,
        'summoner.isDonePicking': index === 0,
        'summoner.championId': index === 0 ? 154 : 83,
        'summoner.assignedPosition': '',
      }))
    Object.assign(window, {
      qaEnemyQueue: (queueId: number, isCustomGame = false, pickMode = '') => rows.forEach((row) =>
        row.update({ queueId, isCustomGame, 'summoner.root.queue.pickMode': pickMode })),
    })
    return () => rows.forEach((row) => row.destroy())
  }, [])
  return <div className="party visible" ref={host}>
    {['locked', 'preview'].map((state) => (
      <div className="summoner-wrapper visible right" key={state}>
        <div className="summoner-object right">
          <div className="champion-icon-container" data-testid={`qa-enemy-${state}`}>
            <div className="portrait-icon fit-icon" style={{ width: 48, height: 48, backgroundImage: 'url(/fe/client/skin/opaque-portrait.webp)' }} />
          </div>
        </div>
      </div>
    ))}
  </div>
}

function Preview() {
  const [phase, setPhase] = useState<GameflowPhase>('None')
  const move = (next: GameflowPhase) => { setPhase(next); emit(LcuEventUri.GAMEFLOW_PHASE_CHANGE, next) }
  return <><div className="qa-toolbar"><strong>离线界面验证 · 全部数据均为虚构</strong><button type="button" onClick={() => move('ChampSelect')}>模拟 BP</button><button type="button" onClick={() => move('InProgress')}>模拟进游戏</button><button type="button" onClick={() => move('Lobby')}>模拟回大厅</button></div>
    <div id="qa-score-menu" style={{position:'absolute',right:22,top:90,width:180,height:430,display:'flex',pointerEvents:'none'}}>
      <Sidebar items={[{id:'home',label:'首页',icon:null},{id:'tools',label:'工具',icon:null},{id:'settings',label:'设置',icon:null}]} activeId="tools" onSelect={()=>{}} collapsed={false} onToggle={()=>{}} />
    </div>
    {phase === 'ChampSelect' && <><div className="party visible">{[0,1,2,3,4].map((index) => <div className="summoner-wrapper visible left" key={index}><div className="summoner-container"><div className="champion-icon-container" data-testid={`preview-avatar-${index}`}>{index + 1}</div><div className="player-details">{index + 1} 楼</div></div></div>)}</div><div className="bottom-right-buttons" /></>}
    {phase === 'ChampSelect' && <><EnemyRows />
      <div className="lock-in visible" style={{position:'relative',width:640,height:82,marginLeft:300}}>
        <button type="button" className="action-button-container" style={{display:'block',width:178,height:82,margin:'0 auto'}}>锁定</button>
      </div><button type="button" data-testid="qa-rune-editor">符文编辑</button>
    </>}
    {phase === 'InProgress' && <div className="qa-in-game-screen"><div className="game-in-progress-container">游戏仍在进行中……</div></div>}
    <div className="qa-tools"><ToolsPage /></div>
    <div className="qa-tools"><SettingsPage /></div>
  </>
}

createRoot(document.querySelector('#preview')!).render(<Preview />)
