const RANKED_CREST_TIERS = new Set([
  'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond',
  'master', 'grandmaster', 'challenger', 'unranked',
])

export function getRankedMiniCrest(tier: string): string | undefined {
  const name = tier.toLowerCase()
  return RANKED_CREST_TIERS.has(name) ? `/fe/lol-static-assets/images/ranked-mini-crests/${name}.svg` : undefined
}

export function getRankedEmblem(tier: string): string | undefined {
  const name = tier.toLowerCase()
  if (name === 'unranked') return getRankedMiniCrest(tier)
  return RANKED_CREST_TIERS.has(name) ? `/fe/lol-shared-components/${name}.png` : undefined
}
