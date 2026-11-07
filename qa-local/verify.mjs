import { createServer } from 'vite'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.SONA_PLAYWRIGHT_PATH || 'playwright')
const base = path.resolve(import.meta.dirname, '..')
const out = path.resolve(base, '..', 'sona-preview')
await fs.mkdir(out, { recursive: true })
const nativeRankFiles = new Map(await Promise.all([
  'iron.svg','bronze.svg','silver.svg','gold.svg','platinum.svg','emerald.svg','diamond.svg',
  'master.svg','grandmaster.svg','challenger.svg','unranked.svg','unranked.png',
].map(async (name) => [name,await fs.readFile(path.join(base,'qa-local','fixtures','ranked',name))])))
const names = ['练习星轨', '薄荷汽水', '雨后回声', '微光纸船', '海盐风铃', '白昼拾荒', '云端烟火', '满月航线', '橘子信笺', '栖木午后']
const champions = [[16,'索拉卡'],[350,'悠米'],[117,'璐璐'],[37,'娑娜'],[267,'娜美'],[103,'阿狸'],[99,'拉克丝'],[22,'艾希'],[51,'凯特琳'],[64,'李青'],[157,'亚索'],[222,'金克丝']]
const positions = ['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY']
const ids = names.map((_, i) => `preview-player-${i}`)
ids[2] = 'deadbeef-cafe-5eed-babe-f00df00df00d'
const queues = [[440,'排位赛 灵活排位'],[420,'排位赛 单双排'],[450,'极地大乱斗'],[2400,'海克斯大乱斗'],[430,'匹配模式']].map(([id,name]) => ({ id,name,description:name, gameMode:id >= 450 ? 'ARAM' : 'CLASSIC', queueAvailability:'Available', isEnabled:true, category:'PvP', isRanked:id===440||id===420, mapId:id>=450?12:11 }))
const ranks = { queueMap: { RANKED_SOLO_5x5: {tier:'EMERALD',division:'I',leaguePoints:55,wins:10,losses:7,highestTier:'DIAMOND',highestDivision:'I'}, RANKED_FLEX_SR: {tier:'DIAMOND',division:'II',leaguePoints:40,wins:126,losses:91,highestTier:'MASTER',highestDivision:'NA'} } }
const emptyRanks = {queueMap:Object.fromEntries(Object.keys(ranks.queueMap).map((key)=>[key,{tier:'UNRANKED',division:'',leaguePoints:0,wins:0,losses:0}]))}
Object.assign(ranks.queueMap.RANKED_SOLO_5x5, {previousSeasonHighestTier:'DIAMOND',previousSeasonHighestDivision:'II',previousSeasonEndTier:'PLATINUM',previousSeasonEndDivision:'I'})
const profile = (i) => ({ puuid: ids[i], gameName: names[i], tagLine:'DEMO', displayName:names[i], summonerId:i+100, profileIconId:i+1, summonerLevel:241-i*13, privacy:'PUBLIC' })
const makeGame = (n) => {
  const queueId = n === 0 ? 440 : n % 4 === 1 ? 2400 : n % 4 === 2 ? 420 : n % 4 === 3 ? 450 : 440
  const aram = queueId >= 450
  const duration = n === 11 ? 178 : aram ? 831 + (n % 17) * 12 : 1050 + (n % 23) * 20
  const blueWin = n % 5 !== 2 && n % 5 !== 3
  const participants = names.map((name,i) => {
    const champ = champions[(n + i*3) % champions.length]
    const damage = 4600 + (n*1021 + i*2300) % 37000
    const taken = 7000 + (n*747 + i*3400) % 40000
    return {
      puuid:ids[i], participantId:i+1, summonerId:i+100, riotIdGameName:name, riotIdTagline:'DEMO', summonerName:name, profileIcon:i+1, summonerLevel:241-i*13,
      championId:champ[0], championName:champ[1], champLevel:11+(n+i)%7, teamId:i<5?100:200, teamPosition:aram?'':positions[(i+4)%5],
      kills:i===0&&n===0?1:3+(i+n)%10, deaths:i===0&&n===0?0:1+(i+n)%9, assists:i===0&&n===0?13:5+(n+2*i)%17,
      totalDamageDealtToChampions:damage,totalDamageTaken:taken,goldEarned:5700+(n*245+i*900)%13000,
      ...(i !== 2 && { physicalDamageDealtToChampions:damage*.5, magicDamageDealtToChampions:damage*.4, trueDamageDealtToChampions:damage*.1 }),
      physicalDamageTaken:taken*.6,magicDamageTaken:taken*.3,trueDamageTaken:taken*.1,
      totalMinionsKilled:aram?8+(n+i)%40:24+(n*5+i*23)%240, neutralMinionsKilled:i%5===2?74:0,
      visionScore:aram?0:10+(n+4*i)%40, wardsPlaced:aram?0:4+i, wardsKilled:aram?0:i%4, detectorWardsPlaced:0, turretTakedowns:0,
      totalHeal:1500+i*712,totalHealsOnTeammates:i===0?8450:0,totalDamageShieldedOnTeammates:i===0?4190:250*i,
      damageDealtToObjectives:1365+i*630,damageDealtToTurrets:360+i*233,timeCCingOthers:18+i*3, damageSelfMitigated:6300,
      item0:3158,item1:6617,item2:3504,item3:6621,item4:n%2?3089:0,item5:n%3?3020:0,item6:3364,
      spell1Id:4,spell2Id:aram?32:7,perks:{statPerks:{offense:5008,flex:5008,defense:5002},styles:[
        {style:8200,selections:[{perk:8214,var1:1234,var2:567,var3:0},{perk:8234},{perk:8210},{perk:8237}]},
        {style:8400,selections:[{perk:8453,var1:0},{perk:8444}]},
      ]},
      playerAugment1:queueId===2400?101:0,playerAugment2:queueId===2400?102:0,playerAugment3:queueId===2400?103:0,playerAugment4:0,playerAugment5:0,playerAugment6:0,
      playerSubteamId:0, placement:0, subteamPlacement:0, win:i<5?blueWin:!blueWin,timePlayed:duration,gameEndedInEarlySurrender:n===11,gameEndedInSurrender:n%5===2,
      challenges:{soloKills:(n+i)%3},doubleKills:n%5===2?2:0,quadraKills:n%13===8?1:0,
    }
  })
  return { metadata:{match_id:`HN1_${99000000+n}`,private:false},json:{gameId:99000000+n,platformId:'HN1',queueId,mapId:aram?12:11,gameMode:aram?'ARAM':'CLASSIC',gameDuration:duration,gameVersion:'16.21.1',gameCreation:Date.parse('2026-11-05T12:00:00+08:00')-n*2280000,endOfGameResult:n===11?'Remake':'GameComplete',gameModeMutators:[],participants,teams:[{teamId:100,win:blueWin,objectives:{tower:{kills:7},dragon:{kills:3},baron:{kills:1}}},{teamId:200,win:!blueWin,objectives:{tower:{kills:3},dragon:{kills:1},baron:{kills:0}}}]} }
}
const games = Array.from({length:67},(_,i)=>makeGame(i))
const bp = { queueId:440,localPlayerCellId:0,myTeam:names.slice(0,5).map((gameName,i)=>({ puuid:ids[i],gameName,tagLine:'DEMO',cellId:i,summonerId:i+100,assignedPosition:positions[(i+4)%5].toLowerCase(),championId:champions[i][0],nameVisibilityType:'PUBLIC',isHumanoid:true })),theirTeam:[] }
bp.myTeam[0].championId = 0
bp.myTeam[0].championPickIntent = 157
bp.actions = [[{actorCellId:0,type:'pick',championId:157,completed:false,isInProgress:true}]]
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
const crossRegionRequests = []
const accountSearchBatches = []
const fuzzyAccounts = Array.from({length:33},(_,index) => ({ puuid:`region-search-${index}`,alias:{game_name:`全区玩家${index}`,tag_line:`S${index}`} }))
const replayActions = []
let augmentRequests = 0
let slowQueue = 0, failSgp = false, failMastery = false
let unrankedProfile = false, mixedTeamRanks = false

