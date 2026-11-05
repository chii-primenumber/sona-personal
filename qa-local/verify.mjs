import { createServer } from 'vite'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require(String.raw`C:\Users\CarryJQKA\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright`)
const base = path.resolve(import.meta.dirname, '..')
const out = path.resolve(base, '..', 'sona-preview')
await fs.mkdir(out, { recursive: true })
const names = ['练习星轨', '薄荷汽水', '雨后回声', '微光纸船', '海盐风铃', '白昼拾荒', '云端烟火', '满月航线', '橘子信笺', '栖木午后']
const champions = [[16,'索拉卡'],[350,'悠米'],[117,'璐璐'],[37,'娑娜'],[267,'娜美'],[103,'阿狸'],[99,'拉克丝'],[22,'艾希'],[51,'凯特琳'],[64,'李青'],[157,'亚索'],[222,'金克丝']]
const positions = ['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY']
const ids = names.map((_, i) => `preview-player-${i}`)
const queues = [[440,'排位赛 灵活排位'],[420,'排位赛 单双排'],[450,'极地大乱斗'],[2400,'海克斯大乱斗'],[430,'匹配模式']].map(([id,name]) => ({ id,name,description:name, gameMode:id >= 450 ? 'ARAM' : 'CLASSIC', queueAvailability:'Available', isEnabled:true, category:'PvP', isRanked:id===440||id===420, mapId:id>=450?12:11 }))
const ranks = { queueMap: { RANKED_SOLO_5x5: {tier:'EMERALD',division:'I',leaguePoints:55,wins:10,losses:7}, RANKED_FLEX_SR: {tier:'DIAMOND',division:'II',leaguePoints:40,wins:126,losses:91} } }
const profile = (i) => ({ puuid: ids[i], gameName: names[i], tagLine:'DEMO', displayName:names[i], summonerId:i+100, profileIconId:i+1, summonerLevel:241-i*13, privacy:'PUBLIC' })
const makeGame = (n) => {
  const queueId = n === 0 ? 440 : n % 4 === 1 ? 2400 : n % 4 === 2 ? 420 : n % 4 === 3 ? 450 : 440
  const aram = queueId >= 450
  const duration = n === 11 ? 178 : aram ? 831 + (n % 17) * 12 : 1050 + (n % 23) * 20
  const blueWin = n % 5 !== 2 && n % 5 !== 3
  const participants = names.map((name,i) => {
    const champ = champions[(n + i*3) % champions.length]
    return {
      puuid:ids[i], participantId:i+1, summonerId:i+100, riotIdGameName:name, riotIdTagline:'DEMO', summonerName:name, profileIcon:i+1, summonerLevel:241-i*13,
      championId:champ[0], championName:champ[1], champLevel:11+(n+i)%7, teamId:i<5?100:200, teamPosition:aram?'':positions[(i+4)%5],
      kills:i===0&&n===0?1:3+(i+n)%10, deaths:i===0&&n===0?0:1+(i+n)%9, assists:i===0&&n===0?13:5+(n+2*i)%17,
      totalDamageDealtToChampions:4600+(n*1021+i*2300)%37000,totalDamageTaken:7000+(n*747+i*3400)%40000,goldEarned:5700+(n*245+i*900)%13000,
      totalMinionsKilled:aram?8+(n+i)%40:24+(n*5+i*23)%240, neutralMinionsKilled:i%5===2?74:0,
      visionScore:aram?0:10+(n+4*i)%40, wardsPlaced:aram?0:4+i, wardsKilled:aram?0:i%4,
      totalHeal:1500+i*712,totalHealsOnTeammates:i===0?8450:0,totalDamageShieldedOnTeammates:i===0?4190:250*i,
      damageDealtToObjectives:1365+i*630,damageDealtToTurrets:360+i*233,timeCCingOthers:18+i*3, damageSelfMitigated:6300,
      item0:3158,item1:6617,item2:3504,item3:6621,item4:n%2?3089:0,item5:n%3?3020:0,item6:3364,
      spell1Id:4,spell2Id:aram?32:7,perks:{styles:[{style:8200,selections:[{perk:8214}]},{style:8400,selections:[{perk:8453}]}]},
      playerAugment1:queueId===2400?101:0,playerAugment2:queueId===2400?102:0,playerAugment3:queueId===2400?103:0,playerAugment4:0,playerAugment5:0,playerAugment6:0,
      playerSubteamId:0, placement:0, subteamPlacement:0, win:i<5?blueWin:!blueWin,timePlayed:duration,gameEndedInEarlySurrender:n===11,gameEndedInSurrender:n%5===2,
      challenges:{soloKills:(n+i)%3},doubleKills:n%5===2?2:0,quadraKills:n%13===8?1:0,
    }
  })
  return { metadata:{match_id:`HN1_${99000000+n}`,private:false},json:{gameId:99000000+n,platformId:'HN1',queueId,mapId:aram?12:11,gameMode:aram?'ARAM':'CLASSIC',gameDuration:duration,gameVersion:'16.21.1',gameCreation:Date.parse('2026-11-05T12:00:00+08:00')-n*2280000,endOfGameResult:n===11?'Remake':'GameComplete',gameModeMutators:[],participants,teams:[{teamId:100,win:blueWin,objectives:{tower:{kills:7},dragon:{kills:3},baron:{kills:1}}},{teamId:200,win:!blueWin,objectives:{tower:{kills:3},dragon:{kills:1},baron:{kills:0}}}]} }
}
const games = Array.from({length:67},(_,i)=>makeGame(i))
const bp = { queueId:440,localPlayerCellId:0,myTeam:names.slice(0,5).map((gameName,i)=>({ puuid:ids[i],gameName,tagLine:'DEMO',cellId:i,summonerId:i+100,assignedPosition:positions[(i+4)%5].toLowerCase(),championId:champions[i][0],nameVisibilityType:'PUBLIC',isHumanoid:true })),theirTeam:[] }
const game = { phase:'InProgress', map:{id:11,name:'召唤师峡谷'}, gameData:{ gameId:9828375, queue:queues[0], playerChampionSelections:ids.map((puuid,i)=>({puuid,championId:champions[i][0]})),teamOne:ids.slice(0,5).map((puuid,i)=>({puuid,championId:champions[i][0],teamParticipantId:i<2?1:0,selectedPosition:positions[i].toLowerCase()})), teamTwo:ids.slice(5).map((puuid,i)=>({puuid,championId:champions[i+5][0],teamParticipantId:0,selectedPosition:positions[i].toLowerCase()})) } }
const items = [[3158,'明朗之靴'],[6617,'月石再生器'],[3504,'炽热香炉'],[6621,'黎明核心'],[3089,'灭世者的死亡之帽'],[3020,'法师之靴'],[3364,'神谕透镜']]
const mockIcons = (array, type) => array.map(([id,name]) => ({id,name,iconPath:`/qa-art/${type}-${id}.svg`,description:`${name} · 离线演示图标`}))
const version = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8')).version
const server = await createServer({ root:base, configFile:false, resolve:{alias:{'@':path.join(base,'src')}},define:{__PLUGIN_VERSION__:JSON.stringify(version)},server:{host:'127.0.0.1',port:0,open:false,strictPort:true},publicDir:false })
await server.listen()
const origin = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
const errors = [], writes = [], external = [], counts = []
const matchupRequests = []
let slowQueue = 0, failSgp = false, failMastery = false

