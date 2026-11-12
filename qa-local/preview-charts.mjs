/**
 * DSH 优化版图表预览：起一个 Vite dev server，用本机 Chrome 截图并做结构断言。
 * 用法：node qa-local/preview-charts.mjs
 */
import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const base = path.resolve(import.meta.dirname, '..')
const outDir = process.env.SONA_PREVIEW_OUT || path.join(base, 'qa-local', '_preview')
fs.mkdirSync(outDir, { recursive: true })

const server = await createServer({
  root: base,
  configFile: false,
  resolve: { alias: { '@': path.join(base, 'src') } },
  define: { __PLUGIN_VERSION__: JSON.stringify('preview') },
  server: { port: 4321, strictPort: true },
})
await server.listen()

const browser = await chromium.launch({
  executablePath: process.env.SONA_CHROME_PATH,
  headless: true,
  args: ['--disable-gpu'],
})
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 }, deviceScaleFactor: 1 })
const errors = []
const missing = []
page.on('pageerror', (error) => errors.push(String(error.message)))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => {
  if (response.status() === 404) missing.push(response.url())
})

await page.goto('http://localhost:4321/qa-local/charts.html')
await page.waitForSelector('[data-testid="history-charts"]', { timeout: 30000 })
await page.waitForTimeout(600)

const panel = await page.locator('[data-testid="history-charts"]')
const panelBox = await panel.boundingBox()
await panel.screenshot({ path: path.join(outDir, '01-trend-radar.png') })

const structure = await page.evaluate(() => ({
  svgCount: document.querySelectorAll('.rh-chart svg').length,
  radarPolygons: document.querySelectorAll('.rh-radar .rh-radar-shape').length,
  trendLines: document.querySelectorAll('.rh-chart-line, .rh-chart-avg').length,
  winLossDots: document.querySelectorAll('.rh-chart-win, .rh-chart-loss').length,
  chips: document.querySelectorAll('.rh-trend-chips button').length,
  kpis: document.querySelectorAll('.rh-chart-kpis > div').length,
}))

await page.evaluate(() => window.qaOpenCompare?.())
await page.waitForSelector('.rh-compare-table', { timeout: 15000 })
await page.waitForTimeout(400)
const modal = page.locator('.sona-modal, .rh-compare').first()
await modal.screenshot({ path: path.join(outDir, '02-compare.png') })
const compare = await page.evaluate(() => ({
  rows: document.querySelectorAll('.rh-compare-table tbody tr').length,
  polygons: document.querySelectorAll('.rh-radar-shape, .rh-radar-shape-b').length,
  deltaCells: document.querySelectorAll('.rh-compare-delta').length,
  title: document.querySelector('.rh-compare .rh-chart-head h3')?.textContent,
}))

await page.evaluate(() => window.qaCloseCompare?.())
await page.evaluate(() => window.qaTheme?.('slate'))
await page.waitForTimeout(300)
await panel.screenshot({ path: path.join(outDir, '03-trend-radar-slate.png') })

await browser.close()
await server.close()

const realErrors = errors.filter((message) => !message.includes('404'))
const realMissing = missing.filter((url) => !url.endsWith('/favicon.ico'))

console.log(JSON.stringify({ result: realErrors.length || realMissing.length ? 'failed' : 'passed', panelBox, structure, compare, errors: realErrors, missing: realMissing }, null, 2))
process.exit(realErrors.length || realMissing.length ? 1 : 0)