function image(url) {
  const id = Number(url.match(/(\d+)\.(?:svg|png|jpg)$/)?.[1] || '0')
  const hue = id*47 % 360
  const label = url.includes('champion-icons') ? (champions.find((c)=>c[0]===id)?.[1]?.slice(0,1) || '英') : url.includes('profile-icons') ? '星' : url.includes('augment') ? '强' : url.includes('spell') ? '技' : url.includes('perk') ? '符' : '装'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${hue},55%,53%)"/><stop offset="1" stop-color="hsl(${(hue+80)%360},35%,21%)"/></linearGradient></defs><rect width="64" height="64" rx="7" fill="url(#g)"/><path d="M0 46L64 15M0 57L64 26" stroke="#ffffff24" stroke-width="6"/><text x="32" y="43" fill="#fff" font-family="Microsoft YaHei UI" font-size="33" text-anchor="middle">${label}</text></svg>`
}

try {
  browser = await chromium.launch({ executablePath:process.env.SONA_CHROME_PATH,headless:true,args:['--disable-gpu','--disable-background-networking'] })
  const context = await browser.newContext({ viewport:{width:1450,height:940}, reducedMotion:'reduce' })
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  const page = await context.newPage()
  page.on('pageerror',(error)=>errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()), p = url.pathname, method = route.request().method()
    const json = (body,status=200)=>route.fulfill({status,json:body,headers:{'access-control-allow-origin':'*'}}).catch(()=>{})
    if (method === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization,user-agent,content-type'}}).catch(()=>{})
    const isOtherRegion = url.hostname === 'hn10-k8s-sgp.lol.qq.com'
    if ((isOtherRegion || url.hostname === 'hn1-k8s-sgp.lol.qq.com') && method === 'POST' && /\/summoner-ledge\/v1\/regions\/HN(?:1|10)\/summoners\/puuids$/.test(p)) {
      const requested = route.request().postDataJSON()
      if (requested.some((id) => id.startsWith('region-search-'))) {
        accountSearchBatches.push(requested.length)
        return json(requested.map((id) => ({puuid:id,profileIconId:1,level:80})))
      }
      if (!isOtherRegion) return json(requested.flatMap((id) => ids.includes(id) ? [profile(ids.indexOf(id))] : []))
      assert.deepEqual(route.request().postDataJSON(), [ids[8]])
      crossRegionRequests.push('profile')
      return json([profile(8)])
    }
    if (url.origin === origin && p === '/lol-replays/v1/metadata/99000000' && method === 'GET') {
      return json({state:replayActions.includes('download')?'watch':'download'})
    }
    if (url.origin === origin && method === 'POST' && p.startsWith('/lol-replays/v1/rofls/99000000/')) {
      replayActions.push(p.split('/').at(-1))
      return json({})
    }
    if (method !== 'GET') { writes.push(`${method} ${p}`); return json({},405) }
    if (url.hostname === 'riotclient' && p === '/player-account/aliases/v1/lookup') {
      const name = url.searchParams.get('gameName')
      if (name === '全区') return json(fuzzyAccounts)
      const index = names.indexOf(name)
      if (index === 8) crossRegionRequests.push('name')
      return index < 0 ? json([]) : json([{puuid:ids[index],alias:{game_name:names[index],tag_line:'DEMO'}}])
    }
    if (url.hostname === 'lol-api-champion.op.gg' && p === '/api/kr/champions/ranked') {
      return json({meta:{version:'16.22'},data:[{id:154,positions:[
        {name:'JUNGLE',stats:{role_rate:.8}},{name:'TOP',stats:{role_rate:.2}},
      ]}]})
    }
    if (url.hostname === 'aramgg.com' && p === '/data/aram-mayhem-augments.zh_cn.json') {
      augmentRequests++
      return json(Object.fromEntries([101,102,103].map((id) => [id, {
        id, displayName:`演示强化 ${id}`, rarity:1, description:'命中敌人时获得额外移速。<br>演示强化效果',
      }])))
    }
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
      if (isOtherRegion && p.includes(ids[8])) crossRegionRequests.push('matches')
      if (queue && queue===slowQueue) await new Promise((resolve)=>setTimeout(resolve,700))
      if (failSgp) return json({message:'fixture fallback'},503)
      return json({games:games.filter((g)=>!queue||g.json.queueId===queue).slice(start,start+count)})
    }
    if (isOtherRegion && p.startsWith('/summoner-ledge/v1/regions/HN10/summoners/name/')) {
      crossRegionRequests.push('name')
      return decodeURIComponent(p.split('/').at(-1)) === names[8] ? json(profile(8)) : json({},404)
    }
    if (isOtherRegion && p === `/leagues-ledge/v2/rankedStats/puuid/${ids[8]}`) {
      crossRegionRequests.push('ranks')
      return json(ranks)
    }
    if (url.origin !== origin) { external.push(url.hostname); return route.abort().catch(()=>{}) }
    if (p==='/fe/lol-shared-components/unranked.png') return route.fulfill({contentType:'image/png',body:nativeRankFiles.get('unranked.png')}).catch(()=>{})
    if (p.includes('/ranked-mini-crests/') && nativeRankFiles.has(p.split('/').at(-1))) return route.fulfill({contentType:'image/svg+xml',body:nativeRankFiles.get(p.split('/').at(-1))}).catch(()=>{})
    if (p.startsWith('/qa-art/')||p.includes('/champion-icons/')||p.includes('/profile-icons/')||p.includes('/ranked-mini-crests/')||p.startsWith('/fe/lol-shared-components/')) return route.fulfill({contentType:'image/svg+xml',body:image(p)}).catch(()=>{})
    if (p.endsWith('/champion-summary.json')) return json([...champions,[154,'扎克'],[83,'约里克']].map(([id,name])=>({id,name:'英雄',description:name,alias:`Preview${id}`,squarePortraitPath:`/qa-art/champion-${id}.svg`})))
    if (p.endsWith('/items.json')) return json(mockIcons(items,'item'))
    if (p.endsWith('/summoner-spells.json')) return json(mockIcons([[4,'闪现'],[7,'治疗'],[32,'雪球']],'spell'))
    if (p.endsWith('/perks.json')) return json(mockIcons([[8214,'召唤艾黎'],[8453,'复苏'],[8234,'迅捷'],[8210,'超然'],[8237,'焦灼'],[8444,'复苏之风'],[5008,'适应之力'],[5002,'护甲']],'perk').map((perk) => ({
      ...perk,endOfGameStatDescs:perk.id===8214 ? ['造成伤害：@eogvar1@','提供护盾：@eogvar2@'] : [8453,8444].includes(perk.id)?['触发次数：@eogvar1@']:[],
    })))
    if (p.endsWith('/perkstyles.json')) return json({styles:mockIcons([[8200,'巫术'],[8400,'坚决']],'perkstyle')})
    if (p.endsWith('/cherry-augments.json')) return json([101,102,103].map((id,index)=>({id,nameTRA:`演示强化 ${id}`,simpleNameTRA:`演示强化 ${id}`,augmentSmallIconPath:`/qa-art/augment-${id}.svg`,rarity:['kGold','kSilver','kPrismatic'][index]})))
    if (p.endsWith('/maps.json')) return json([{id:11,name:'召唤师峡谷',gameModeName:'经典'},{id:12,name:'嚎哭深渊',gameModeName:'大乱斗'}])
    if (p==='/lol-game-queues/v1/queues') return json(queues)
    if (p==='/lol-chat/v1/me') return json({platformId:'HN1',puuid:ids[0],gameName:names[0],tagLine:'DEMO'})
    if (p==='/lol-lobby/v2/lobby') return json({gameConfig:{isCustom:false},members:[{puuid:ids[0]},{puuid:ids[1]}]})
    if (p==='/lol-chat/v1/friends') return json([
      [2,'chat'], [3,'offline'], [4,'dnd'], [5,'chat','inQueue'], [6,'away'], [7,'chat','inGame'],
    ].map(([index,availability,gameStatus]) => ({
      puuid:ids[index], gameName:names[index], gameTag:'DEMO', icon:index+1,
      availability, platformId:'HN1', lol:{gameStatus},
    })))
    if (p==='/entitlements/v1/token') return json({accessToken:'test-fixture-only',issuer:'http://hn1-k8s-bcs-internal.lol.qq.com:28088'})
    if (p.endsWith('/league-session-token')) return json('test-fixture-only')
    if (p==='/lol-summoner/v1/current-summoner') return json(profile(0))
    if (p==='/lol-patch/v1/game-version') return json('16.22.1')
    if (p==='/lol-summoner/v1/profile-privacy-enabled') {
      return json('ENABLED', url.searchParams.has('fail') ? 503 : 200)
    }
    if (p==='/lol-summoner/v1/profile-privacy-enabled-extra') return json('ENABLED')
    if (p.endsWith('/alias/lookup')) {
      const player = names.indexOf(url.searchParams.get('gameName'))
      return player >= 0 && url.searchParams.get('tagLine') === 'DEMO' ? json(profile(player)) : json({},404)
    }
    if (p==='/lol-summoner/v1/summoners' && url.searchParams.has('name')) {
      const player = names.indexOf(url.searchParams.get('name'))
      return player >= 0 ? json(profile(player)) : json({},404)
    }
    if (/^\/lol-summoner\/v1\/summoners\/\d+$/.test(p)) return json(profile(Number(p.split('/').at(-1)) - 100))
    if (p.includes('/lol-summoner/v2/summoners/puuid/')) return json(profile(Math.max(0,ids.indexOf(p.split('/').at(-1)))))
    if (p.startsWith('/lol-ranked/')) {
      if (unrankedProfile || mixedTeamRanks && p.endsWith(ids[2])) return json(emptyRanks)
      if (mixedTeamRanks && p.endsWith(ids[1])) return json({queueMap:{...emptyRanks.queueMap,RANKED_SOLO_5x5:{tier:'BRONZE',division:'IV',leaguePoints:18,wins:7,losses:9}}})
      return p.endsWith(ids[1]) ? json({queueMap:Object.fromEntries(Object.entries(ranks.queueMap).map(([key,rank])=>[key,{...rank,losses:0}]))}) : json(ranks)
    }
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
  const privacySwitch = page.locator('.sona-setting-card').filter({hasText:'解锁隐藏生涯'}).getByRole('switch')
  await privacySwitch.waitFor()
  assert.equal(await privacySwitch.getAttribute('aria-checked'), 'true')
  const privacy = await page.evaluate(async () => {
    function read(path, responseType) {
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('GET', `/lol-summoner/v1/${path}`)
        request.responseType = responseType
        request.onreadystatechange = () => {
          if (request.readyState === XMLHttpRequest.DONE) resolve([request.status, request.response])
        }
        request.onerror = reject
        request.send()
      })
    }
    return Promise.all([
      read('profile-privacy-enabled', 'text'),
      read('profile-privacy-enabled', 'json'),
      read('profile-privacy-enabled-extra', 'json'),
      read('profile-privacy-enabled?fail', 'json'),
    ])
  })
  assert.deepEqual(privacy, [[200, 'false'], [200, false], [200, 'ENABLED'], [503, false]])
  await privacySwitch.click()
  const themeCard = page.locator('.sona-setting-card').filter({hasText:'插件主题'})
  const mainTitle = page.locator('.sona-settings-title').first()
  assert.equal(await page.locator('html').getAttribute('data-sona-theme'),'client')
  assert.equal(await mainTitle.evaluate((node) => getComputedStyle(node).color),'rgb(240, 230, 210)')
  await themeCard.getByRole('button',{name:'客户端（黑金）',exact:true}).click()
  await themeCard.getByRole('button',{name:'深色蓝灰',exact:true}).click()
  assert.equal(await page.locator('html').getAttribute('data-sona-theme'),'slate')
  assert.equal(await page.evaluate(() => window.DataStore.get('sona:theme')),'slate')
  assert.equal(await mainTitle.evaluate((node) => getComputedStyle(node).color),'rgb(234, 241, 250)')
  assert.equal(await page.evaluate(() => window.DataStore.get('sona:ignoreProfilePrivacy')), false)
  await privacySwitch.click()
  const query = page.getByPlaceholder(/名字#Tag/)
  const scoreSwitch = page.getByTestId('score-system-switch')
  assert.equal(await scoreSwitch.getAttribute('aria-label'),'评分机制：Akari')
  await scoreSwitch.click()
  assert.equal(await page.evaluate(()=>window.DataStore.get('sona:playerScoreSystem')),'sona')
  await scoreSwitch.click()
  await page.locator('#qa-score-menu').screenshot({path:path.join(out,'主菜单评分切换_模拟界面.png')})
  await page.evaluate(async (puuid)=>{
    const host=document.createElement('div');host.id='qa-lobby-score'
    const regalia=document.createElement('lol-regalia-parties-v2-element');regalia.setAttribute('puuid',puuid)
    const identity=document.createElement('div');identity.className='player-identity-container';identity.style.cssText='width:300px;height:160px;position:relative'
    regalia.appendChild(identity);host.appendChild(regalia);document.body.appendChild(host)
    const {store}=await import('/src/lib/store.ts');store.set('lobbyEnhancement',true)
  },ids[0])
  const lobbyScore = page.locator('#qa-lobby-score [data-sona-lobby-stats]')
  await lobbyScore.getByText(/Akari 评分/).waitFor()
  const lobbyRequests = counts.length
  await scoreSwitch.click()
  await lobbyScore.getByText(/Sona 评分/).waitFor()
  await scoreSwitch.click()
  await lobbyScore.getByText(/Akari 评分/).waitFor()
  assert.equal(counts.length,lobbyRequests)
  await page.evaluate(async()=>{const {store}=await import('/src/lib/store.ts');store.set('lobbyEnhancement',false);document.getElementById('qa-lobby-score').remove()})
  await query.fill('练习星轨#DEMO')
  await page.getByRole('button',{name:'查询战绩',exact:true}).click()
  const profileView = page.getByTestId('player-history')
  const settings = page.getByTestId('history-display-settings')
  const tooltip = page.getByRole('tooltip')
  await profileView.locator('.rh-match').first().waitFor()
  const firstHero = profileView.locator('.rh-match-hero img').first()
  await firstHero.hover()
  await tooltip.getByText('英雄 · 索拉卡',{exact:true}).waitFor()
  assert.equal(await firstHero.getAttribute('title'),null)
  await page.mouse.move(4,4)
  await tooltip.waitFor({state:'hidden'})
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.textContent = '提示验证'
    button.title = '统一提示样式'
    button.id = 'qa-legacy-tooltip'
    document.querySelector('[data-testid="player-history"] .rh-header-actions').append(button)
  })
  const legacyTooltip = page.locator('#qa-legacy-tooltip')
  await legacyTooltip.hover()
  await tooltip.getByText('统一提示样式',{exact:true}).waitFor()
  assert.equal(await legacyTooltip.getAttribute('title'),null)
  assert.equal(await tooltip.evaluate((node) => getComputedStyle(node).backgroundColor),'rgb(28, 44, 64)')
  await page.evaluate(() => document.querySelector('#qa-legacy-tooltip').remove())
  await page.mouse.move(4,4)
  await tooltip.waitFor({state:'hidden'})
  const runeButton = profileView.getByRole('button',{name:'查看本局符文详情',exact:true}).first()
  await runeButton.locator('img').first().hover()
  await tooltip.getByText('召唤艾黎',{exact:true}).waitFor()
  await page.mouse.move(4,4)
  await runeButton.click()
  const runeDetails = page.getByRole('region',{name:'本局符文详情',exact:true})
  await runeDetails.getByText('造成伤害：1,234',{exact:true}).waitFor()
  await runeDetails.getByText('提供护盾：567',{exact:true}).waitFor()
  await runeDetails.getByText('触发次数：0',{exact:true}).waitFor()
  await runeDetails.getByText('触发次数：—',{exact:true}).waitFor()
  await page.keyboard.press('Escape')
  await runeDetails.waitFor({state:'hidden'})
  await profileView.getByText('流光翡翠 I',{exact:true}).waitFor()
  await profileView.getByText('璀璨钻石 II',{exact:true}).waitFor()
  const rankCards = profileView.locator('.rh-rank-card')
  const scorePanel = profileView.locator('.rh-score')
  await profileView.locator('.rh-score[data-score-system="akari"]').waitFor()
  const akariValue = await scorePanel.locator('strong').textContent(), scoreRequests = counts.length
  await scoreSwitch.evaluate((button)=>button.click())
  await profileView.locator('.rh-score[data-score-system="sona"]').waitFor()
  assert.match(await scorePanel.locator('strong').textContent(),/^\d+\.\d$/)
  await scoreSwitch.evaluate((button)=>button.click())
  await profileView.locator('.rh-score[data-score-system="akari"]').waitFor()
  assert.equal(await scorePanel.locator('strong').textContent(),akariValue)
  assert.match(akariValue,/^\d+\.\d{2}$/)
  assert.equal(counts.length,scoreRequests)
  assert.equal(await profileView.locator('.rh-profile-level').textContent(),'241')
  const profileTitle = profileView.locator('.rh-profile-name h2')
  const originalTitle = await profileTitle.textContent()
  for (const width of [1450,1000]) {
    await page.setViewportSize({width,height:940})
    for (const sample of ['芙莉莲','一二三四五六七八九十一二三四五六']) {
      await profileTitle.evaluate((node,text)=>{node.textContent=text},sample)
      const titleLayout = await profileTitle.evaluate((node)=>{
        const range=document.createRange();range.selectNodeContents(node)
        return {lines:range.getClientRects().length,whiteSpace:getComputedStyle(node).whiteSpace,text:node.textContent}
      })
      assert.equal(titleLayout.lines,1)
      assert.equal(titleLayout.whiteSpace,'nowrap')
      assert.equal(titleLayout.text,sample)
      const titleBox=await profileTitle.boundingBox(), copyBox=await profileView.locator('.rh-copy-id').boundingBox()
      assert.ok(copyBox.x >= titleBox.x+titleBox.width-1)
      const headerBox=await profileView.locator('.rh-profile-header').boundingBox()
      assert.ok(copyBox.x+copyBox.width <= headerBox.x+headerBox.width)
    }
  }
  await profileTitle.evaluate((node,text)=>{node.textContent=text},'芙莉莲')
  await page.mouse.move(4,4)
  await profileView.locator('.rh-profile-header').screenshot({path:path.join(out,'中文名字完整单行_模拟数据.png')})
  await profileTitle.evaluate((node,text)=>{node.textContent=text},originalTitle)
  await page.setViewportSize({width:1450,height:940})
  assert.equal(await profileView.locator('.rh-profile').getByText(/已加载/).count(),0)
  for (const name of ['刷新','显示设置','搜索玩家']) assert.equal(await profileView.getByRole('button',{name,exact:true}).textContent(),'')
  assert.equal(await profileView.locator('.rh-profile-tag').textContent(),'#DEMO')
  assert.equal(await profileView.locator('.rh-profile .rh-eyebrow').count(),0)
  await profileView.getByRole('button',{name:'复制玩家 ID',exact:true}).click()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()),'练习星轨#DEMO')
  assert.ok((await rankCards.first().evaluate((node) => getComputedStyle(node).backgroundColor)).startsWith('rgba('))
  await rankCards.first().click()
  const rankHistory = page.getByRole('region',{name:'历史段位详情'})
  await rankHistory.getByText('上赛季最高',{exact:true}).waitFor()
  await rankHistory.getByText('璀璨钻石 II',{exact:true}).waitFor()
  await rankHistory.getByText('华贵铂金 I',{exact:true}).waitFor()
  await page.keyboard.press('Escape')
  await rankHistory.waitFor({state:'hidden'})
  const miniName = profileView.locator('.rh-mini-roster button').first()
  assert.equal(await miniName.textContent(),'练习星轨')
  assert.equal(await miniName.getAttribute('title'),null)
  assert.equal(await miniName.getAttribute('aria-label'),'练习星轨#DEMO')
  await miniName.locator('.rh-player-name').hover()
  await tooltip.getByText('练习星轨#DEMO',{exact:true}).waitFor()
  assert.ok(await tooltip.evaluate((node) => node.classList.contains('rh-identity-tooltip')))
  assert.equal(await tooltip.evaluate((node) => getComputedStyle(node).backgroundColor),'rgb(28, 44, 64)')
  await page.mouse.move(4,4)
  await tooltip.waitFor({state:'hidden'})
  assert.deepEqual(await rankCards.locator('.rh-rank-peak').allTextContents(), ['赛季最高璀璨钻石 I','赛季最高超凡大师'])
  assert.deepEqual(await rankCards.locator('.rh-rank-crest').evaluateAll((icons) => icons.map((icon) => icon.getAttribute('src'))), [
    '/fe/lol-shared-components/emerald.png',
    '/fe/lol-shared-components/diamond.png',
  ])
  unrankedProfile = true
  await profileView.getByRole('button',{name:'刷新',exact:true}).click()
  const emptyEmblems = rankCards.locator('img.rh-rank-crest[src="/fe/lol-shared-components/unranked.png"]')
  await emptyEmblems.nth(1).waitFor()
  await emptyEmblems.evaluateAll((icons)=>Promise.all(icons.map((icon)=>icon.decode())))
  await profileView.locator('.rh-ranks').screenshot({path:path.join(out,'未定级完整徽章_真实资源.png')})
  unrankedProfile = false
  await profileView.getByRole('button',{name:'刷新',exact:true}).click()
  await rankCards.locator('img[src="/fe/lol-shared-components/emerald.png"]').waitFor()
  await profileView.locator('.rh-match').nth(48).waitFor()
  await profileView.getByRole('button',{name:'显示设置',exact:true}).click()
  await settings.getByRole('checkbox',{name:'伤转率',exact:true}).check()
  await profileView.locator('[data-testid="history-performance"] [data-stat="damageGold"]').waitFor()
  await settings.getByRole('button',{name:'完成',exact:true}).click()
  await settings.waitFor({state:'hidden'})
  await profileView.getByRole('button',{name:'显示设置',exact:true}).click()
  assert.equal(await settings.getByRole('checkbox',{name:'伤转率',exact:true}).isChecked(),true)
  await settings.getByRole('checkbox',{name:'伤转率',exact:true}).uncheck()
  await settings.getByRole('checkbox',{name:'对局卡片的双方阵容'}).uncheck()
  assert.equal(await profileView.locator('.rh-mini-roster').count(),0)
  assert.ok(await profileView.locator('.rh-match-main-no-roster').first().isVisible())
  await settings.getByRole('button',{name:'恢复本页默认'}).click()
  await settings.getByRole('button',{name:'完成',exact:true}).click()
  await settings.waitFor({state:'hidden'})
  assert.ok(await profileView.locator('.rh-mini-roster').first().isVisible())
  const firstItem = profileView.locator('.rh-match .rh-item-slot[tabindex]').first()
  await firstItem.hover()
  await tooltip.getByText('明朗之靴',{exact:true}).waitFor()
  await tooltip.getByText('明朗之靴 · 离线演示图标',{exact:true}).waitFor()
  assert.equal(await firstItem.locator('[title]').count(),0)
  assert.equal(await tooltip.evaluate((element) => getComputedStyle(element).backgroundColor),'rgb(28, 44, 64)')
  await page.mouse.move(4,4)
  await tooltip.waitFor({state:'hidden'})
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
  const searchPanel = page.getByTestId('history-player-search')
  const searchInput = searchPanel.getByRole('searchbox',{name:'玩家名称、编号或 PUUID'})
  const searchResult = searchPanel.locator('.rh-search-results')
  const friends = searchPanel.getByRole('region',{name:'好友',exact:true})
  const recent = searchPanel.getByRole('region',{name:'最近访问',exact:true})
  await profileView.getByRole('button',{name:'搜索玩家',exact:true}).click()
  await friends.getByRole('button',{name:'查看 雨后回声#DEMO 的战绩'}).waitFor()
  for (const [index, label, color] of [
    [2,'在线','rgb(36, 189, 130)'], [3,'离线','rgb(115, 127, 139)'],
    [4,'游戏中','rgb(0, 200, 223)'], [5,'队列中','rgb(0, 200, 223)'],
    [6,'离开','rgb(232, 64, 87)'], [7,'游戏中','rgb(0, 200, 223)'],
  ]) {
    const dot = friends.getByRole('button',{name:`查看 ${names[index]}#DEMO 的战绩`}).locator('.rh-search-status')
    assert.equal(await dot.getAttribute('aria-label'),label)
    assert.equal(await dot.evaluate((node) => getComputedStyle(node).backgroundColor),color)
  }
  await recent.getByRole('button',{name:'查看 练习星轨#DEMO 的战绩'}).waitFor()
  await friends.getByRole('searchbox').fill('雨后')
  assert.equal(await friends.locator('.rh-search-player').count(),1)
  assert.equal(await friends.locator('.rh-search-status').getAttribute('aria-label'),'在线')
  await friends.getByRole('button',{name:'查看 雨后回声#DEMO 的战绩'}).click()
  await profileView.getByRole('heading', {name:'雨后回声#DEMO',exact:true}).waitFor()
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('button',{name:'搜索玩家',exact:true}).click()
  await recent.getByRole('button',{name:'查看 雨后回声#DEMO 的战绩'}).click()
  await profileView.getByRole('heading', {name:'雨后回声#DEMO',exact:true}).waitFor()
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('button',{name:'搜索玩家',exact:true}).click()
  await searchPanel.screenshot({path:path.join(out,'玩家搜索_模拟数据.png')})
  await searchPanel.getByRole('button',{name:'合区参照',exact:true}).click()
  await searchPanel.getByText(/皮尔特沃夫/).waitFor()
  await searchPanel.getByRole('button',{name:'联盟一区',exact:true}).click()
  assert.equal(await searchPanel.getByLabel('搜索大区').inputValue(),'TENCENT_NJ100')
  await page.keyboard.press('Escape')
  await searchPanel.waitFor({state:'hidden'})
  await page.locator('.sona-modal-overlay.sona-modal-closing').waitFor({state:'hidden'})
  await searchPlayer.fill('薄荷汽水')
  await searchPlayer.press('Enter')
  await searchResult.getByRole('button',{name:'查看 薄荷汽水#DEMO 的战绩'}).waitFor()
  await searchInput.fill('全区')
  await searchInput.press('Enter')
  await searchResult.getByText('33 位玩家',{exact:true}).waitFor()
  assert.equal(await searchResult.locator('.rh-search-player').count(),33)
  assert.deepEqual(accountSearchBatches,[16,16,1])
  await searchInput.fill('薄荷汽水＃DEMO')
  await searchInput.press('Enter')
  await searchResult.getByRole('button',{name:'查看 薄荷汽水#DEMO 的战绩'}).click()
  await profileView.getByRole('heading', {name:'薄荷汽水#DEMO',exact:true}).waitFor()
  await profileView.getByText('流光翡翠 I',{exact:true}).waitFor()
  assert.equal(await profileView.locator('.rh-rank-card-heading small').count(),0)
  assert.equal(await profileView.locator('.rh-rank-card').getByText(/0 负/).count(),0)
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('heading', {name:'练习星轨#DEMO',exact:true}).waitFor()
  await profileView.getByRole('button',{name:'搜索玩家',exact:true}).click()
  await recent.getByRole('button',{name:'查看 薄荷汽水#DEMO 的战绩'}).waitFor()
  await searchInput.fill(ids[2])
  await searchInput.press('Enter')
  await searchResult.getByRole('button',{name:'查看 雨后回声#DEMO 的战绩'}).click()
  await profileView.getByRole('heading', {name:'雨后回声#DEMO',exact:true}).waitFor()
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('button',{name:'搜索玩家',exact:true}).click()
  await searchPanel.locator('option[value="TENCENT_HN10"]').waitFor({state:'attached'})
  await searchPanel.getByLabel('搜索大区').selectOption('TENCENT_HN10')
  await searchInput.fill('橘子信笺＃DEMO')
  await searchInput.press('Enter')
  await searchResult.getByRole('button',{name:'查看 橘子信笺#DEMO 的战绩'}).click()
  await profileView.getByRole('heading', {name:'橘子信笺#DEMO',exact:true}).waitFor()
  await profileView.locator('.rh-match').first().waitFor()
  await profileView.getByText('流光翡翠 I',{exact:true}).waitFor()
  await profileView.locator('.rh-profile').getByText('黑色玫瑰',{exact:true}).waitFor()
  for (const request of ['name','matches','ranks','profile']) assert.ok(crossRegionRequests.includes(request), request)
  await profileView.getByRole('button', {name:'‹ 返回'}).click()
  await profileView.getByRole('heading', {name:'练习星轨#DEMO',exact:true}).waitFor()
  await profileView.locator('.rh-match').first().waitFor()
  const encounterIcons = await profileView.locator('.rh-encounters img').evaluateAll((images) => images.map((img) => img.getAttribute('src')))
  assert.equal(encounterIcons.length, 9)
  assert.ok(encounterIcons.every((src) => src.includes('/profile-icons/')))
  await profileView.screenshot({path:path.join(out,'个人战绩_模拟数据.png')})
  const firstMatch = profileView.locator('.rh-match').first()
  assert.equal(await firstMatch.getByRole('button',{name:'下载回放',exact:true}).textContent(),'')
  await firstMatch.getByRole('button',{name:'下载回放',exact:true}).click()
  const playReplay = firstMatch.getByRole('button',{name:'播放回放',exact:true})
  await playReplay.waitFor()
  assert.equal(await playReplay.textContent(),'')
  assert.deepEqual(replayActions,['download'])
  await playReplay.click()
  await playReplay.waitFor()
  assert.deepEqual(replayActions,['download','watch'])
  const expandReport = firstMatch.getByRole('button',{name:'展开详细战报',exact:true})
  assert.equal(await expandReport.textContent(),'')
  await expandReport.click()
  await profileView.getByText('10 人详细战报',{exact:true}).waitFor()
  const report = profileView.locator('.rh-report')
  assert.equal(await report.locator('tbody tr:not(.rh-team-divider)').count(),10)
  assert.equal(await report.locator('.rh-report-bar').count(),30)
  assert.equal(await report.locator('.rh-report-bar-fill > .rh-report-bar-physical').count(),19)
  assert.equal(await report.locator('.rh-report-bar-fill > .rh-report-bar-unknown').count(),1)
  const firstDamageBar = report.locator('.rh-report-bar').first()
  assert.equal(await firstDamageBar.getAttribute('aria-label'),'物理 2,300 · 魔法 1,840 · 真实 460')
  assert.equal(await firstDamageBar.locator('span').first().evaluate((element) => element.style.width),'50%')
  assert.ok(await firstDamageBar.locator('.rh-report-bar-fill').evaluate((element) => parseFloat(element.style.width) < 20))
  await report.screenshot({path:path.join(out,'伤害条_模拟数据.png')})
  assert.equal(await report.getByRole('button',{name:'显示设置',exact:true}).count(),0)
  await profileView.getByRole('button',{name:'显示设置',exact:true}).click()
  await settings.getByRole('button',{name:'单场详细战报',exact:true}).click()
  await settings.getByRole('checkbox',{name:'伤转率',exact:true}).check()
  assert.equal(await report.getByRole('columnheader',{name:'伤转率',exact:true}).count(),1)
  await settings.getByRole('checkbox',{name:'伤转率',exact:true}).uncheck()
  await settings.getByRole('checkbox',{name:'承伤与占比',exact:true}).uncheck()
  assert.equal(await report.getByRole('columnheader',{name:'承伤 / 占比'}).count(),0)
  assert.equal(await report.locator('.rh-team-divider td').first().getAttribute('colspan'),'7')
  assert.deepEqual(await page.evaluate(() => window.DataStore.get('sona:historyHiddenFields').report),['taken'])
  await page.keyboard.press('Escape')
  await settings.waitFor({state:'hidden'})
  assert.ok(await report.isVisible())
  await profileView.getByRole('button',{name:'显示设置',exact:true}).click()
  await settings.getByRole('button',{name:'单场详细战报',exact:true}).click()
  assert.equal(await settings.getByRole('checkbox',{name:'承伤与占比',exact:true}).isChecked(),false)
  await settings.getByRole('checkbox',{name:'伤害、承伤与经济条'}).uncheck()
  assert.equal(await report.locator('.rh-report-bar').count(),0)
  assert.equal(await report.getByRole('columnheader',{name:'伤害 / 占比',exact:true}).count(),1)
  await settings.screenshot({path:path.join(out,'战绩显示设置_模拟数据.png')})
  await settings.getByRole('button',{name:'恢复本页默认'}).click()
  await settings.getByRole('button',{name:'完成',exact:true}).click()
  await settings.waitFor({state:'hidden'})
  assert.equal(await report.locator('.rh-report-bar').count(),30)
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
  await profileView.getByText('已加载完毕',{exact:true}).waitFor()
  assert.equal(await profileView.locator('.rh-match').count(),66)
  assert.ok(counts.some((entry)=>entry.start===50))
  slowQueue = 420
  await profileView.getByLabel('游戏模式').selectOption('420')
  await profileView.getByLabel('游戏模式').selectOption('2400')
  await profileView.locator('.rh-match').first().waitFor()
  assert.ok((await profileView.locator('.rh-match-meta > span:first-child').allTextContents()).every((line)=>line.includes('海克斯大乱斗')))
  await profileView.locator('.rh-augments').first().waitFor()
  const rarityIcons = profileView.locator('.rh-augments').first()
  assert.equal(await rarityIcons.locator('.rh-augment-gold').evaluate((node) => getComputedStyle(node).borderTopColor),'rgb(180, 164, 113)')
  assert.equal(await rarityIcons.locator('.rh-augment-silver').evaluate((node) => getComputedStyle(node).borderTopColor),'rgb(97, 115, 122)')
  assert.equal(await rarityIcons.locator('.rh-augment-prismatic').evaluate((node) => getComputedStyle(node).borderTopColor),'rgb(189, 140, 219)')
  assert.equal(augmentRequests,0)
  const firstAugment = profileView.locator('.rh-augment-slot').first()
  await firstAugment.hover()
  await tooltip.getByText('演示强化 101',{exact:true}).waitFor()
  await tooltip.getByText('黄金强化',{exact:true}).waitFor()
  await tooltip.getByText(/命中敌人时获得额外移速/).waitFor()
  assert.equal(await firstAugment.locator('[title]').count(),0)
  assert.equal(augmentRequests,1)
  await tooltip.screenshot({path:path.join(out,'海克斯说明_模拟数据.png')})
  await profileView.locator('.rh-augment-slot').nth(1).focus()
  await page.mouse.move(4,4)
  await tooltip.getByText('演示强化 102',{exact:true}).waitFor()
  assert.equal(augmentRequests,1)
  failSgp = true
  await profileView.getByLabel('游戏模式').selectOption('450')
  await profileView.getByText('当前范围为最近 100 场。',{exact:true}).waitFor()
  await profileView.locator('.rh-expand').first().click()
  await profileView.getByRole('button',{name:'治疗、控制与视野'}).click()
  await profileView.getByText('护盾 —',{exact:true}).first().waitFor()
  failSgp = false
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  await themeCard.getByRole('button',{name:'深色蓝灰',exact:true}).click()
  await themeCard.getByRole('button',{name:'客户端（黑金）',exact:true}).click()
  assert.equal(await page.locator('html').getAttribute('data-sona-theme'),'client')
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
  await matchupPanel.getByText('32.0%',{exact:true}).waitFor()
  await page.keyboard.press('Escape')
  await matchupPanel.waitFor({state:'hidden'})
  const bpEntry = page.getByRole('button',{name:'对局信息',exact:true})
  await bpEntry.waitFor()
  await page.evaluate(() => {
    const container = document.querySelector('.bottom-right-buttons')
    window.qaRemovedEntryHost = {container, parent:container.parentNode, next:container.nextSibling}
    container.remove()
  })
  await page.locator('[data-sona-team-history]').waitFor({state:'detached'})
  await page.evaluate(() => {
    const {container,parent,next} = window.qaRemovedEntryHost
    parent.insertBefore(container,next)
  })
  await bpEntry.waitFor()
  assert.equal(await bpEntry.evaluate((node) => node.parentElement.classList.contains('bottom-right-buttons')),true)
  bp.queueId = 0
  mixedTeamRanks = true
  await bpEntry.click()
  const bpView = page.getByTestId('bp-history')
  await bpView.locator('.rh-team-card').nth(4).waitFor()
  assert.equal(await bpView.locator('.rh-team-card').count(),5)
  await bpView.getByText('练习星轨#DEMO',{exact:true}).waitFor()
  await bpView.getByRole('heading',{name:'对局详情',exact:true}).waitFor()
  assert.equal(await bpView.getByLabel('队伍战绩范围').inputValue(),'440')
  assert.equal(await bpView.getByRole('option',{name:'本局模式',exact:true}).count(),0)
  bp.queueId = 440
  const firstTwoNames = bpView.locator('.rh-team-identity > strong').and(bpView.locator('.rh-team-card:nth-child(-n+2) strong'))
  assert.deepEqual(await firstTwoNames.locator('.rh-player-name-text').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color)), ['rgb(214, 181, 120)','rgb(214, 181, 120)'])
  assert.ok(await firstTwoNames.locator('.rh-id-tag').first().evaluate((node) => getComputedStyle(node).color !== getComputedStyle(node.previousElementSibling).color))
  assert.equal(await bpView.getByText('白昼拾荒#DEMO',{exact:true}).count(),0)
  await bpView.locator('.rh-team-card-stats').nth(4).waitFor()
  const rankRows = bpView.locator('.rh-team-card').first().locator('.rh-team-rank-row')
  await rankRows.nth(1).waitFor()
  assert.deepEqual(await rankRows.allTextContents(), ['55 LP','40 LP'])
  assert.deepEqual(await rankRows.locator('img').evaluateAll((icons) => icons.map((icon) => icon.getAttribute('src'))), [
    '/fe/lol-static-assets/images/ranked-mini-crests/emerald.svg',
    '/fe/lol-static-assets/images/ranked-mini-crests/diamond.svg',
  ])
  assert.equal(await rankRows.first().getAttribute('aria-label'), '单双排 · 流光翡翠 I · 55 LP')
  assert.equal((await rankRows.nth(1).boundingBox()).y, (await rankRows.first().boundingBox()).y)
  await bpView.locator('.rh-team-rank-icon-bronze').first().waitFor()
  await bpView.locator('.rh-team-rank-icon-unranked').first().waitFor()
  const crestSizes = await bpView.locator('.rh-team-rank-icon').evaluateAll(async (nodes) => {
    const selected = [...new Map(nodes.filter((node)=>/\/(bronze|emerald|unranked)\.svg$/.test(node.src)).map((node)=>[node.src,node])).values()]
    await Promise.all(selected.map((node)=>node.decode()))
    return selected.map((node) => {
      const style = getComputedStyle(node), transform = new DOMMatrixReadOnly(style.transform)
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160
      const ctx = canvas.getContext('2d'), scale = 160 / Math.max(node.naturalWidth,node.naturalHeight)
      ctx.translate(80,80); ctx.scale(transform.a,transform.d)
      ctx.drawImage(node,-node.naturalWidth*scale/2,-node.naturalHeight*scale/2,node.naturalWidth*scale,node.naturalHeight*scale)
      const pixels = ctx.getImageData(0,0,160,160).data
      let left = 160, right = -1
      for (let y=0;y<160;y++) for (let x=0;x<160;x++) if (pixels[(y*160+x)*4+3]>32) { left=Math.min(left,x); right=Math.max(right,x) }
      return {tier:node.src.split('/').at(-1),fit:style.objectFit,width:style.width,height:style.height,visibleWidth:(right-left+1)/10}
    })
  })
  assert.equal(crestSizes.length,3)
  for (const size of crestSizes) { assert.equal(size.fit,'contain'); assert.equal(size.width,'16px'); assert.equal(size.height,'16px') }
  assert.ok(Math.max(...crestSizes.map((size)=>size.visibleWidth))-Math.min(...crestSizes.map((size)=>size.visibleWidth))<.8,JSON.stringify(crestSizes))
  const portrait = bpView.locator('.rh-team-card').first().locator('.rh-team-portrait img')
  assert.ok((await portrait.getAttribute('src')).includes('/profile-icons/'))
  const lockedBp = { ...bp, myTeam:bp.myTeam.map((member,index) => index === 0 ? {...member,championId:157} : member), actions:[[{...bp.actions[0][0],completed:true}]] }
  await page.evaluate((session) => window.qaEmit('/lol-champ-select/v1/session',session),lockedBp)
  await bpView.locator('.rh-team-portrait img[src$="/champion-icons/157.png"]').waitFor()
  assert.equal(await bpView.locator('.rh-team-selection img').count(),0)
  assert.ok(await bpView.locator('.rh-champion-strip button > span:last-child').first().isHidden())
  await bpView.getByRole('button',{name:'显示设置',exact:true}).click()
  assert.equal(await settings.getByRole('checkbox',{name:'伤转率',exact:true}).isChecked(),true)
  await bpView.locator('[data-stat="damageGold"]').nth(4).waitFor()
  await settings.getByRole('searchbox',{name:'搜索显示选项'}).fill('分均')
  await settings.getByRole('button',{name:'全选数据',exact:true}).click()
  await bpView.locator('[data-stat="damageMinute"]').nth(4).waitFor()
  assert.ok((await page.evaluate(()=>window.DataStore.get('sona:historyPerformanceFields').team)).includes('damageGold'))
  await settings.getByRole('searchbox',{name:'搜索显示选项'}).fill('')
  await settings.screenshot({path:path.join(out,'玩家数据可选项_模拟数据.png')})
  await settings.getByRole('button',{name:'恢复本页默认'}).click()
  await settings.getByRole('checkbox',{name:'最近对局',exact:true}).uncheck()
  assert.equal(await bpView.locator('.rh-team-recent-list').count(),0)
  await settings.getByRole('button',{name:'恢复本页默认'}).click()
  await settings.getByRole('button',{name:'完成',exact:true}).click()
  await settings.waitFor({state:'hidden'})
  assert.equal(await bpView.locator('.rh-team-recent-list').count(),5)
  await bpView.getByLabel('队伍战绩范围').selectOption('2400')
  await bpView.locator('.rh-team-match').first().getByText('海克斯大乱斗', {exact:true}).waitFor()
  await bpView.getByLabel('队伍战绩范围').selectOption('440')
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
  await profileView.locator('.rh-score[data-score-system="akari"]').waitFor()
  const bothRequests = counts.length
  await scoreSwitch.evaluate((button)=>button.click())
  await profileView.locator('.rh-score[data-score-system="sona"]').waitFor()
  await bpView.locator('[data-score-system="sona"]').nth(4).waitFor()
  await scoreSwitch.evaluate((button)=>button.click())
  await profileView.locator('.rh-score[data-score-system="akari"]').waitFor()
  await bpView.locator('[data-score-system="akari"]').nth(4).waitFor()
  assert.equal(counts.length,bothRequests)
  assert.equal(await profileView.getByLabel('游戏模式').inputValue(),'440')
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  assert.ok(await bpView.isVisible())
  await page.keyboard.press('Escape')
  await bpView.waitFor({state:'hidden'})
  await page.evaluate(async (session) => {
    const { store } = await import('/src/lib/store.ts')
    store.set('opggBuildRecommendation',true)
    window.qaEmit('/lol-champ-select/v1/session',session)
  }, bp)
  const previewBuild = page.locator('[data-sona-opgg-preselect-build]')
  await previewBuild.waitFor()
  assert.ok((await previewBuild.boundingBox()).x < (await page.getByRole('button',{name:'锁定',exact:true}).boundingBox()).x)
  await previewBuild.click()
  const buildPanel = page.locator('#sona-opgg-build-panel')
  await buildPanel.locator('.sobp-title-name').getByText(/亚索/).waitFor()
  await buildPanel.locator('.sobp-close').click()
  bp.myTeam[0].championPickIntent = 103
  bp.actions[0][0].championId = 103
  await page.evaluate((session) => window.qaEmit('/lol-champ-select/v1/session',session), bp)
  await previewBuild.click()
  await buildPanel.locator('.sobp-title-name').getByText(/阿狸/).waitFor()
  await buildPanel.locator('.sobp-close').click()
  await page.evaluate(async () => {
    const { store } = await import('/src/lib/store.ts')
    store.set('opggBuildRecommendation',false)
  })
  await previewBuild.waitFor({state:'hidden'})
  const avatar = page.getByTestId('preview-avatar-0')
  await avatar.locator('[data-sona-particle]').waitFor({state:'attached'})
  await avatar.click({position:{x:24,y:24}})
  await profileView.locator('.rh-match').first().waitFor()
  assert.equal(await profileView.getByLabel('游戏模式').inputValue(),'440')
  await page.keyboard.press('Escape')
  await profileView.waitFor({state:'hidden'})
  await page.evaluate((session) => window.qaEmit('/lol-gameflow/v1/session',session),{...game,phase:'Lobby'})
  await bpEntry.waitFor({state:'detached'})
  await page.evaluate((session) => window.qaEmit('/lol-gameflow/v1/session',session),{...game,phase:'ChampSelect'})
  await bpEntry.waitFor()
  await page.getByRole('button',{name:'模拟进游戏'}).click()
  assert.equal(await page.getByRole('button',{name:'对局信息',exact:true}).count(),0)
  await page.getByRole('button',{name:'十人战绩总览',exact:true}).click()
  const gameView = page.getByTestId('game-history')
  await gameView.locator('.rh-team-card').nth(9).waitFor()
  assert.equal(await gameView.locator('.rh-team-card').count(),10)
  assert.equal(await gameView.locator('.rh-team-blue .rh-team-card').count(),5)
  assert.equal(await gameView.locator('.rh-team-red .rh-team-card').count(),5)
  await gameView.locator('.rh-team-card-stats').nth(9).waitFor()
  await gameView.getByText('组队 A',{exact:true}).first().waitFor()
  await page.mouse.move(4,4)
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
  await page.evaluate(() => window.scrollTo(0,0))
  async function assertProfile(name) {
    await profileView.getByRole('heading', { name, exact: true }).waitFor()
    await profileView.locator('.rh-match').first().waitFor()
    await page.keyboard.press('Escape')
    await profileView.waitFor({state:'hidden'})
  }
  const nativeEntry = page.locator('.sona-profile-history-entry')
  const ownEntry = page.locator('.rcp-fe-lol-profiles-main').locator(nativeEntry)
  await ownEntry.waitFor()
  await page.getByRole('button',{name:'编辑身份',exact:true}).click()
  await nativeEntry.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'关闭身份',exact:true}).click()
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
  await page.locator('.sona-profile-history-entry-inline').waitFor()
  const entryRect = await page.locator('.sona-profile-history-entry-inline').boundingBox()
  const replayRect = await page.getByTestId('qa-native-replay').boundingBox()
  assert.ok(entryRect.x + entryRect.width <= replayRect.x || replayRect.x + replayRect.width <= entryRect.x ||
    entryRect.y + entryRect.height <= replayRect.y || replayRect.y + replayRect.height <= entryRect.y)
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
  await page.getByText('好友玩家',{exact:true}).click({button:'right'})
  const friendMenu = page.locator('.qa-friend-context-menu')
  await friendMenu.getByRole('button',{name:'详细战绩',exact:true}).waitFor()
  assert.equal(await friendMenu.getByRole('button',{name:'查看生涯',exact:true}).count(),1)
  assert.equal(await friendMenu.getByRole('button',{name:'详细战绩',exact:true}).locator('.menu-item-icon.icon-profile').count(),1)
  await friendMenu.getByRole('button',{name:'详细战绩',exact:true}).click()
  await assertProfile('云端烟火#DEMO')
  await page.getByText('结算玩家', {exact:true}).click({button:'right'})
  const actions = page.locator('.player-actions-menu-container')
  assert.equal(await actions.getByRole('button', {name:'查看资料'}).count(),1)
  await actions.getByRole('button', {name:'详细战绩'}).click()
  await assertProfile('白昼拾荒#DEMO')
  assert.equal(errors.length,0,errors.join('\n'))
  assert.equal(writes.length,0,writes.join('\n'))
  console.log(JSON.stringify({result:'passed', checks:['current, peak and previous ranks', 'split, copyable and hover-only Riot IDs', 'single-button replay download and playback', 'icon-only report expansion', 'segmented bars and missing breakdown', 'equipment and Mayhem tooltips', 'display settings for team, personal and report', 'shared and persisted plugin theme', 'name, Riot ID and PUUID search', 'friends, visits and region reference', 'cross-region profile, ranks and matches', 'native locked enemy row with nonstandard portrait path', 'ranked and custom draft gating', 'Korean lane/tier queries and no-data state', 'champion filter toggle and damage badge', 'personal history', 'player search and return', 'encounter profile icons', 'filters and pagination', 'native fallback', 'BP party colors and game ten', 'recent match detail', 'transparent nested scrollbars', 'nested Escape', 'phase exit', '1000px layout', 'native search clearance and exclusive profile entry', 'history and postgame context menus', 'no unexpected writes or page errors'], requests:counts.length, blockedUnrelatedExternal:[...new Set(external)]},null,2))
} finally {
  await browser?.close()
  await server.close()
}