function image(url) {
  const id = Number(url.match(/(\d+)\.(?:svg|png|jpg)$/)?.[1] || '0')
  const hue = id*47 % 360
  const label = url.includes('champion-icons') ? (champions.find((c)=>c[0]===id)?.[1]?.slice(0,1) || '英') : url.includes('profile-icons') ? '星' : url.includes('augment') ? '强' : url.includes('spell') ? '技' : url.includes('perk') ? '符' : '装'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue},55%,53%)"/><stop offset="1" stop-color="hsl(${(hue+80)%360},35%,21%)"/></linearGradient></defs><rect width="64" height="64" rx="7" fill="url(#g)"/><path d="M0 46L64 15M0 57L64 26" stroke="#ffffff24" stroke-width="6"/><text x="32" y="43" fill="#fff" font-family="Microsoft YaHei UI" font-size="33" text-anchor="middle">${label}</text></svg>`
}

try {
  browser = await chromium.launch({ executablePath:String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,headless:true,args:['--disable-gpu','--disable-background-networking'] })
  const context = await browser.newContext({ viewport:{width:1450,height:940}, reducedMotion:'reduce' })
  const page = await context.newPage()
  page.on('pageerror',(error)=>errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()), p = url.pathname, method = route.request().method()
    const json = (body,status=200)=>route.fulfill({status,json:body,headers:{'access-control-allow-origin':'*'}}).catch(()=>{})
    if (method === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization,user-agent'}}).catch(()=>{})
    if (method !== 'GET') { writes.push(`${method} ${p}`); return json({},405) }
    if (url.hostname === 'lol-api-champion.op.gg' && p.startsWith('/api/kr/champions/ranked/')) {
      const tier = url.searchParams.get('tier')
      matchupRequests.push([p, tier])
      const play = tier === 'diamond_plus' ? 80 : 100
      return json({meta:{version:'16.22'},data:{counters:p.endsWith('/support') ? [] : [
        {champion_id:64,play,win:p.endsWith('/top') ? 28 : 32},
        {champion_id:16,play:100,win:55},
      ]}})
    }
    if (p.includes('/match-history-query/')) {
      const queue = Number((url.searchParams.get('tag')||'').replace('q_',''))
      const start=Number(url.searchParams.get('startIndex')||0), count=Number(url.searchParams.get('count')||50)
      counts.push({queue,start,count})
      if (queue && queue===slowQueue) await new Promise((resolve)=>setTimeout(resolve,700))
      if (failSgp) return json({message:'fixture fallback'},503)
      return json({games:games.filter((g)=>!queue||g.json.queueId===queue).slice(start,start+count)})
    }
    if (url.origin !== origin) { external.push(url.hostname); return route.abort().catch(()=>{}) }
    if (p.startsWith('/qa-art/')||p.includes('/champion-icons/')||p.includes('/profile-icons/')||p.includes('/ranked-mini-crests/')) return route.fulfill({contentType:'image/svg+xml',body:image(p)}).catch(()=>{})
    if (p.endsWith('/champion-summary.json')) return json([...champions,[154,'扎克'],[83,'约里克']].map(([id,name])=>({id,name,title:'英雄',alias:`Preview${id}`,squarePortraitPath:`/qa-art/champion-${id}.svg`})))
    if (p.endsWith('/items.json')) return json(mockIcons(items,'item'))
    if (p.endsWith('/summoner-spells.json')) return json(mockIcons([[4,'闪现'],[7,'治疗'],[32,'雪球']],'spell'))
    if (p.endsWith('/perks.json')) return json(mockIcons([[8214,'召唤艾黎'],[8453,'复苏']],'perk'))
    if (p.endsWith('/perkstyles.json')) return json({styles:mockIcons([[8200,'巫术'],[8400,'坚决']],'perkstyle')})
    if (p.endsWith('/cherry-augments.json')) return json([101,102,103].map((id)=>({id,nameTRA:`演示强化 ${id}`,simpleNameTRA:`演示强化 ${id}`,augmentSmallIconPath:`/qa-art/augment-${id}.svg`,rarity:'kGold'})))
    if (p.endsWith('/maps.json')) return json([{id:11,name:'召唤师峡谷',gameModeName:'经典'},{id:12,name:'嚎哭深渊',gameModeName:'大乱斗'}])
    if (p==='/lol-game-queues/v1/queues') return json(queues)
    if (p==='/lol-chat/v1/me') return json({platformId:'HN1',puuid:ids[0],gameName:names[0],tagLine:'DEMO'})
    if (p==='/entitlements/v1/token') return json({accessToken:'test-fixture-only',issuer:'http://hn1-k8s-bcs-internal.lol.qq.com:28088'})
    if (p.endsWith('/league-session-token')) return json('test-fixture-only')
    if (p==='/lol-summoner/v1/current-summoner') return json(profile(0))
    if (p.endsWith('/alias/lookup')) {
      const player = names.indexOf(url.searchParams.get('gameName'))
      return player >= 0 && url.searchParams.get('tagLine') === 'DEMO' ? json(profile(player)) : json({},404)
    }
    if (/^\/lol-summoner\/v1\/summoners\/\d+$/.test(p)) return json(profile(Number(p.split('/').at(-1)) - 100))
    if (p.includes('/lol-summoner/v2/summoners/puuid/')) return json(profile(Math.max(0,ids.indexOf(p.split('/').at(-1)))))
    if (p.startsWith('/lol-ranked/')) return json(ranks)
    if (p.endsWith('/champion-mastery')) return failMastery?json({},403):json(champions.map(([championId],i)=>({championId,championLevel:30-i,championPoints:350000-i*24700})))
    if (p.endsWith('/gameflow-phase')) return json('Lobby')
    if (p.endsWith('/lol-gameflow/v1/session')) return json(game)
    if (p.endsWith('/lol-champ-select/v1/session')) return json(bp)
    if (p.includes('/lol-match-history/v1/products/lol/')) {
      const native = games.map(({json:g})=>({ ...g,participantIdentities:g.participants.map((q)=>({participantId:q.participantId,player:{puuid:q.puuid,gameName:q.riotIdGameName,tagLine:q.riotIdTagline,summonerId:q.summonerId,profileIcon:q.profileIcon}})),participants:g.participants.map((q)=>({...q,timeline:{lane:q.teamPosition},stats:{...q,perk0:8214,perkPrimaryStyle:8200,perkSubStyle:8400}})),teams:g.teams.map((t)=>({teamId:t.teamId,win:t.win?'Win':'Fail',towerKills:t.objectives.tower.kills,dragonKills:t.objectives.dragon.kills,baronKills:t.objectives.baron.kills})) }))
      const begin=Number(url.searchParams.get('begIndex')||0), end=Number(url.searchParams.get('endIndex')||19)
      return json({games:{games:native.slice(begin,end+1)}})
    }
    if (p.startsWith('/lol-')||p.startsWith('/fe/')) return json([])
    return route.continue()
  })
  await page.goto(`${origin}/qa-local/index.html`)
  const query = page.getByPlaceholder(/名字#Tag/)
  await query.fill('练习星轨#DEMO')
  await page.getByRole('button',{name:'查询战绩',exact:true}).click()
  const profileView = page.getByTestId('player-history')
  await profileView.locator('.rh-match').first().waitFor()
  await profileView.getByText('流光翡翠 I',{exact:true}).waitFor()
  await profileView.getByText('璀璨钻石 II',{exact:true}).waitFor()
  assert.equal(await profileView.locator('.rh-match').count(),49)
  assert.ok(await profileView.getByText('最高输出', {exact:true}).count())
  const recentChampion = profileView.locator('.rh-champion-strip button').first()
  const heroFilter = profileView.getByLabel('筛选英雄')
  await profileView.getByLabel('筛选胜负').selectOption('win')
  const winsBefore = await profileView.locator('.rh-match').count()
  await recentChampion.click()
  assert.notEqual(await heroFilter.inputValue(), '0')
  assert.equal(await recentChampion.getAttribute('aria-pressed'), 'true')
  await recentChampion.click()
  assert.equal(await heroFilter.inputValue(), '0')
  assert.equal(await recentChampion.getAttribute('aria-pressed'), 'false')
  assert.equal(await profileView.getByLabel('筛选胜负').inputValue(), 'win')
  assert.equal(await profileView.locator('.rh-match').count(), winsBefore)
  await profileView.getByLabel('筛选胜负').selectOption('')
  await profileView.getByText('350,000',{exact:true}).waitFor()
  const searchPlayer = profileView.getByRole('searchbox', {name:'搜索玩家'})
  await searchPlayer.fill('薄荷汽水')
  await searchPlayer.press('Enter')
  await profileView.getByText('请输入完整的名字#编号。',{exact:true}).waitFor()
  await searchPlayer.fill('薄荷汽水＃DEMO')
  await searchPlayer.press('Enter')
  await profileView.getByRole('heading', {name:'薄荷汽水#DEMO',exact:true}).waitFor()
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('heading', {name:'练习星轨#DEMO',exact:true}).waitFor()
  await profileView.locator('.rh-match').first().waitFor()
  const encounterIcons = await profileView.locator('.rh-encounters img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))
  assert.equal(encounterIcons.length, 9)
  assert.ok(encounterIcons.every((src) => src.includes('/profile-icons/')))
  await profileView.screenshot({path:path.join(out,'个人战绩_模拟数据.png')})
  await profileView.locator('.rh-expand').first().click()
  await profileView.getByText('10 人详细战报',{exact:true}).waitFor()
  assert.equal(await profileView.locator('.rh-report-table tbody tr:not(.rh-team-divider)').count(),10)
  await profileView.getByRole('button',{name:'治疗、控制与视野'}).click()
  await profileView.getByText('护盾 4,190',{exact:true}).waitFor()
  await profileView.locator('.rh-report').screenshot({path:path.join(out,'十人详细战报_模拟数据.png')})
  await profileView.getByRole('button',{name:/英雄统计/}).click()
  assert.ok(await profileView.locator('.rh-champion-table tbody tr').count()>=8)
  await profileView.getByRole('button',{name:/战绩明细/}).click()
  await profileView.getByLabel('筛选胜负').selectOption('win')
  assert.equal(await profileView.locator('.rh-match-loss').count(),0)
  await profileView.getByRole('button',{name:'重置筛选'}).click()
  await profileView.getByRole('button',{name:'继续加载 50 场'}).click()
  await profileView.getByText('已到当前接口的可用末尾',{exact:true}).waitFor()
  assert.equal(await profileView.locator('.rh-match').count(),66)
  assert.ok(counts.some((entry)=>entry.start===50))
  slowQueue = 420
  await profileView.getByLabel('游戏模式').selectOption('420')
  await profileView.getByLabel('游戏模式').selectOption('2400')
  await profileView.locator('.rh-match').first().waitFor()
  assert.ok((await profileView.locator('.rh-match-meta > span').allTextContents()).every((line)=>line.includes('海克斯大乱斗')))
  await profileView.locator('.rh-augments').first().waitFor()
  failSgp = true
  await profileView.getByLabel('游戏模式').selectOption('450')
  await profileView.getByText(/仅覆盖最近 100 场/).waitFor()
  await profileView.locator('.rh-expand').first().click()
  await profileView.getByRole('button',{name:'治疗、控制与视野'}).click()
  await profileView.getByText('护盾 —',{exact:true}).first().waitFor()
  failSgp = false
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'模拟 BP'}).click()
  const matchupPanel = page.getByTestId('enemy-opgg-matchups')
  const locked = page.getByTestId('qa-enemy-locked')
  await page.locator('[data-testid="qa-enemy-locked"][data-sona-enemy-matchup]').waitFor()
  await page.getByTestId('qa-enemy-preview').click()
  assert.equal(await matchupPanel.count(),0)
  await page.evaluate(() => window.qaEnemyQueue(430))
  await locked.click()
  assert.equal(await matchupPanel.count(),0)
  await page.evaluate(() => window.qaEnemyQueue(440))
  await locked.click()
  await matchupPanel.getByText('选择该英雄的分路以查询韩服对位。',{exact:true}).waitFor()
  assert.equal(matchupRequests.length,0)
  await matchupPanel.getByRole('button',{name:'选择分路',exact:true}).click()
  await matchupPanel.getByRole('button',{name:'打野',exact:true}).click()
  await matchupPanel.getByText('32.0%',{exact:true}).waitFor()
  await matchupPanel.getByRole('button',{name:'流光翡翠+',exact:true}).click()
  await matchupPanel.getByRole('button',{name:'璀璨钻石+',exact:true}).click()
  await matchupPanel.getByText('40.0%',{exact:true}).waitFor()
  await matchupPanel.getByRole('button',{name:'打野',exact:true}).click()
  await matchupPanel.getByRole('button',{name:'上路',exact:true}).click()
  await matchupPanel.getByText('35.0%',{exact:true}).waitFor()
  await matchupPanel.screenshot({path:path.join(out,'敌方韩服对位_模拟数据.png')})
  await matchupPanel.getByRole('button',{name:'上路',exact:true}).click()
  await matchupPanel.getByRole('button',{name:'辅助',exact:true}).click()
  await matchupPanel.getByText('暂无对局克制数据',{exact:true}).waitFor()
  assert.deepEqual(matchupRequests,[
    ['/api/kr/champions/ranked/154/jungle','emerald_plus'],
    ['/api/kr/champions/ranked/154/jungle','diamond_plus'],
    ['/api/kr/champions/ranked/154/top','diamond_plus'],
    ['/api/kr/champions/ranked/154/support','diamond_plus'],
  ])
  await page.keyboard.press('Escape')
  await matchupPanel.waitFor({state:'hidden'})
  await page.evaluate(() => window.qaEnemyQueue(0, true, 'AllRandomPickStrategy'))
  await locked.click()
  assert.equal(await matchupPanel.count(),0)
  await page.evaluate(() => window.qaEnemyQueue(0, true, 'TournamentPickStrategy'))
  await locked.click()
  await matchupPanel.getByText('选择该英雄的分路以查询韩服对位。',{exact:true}).waitFor()
  await page.keyboard.press('Escape')
  await matchupPanel.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'己方五人战绩',exact:true}).click()
  const bpView = page.getByTestId('bp-history')
  await bpView.locator('.rh-team-card').nth(4).waitFor()
  assert.equal(await bpView.locator('.rh-team-card').count(),5)
  await bpView.getByText('练习星轨#DEMO',{exact:true}).waitFor()
  assert.equal(await bpView.getByText('白昼拾荒#DEMO',{exact:true}).count(),0)
  await bpView.locator('.rh-team-card-stats').nth(4).waitFor()
  const rankRows = bpView.locator('.rh-team-card').first().locator('.rh-team-rank-row')
  await rankRows.nth(1).waitFor()
  assert.deepEqual(await rankRows.allTextContents(), ['单双排55 LP','灵活组排40 LP'])
  assert.deepEqual(await rankRows.locator('img').evaluateAll((icons) => icons.map((icon) => icon.getAttribute('src'))), [
    '/fe/lol-static-assets/images/ranked-mini-crests/emerald.svg',
    '/fe/lol-static-assets/images/ranked-mini-crests/diamond.svg',
  ])
  assert.equal(await rankRows.first().getAttribute('title'), '单双排 · 流光翡翠 I · 55 LP')
  assert.ok((await rankRows.nth(1).boundingBox()).y > (await rankRows.first().boundingBox()).y)
  await bpView.getByLabel('队伍战绩范围').selectOption('2400')
  await bpView.locator('.rh-team-match').first().getByText('海克斯大乱斗', {exact:true}).waitFor()
  await bpView.getByLabel('队伍战绩范围').selectOption('-1')
  await bpView.locator('.rh-team-match').first().getByText('排位赛 灵活排位', {exact:true}).waitFor()
  await page.setViewportSize({width:1000,height:650})
  for (const selector of ['.rh-team-body', '.rh-team-recent-list']) {
    const scrollbar = await bpView.locator(selector).first().evaluate((element) => {
      const track = getComputedStyle(element, '::-webkit-scrollbar-track')
      const thumb = getComputedStyle(element, '::-webkit-scrollbar-thumb')
      const buttons = getComputedStyle(element, '::-webkit-scrollbar-button')
      element.scrollTop = 40
      const scrolls = element.scrollTop > 0
      element.scrollTop = 0
      return { track: track.backgroundColor, thumb: thumb.backgroundColor, buttons: buttons.display, scrolls }
    })
    assert.equal(scrollbar.track, 'rgba(0, 0, 0, 0)')
    assert.ok(['rgba(194, 186, 218, 0.28)', 'rgba(194, 186, 218, 0.52)'].includes(scrollbar.thumb))
    assert.equal(scrollbar.buttons, 'none')
    assert.ok(scrollbar.scrolls)
  }
  await page.setViewportSize({width:1450,height:940})
  await bpView.locator('.rh-team-match').first().click()
  await page.locator('.rh-team-match-detail .rh-report').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('.rh-team-match-detail').waitFor({state:'hidden'})
  await bpView.screenshot({path:path.join(out,'BP己方五人_模拟数据.png')})
  await bpView.locator('.rh-team-card-head').first().click()
  await profileView.locator('.rh-match').first().waitFor()
  assert.equal(await profileView.getByLabel('游戏模式').inputValue(),'440')
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  assert.ok(await bpView.isVisible())
  await page.keyboard.press('Escape')
  await bpView.waitFor({state:'hidden'})
  const avatar = page.getByTestId('preview-avatar-0')
  await avatar.locator('[data-sona-particle]').waitFor({state:'attached'})
  await avatar.click({position:{x:24,y:24}})
  await profileView.locator('.rh-match').first().waitFor()
  assert.equal(await profileView.getByLabel('游戏模式').inputValue(),'440')
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'模拟进游戏'}).click()
  assert.equal(await page.getByRole('button',{name:'己方五人战绩',exact:true}).count(),0)
  await page.getByRole('button',{name:'十人战绩总览',exact:true}).click()
  const gameView = page.getByTestId('game-history')
  await gameView.locator('.rh-team-card').nth(9).waitFor()
  assert.equal(await gameView.locator('.rh-team-card').count(),10)
  assert.equal(await gameView.locator('.rh-team-blue .rh-team-card').count(),5)
  assert.equal(await gameView.locator('.rh-team-red .rh-team-card').count(),5)
  await gameView.locator('.rh-team-card-stats').nth(9).waitFor()
  await gameView.getByText('组队 A',{exact:true}).first().waitFor()
  await gameView.screenshot({path:path.join(out,'游戏后双方总览_模拟数据.png')})
  await page.keyboard.press('Escape')
  await gameView.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'模拟回大厅'}).click()
  assert.equal(await page.locator('[data-sona-team-history]').count(),0)
  await page.setViewportSize({width:1000,height:660})
  failMastery = true
  await query.fill('练习星轨#DEMO')
  await page.getByRole('button',{name:'查询战绩',exact:true}).click()
  await profileView.getByText('该玩家的英雄点数暂不可用',{exact:true}).waitFor()
  await profileView.locator('.rh-match').first().waitFor()
  assert.ok(await profileView.evaluate((element)=>element.scrollWidth <= element.clientWidth+2))
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  await page.evaluate(() => window.qaNativeHistory())
  async function assertProfile(name) {
    await profileView.getByRole('heading', { name, exact: true }).waitFor()
    await profileView.locator('.rh-match').first().waitFor()
    await page.keyboard.press('Escape')
    await profileView.waitFor({state:'hidden'})
  }
  const nativeEntry = page.locator('.sona-profile-history-entry')
  const ownEntry = page.locator('.rcp-fe-lol-profiles-main').locator(nativeEntry)
  await ownEntry.waitFor()
  const searchBox = await page.getByRole('textbox', {name:'原生搜索框'}).boundingBox()
  const ownButton = await ownEntry.boundingBox()
  assert.ok(ownButton.y > searchBox.y + searchBox.height)
  await page.getByRole('button', {name:'查看他人生涯'}).click()
  const otherEntry = page.locator('.rcp-fe-lol-profiles-modal').locator(nativeEntry)
  await otherEntry.waitFor()
  assert.equal(await nativeEntry.count(), 1)
  assert.equal(await ownEntry.count(), 0)
  await otherEntry.click()
  await assertProfile('雨后回声#DEMO')
  await page.getByRole('button', {name:'切换至对局记录'}).click()
  await page.locator('.sona-profile-history-entry').click()
  await assertProfile('微光纸船#DEMO')
  await page.getByRole('button', {name:'关闭他人生涯'}).click()
  await ownEntry.waitFor()
  await ownEntry.click()
  await assertProfile('练习星轨#DEMO')
  await page.getByText('历史战报玩家', {exact:true}).click({button:'right'})
  assert.equal(await page.locator('.qa-context-menu').getByRole('button', {name:'查看资料'}).count(),1)
  await page.locator('.qa-context-menu').getByRole('button', {name:'详细战绩'}).click()
  await assertProfile('海盐风铃#DEMO')
  await page.getByText('结算玩家', {exact:true}).click({button:'right'})
  const actions = page.locator('.player-actions-menu-container')
  assert.equal(await actions.getByRole('button', {name:'查看资料'}).count(),1)
  await actions.getByRole('button', {name:'详细战绩'}).click()
  await assertProfile('白昼拾荒#DEMO')
  assert.equal(errors.length,0,errors.join('\n'))
  assert.equal(writes.length,0,writes.join('\n'))
  console.log(JSON.stringify({result:'passed', checks:['native locked enemy row with nonstandard portrait path', 'ranked and custom draft gating', 'Korean lane/tier queries and no-data state', 'champion filter toggle and damage badge', 'personal history', 'player search and return', 'encounter profile icons', 'filters and pagination', 'native fallback', 'BP five and game ten', 'recent match detail', 'transparent nested scrollbars', 'nested Escape', 'phase exit', '1000px layout', 'native search clearance and exclusive profile entry', 'history and postgame context menus', 'no writes / no page errors'], requests:counts.length, blockedUnrelatedExternal:[...new Set(external)]},null,2))
} finally {
  await browser?.close()
  await server.close()
}
