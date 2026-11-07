import { Modal } from './Modal'
import { getPerkInfo, getPerkStyleIcon, getPerkStyleName } from '@/lib/assets'
import { finite, numberText, riotName } from '@/lib/history-model'
import type { SgpParticipantLol, SgpPerkSelection } from '@/types/sgp'

function runeStats(selection: SgpPerkSelection): string[] {
  return getPerkInfo(selection.perk).stats.map((description) => description.replace(
    /@eogvar([123])(?:\*([\d.]+))?@/gi,
    (_, index: string, multiplier?: string) => {
      const raw = finite(selection[`var${index}` as 'var1' | 'var2' | 'var3'])
      return numberText(raw == null ? null : raw * Number(multiplier ?? 1))
    },
  ))
}

function RuneRow({ selection }: { selection: SgpPerkSelection }) {
  const info = getPerkInfo(selection.perk)
  return <article className="rh-rune-row">
    {info.iconPath && <img src={info.iconPath} alt="" />}
    <div><strong>{info.name}</strong><p className="rh-muted">{info.description}</p>
      <ul className="rh-rune-stats">{runeStats(selection).map((text, index) => <li key={index}>{text}</li>)}</ul>
    </div>
  </article>
}

export function HistoryRuneDetails({ open, player, onClose }: {
  open: boolean; player: SgpParticipantLol; onClose: () => void
}) {
  const styles = player.perks?.styles ?? []
  const shards = player.perks?.statPerks
  return <Modal open={open} onClose={onClose} width="min(720px, 94vw)" height="min(730px, 88vh)">
    <div className="rh-shell rh-rune-details" role="region" aria-label="本局符文详情">
      <header><h2>符文详情</h2><span className="rh-muted">{riotName(player)}</span></header>
      <main>
        {styles.map((style, index) => <section key={`${index}-${style.style}`}>
          <h3>{getPerkStyleIcon(style.style) && <img src={getPerkStyleIcon(style.style)} alt="" />}
            {index === 0 ? '主系' : '副系'} · {getPerkStyleName(style.style)}
          </h3>
          {(style.selections ?? []).filter((rune) => rune.perk > 0).map((rune, index) =>
            <RuneRow key={`${rune.perk}-${index}`} selection={rune} />)}
        </section>)}
        {shards && [shards.offense, shards.flex, shards.defense].some((id) => id > 0) && <section>
          <h3>属性符文</h3>
          {[shards.offense, shards.flex, shards.defense].filter((id) => id > 0).map((id, index) =>
            <RuneRow key={`${id}-${index}`} selection={{ perk: id }} />)}
        </section>}
      </main>
    </div>
  </Modal>
}
