import { aramggApi } from '@/lib/aramgg-api'
import { normalizeDescription } from '@/lib/assets'
import { deadline } from '@/lib/history-api'

export type HistoryAugmentMode = 'mayhem' | 'arena'

export interface HistoryAugmentDetail {
  name: string
  description: string
  rarity: string
}

interface ArenaAugment {
  id: number
  name: string
  desc?: string
  tooltip?: string
  rarity: number
  dataValues?: Record<string, number[]>
}

const RARITIES = ['白银', '黄金', '棱彩']
const catalogs = new Map<HistoryAugmentMode, Promise<Map<number, HistoryAugmentDetail>>>()

export function historyAugmentRarity(rarity?: string) {
  switch (rarity?.toLowerCase()) {
    case 'ksilver': return '白银'
    case 'kgold': return '黄金'
    case 'kprismatic': return '棱彩'
    default: return ''
  }
}

function cleanDescription(description: unknown) {
  return typeof description === 'string' ? normalizeDescription(description.replace(/%i:[^%]+%/g, '')) : ''
}

function arenaDescription(augment: ArenaAugment) {
  const raw = augment.desc || augment.tooltip
  let variable = false
  const description = cleanDescription(raw?.replace(/@([\w]+)(?:\*([0-9.]+))?@/g, (_, key: string, multiplier?: string) => {
    const values = augment.dataValues?.[key]
    if (values?.length && Number.isFinite(values[0]) && values.every((value) => value === values[0])) {
      return String(Number((values[0] * Number(multiplier ?? 1)).toFixed(2)))
    }
    variable = true
    return '…'
  }).replace(/@[^@]+@/g, () => { variable = true; return '…' }))
  return variable && description ? `${description}\n\n部分数值以游戏内说明为准。` : description
}

async function loadCatalog(mode: HistoryAugmentMode): Promise<Map<number, HistoryAugmentDetail>> {
  if (mode === 'mayhem') {
    const augments = await aramggApi.getMayhemAugmentsZhCn({ timeoutMs: 7500 })
    return new Map(Object.values(augments).filter((row) => Number.isInteger(row?.id)).map((row) => [
      row.id, {
        name: row.displayName,
        rarity: RARITIES[row.rarity] || '',
        description: cleanDescription(row.description || row.tooltip),
      },
    ]))
  }
  const data = await deadline(async (signal) => {
    const response = await fetch('https://raw.communitydragon.org/latest/cdragon/arena/zh_cn.json', { signal })
    if (!response.ok) throw new Error('斗魂强化资料暂不可用')
    return response.json() as Promise<{ augments?: ArenaAugment[] }>
  }, undefined, 7500)
  if (!Array.isArray(data?.augments)) throw new Error('斗魂强化资料格式异常')
  return new Map(data.augments.filter((row) => Number.isInteger(row?.id)).map((row) => [
    row.id, { name: row.name, rarity: RARITIES[row.rarity] || '', description: arenaDescription(row) },
  ]))
}

export async function fetchHistoryAugmentDetail(id: number, mode: HistoryAugmentMode) {
  let catalog = catalogs.get(mode)
  if (!catalog) {
    catalog = loadCatalog(mode).catch((error) => {
      catalogs.delete(mode)
      throw error
    })
    catalogs.set(mode, catalog)
  }
  return (await catalog).get(id)
}
