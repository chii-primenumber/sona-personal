export const GAME_DETAILS_SELECTOR = '[data-sona-team-history="game"], [data-sona-game-analysis]'

export function syncInGameDetailsLayout(container: Element | null) {
  if (!container) return
  const enabled = Boolean(container.querySelector(GAME_DETAILS_SELECTOR))
  if (container.hasAttribute('data-sona-game-details-layout') !== enabled) container.toggleAttribute('data-sona-game-details-layout',enabled)
}
