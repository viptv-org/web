/** Isolated local-HTTPS acceptance. No request ever reaches a live API.
 * Run after staging the reviewed worktree build: node tests/admin-v2.e2e.mjs
 * Screenshots and JSON evidence are private temporary artifacts, never committed.
 */
import { chromium, expect } from '/mnt/ALPH/code/viptv-org/tv-web/node_modules/@playwright/test/index.mjs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'https://viptv.local.test:8443';
const captures = await mkdtemp(join(tmpdir(), 'viptv-admin-v2-'));
const accountPages = ['Account', 'Devices', 'Continue Watching', 'My List', 'History', 'Add-ons', 'Xtream connections', 'VOD matches', 'Gateways'];
const operatorPages = ['Overview', 'Accounts', 'Gateway grants'];
const connection = { id: 1, name: 'Fixture IPTV', enabled: true, enable_live: true, enable_movies: true, enable_series: true, credentials_encrypted: true, refresh: { state: 'completed' } };
const gateway = { id: 'gateway_fixture', name: 'Fixture gateway', endpoint: 'https://gateway.fixture.invalid/', namespace: 'fixture', priority: 100, enabled: true, revision: 1, can_manage: true };
const profile = { id: 1, name: 'Fixture profile', setup_complete: true, is_primary: true, avatar_style: 'critters', avatar_seed: 'fixture' };
const movie = { id: 'tt0133093', name: 'Fixture film', type: 'movie', position: 15, duration: 100, watched: false };
const settledText={'Account':'Fixture account','Devices':'Fixture television','Continue Watching':'Fixture film','My List':'Fixture film','History':'Fixture film','Add-ons':'Fixture add-on','Xtream connections':'Fixture IPTV','VOD matches':'Fixture title 0','Gateways':'Fixture gateway','Overview':'Backend reachable','Accounts':'Fixture account','Gateway grants':'Fixture gateway'};
function fixture(state, request) {
  const url = new URL(request.url()); const path = url.pathname; const method = request.method();
  if (path === '/api/auth/status') return { authenticated: true, csrf_token: 'fixture_csrf' };
  if (path === '/api/auth/me') return { account: { id: 1, username: 'fixture', name: 'Fixture account', role: state.role }, profile_id: 1 };
  if (path === '/api/profiles') return [profile];
  if (path === '/api/accounts') return [{id:1,username:'fixture',name:'Fixture account',role:state.role,enabled:true}];
  if (path === '/api/health') return { ok: true };
  if (path === '/api/devices') return [{ id:'device_fixture',name:'Fixture television',model:'Fixture TV' }];
  if (path === '/api/parent/status') return { pin_configured: false, unlocked: true, restricted: false };
  if (path.endsWith('/kids')) return { enabled: false, max_age: 12 };
  if (path.endsWith('/approvals')) return [];
  if (path.endsWith('/preferences')) return { audio_language:'en',subtitle_language:'en',subtitles_enabled:false,subtitle_size:'normal',subtitle_style:'system',autoplay:false };
  if (path.endsWith('/continue/settings')) return { autoplay: false };
  if (/\/(favorites|progress|continue)\/page$/.test(path)) return {items:[movie],total:1,next_offset:null,offset:0};
  if (path === '/api/v2/iptv/live-default') return {catalog_id:1};
  if (path === '/api/v2/iptv/connections') return {items:state.mode==='empty'?[]:[connection],next_cursor:null};
  if (path === '/api/v2/addons') return {items:state.mode==='empty'?[]:[{id:7,name:'Fixture add-on',enabled:true,credentials_encrypted:true,logo:'https://external.fixture.invalid/icon.png',manifest_url:null}],next_cursor:null};
  if (path === '/api/v2/gateways') return {items:state.mode==='empty'?[]:[gateway],secret_storage_configured:true};
  if (path.endsWith('/grants')) return method==='GET'?{items:[{account_id:2,enabled:true}],next_cursor:null}:{ok:true};
  if (path.endsWith('/check')) return {ready:true,version:1,available:{inputs:0,outputs:2,viewers:3}};
  if (path === '/api/v2/iptv/matches') {
    if (method==='PUT') { state.saved.push(request.postDataJSON()); return {ok:true}; }
    const offset = Number(url.searchParams.get('cursor')?.slice(7) || 0);
    const items = state.mode==='empty'?[]:Array.from({length:Math.min(50,100000-offset)},(_,i)=>({vod_id:`vod:1:${offset+i}`,provider_id:1,type:'movie',name:`Fixture title ${offset+i}`,year:2020}));
    return {items,next_cursor:state.mode==='empty'||offset+50>=100000?null:`cursor_${offset+50}`};
  }
  throw new Error(`Unmocked API route: ${method} ${path}`);
}
async function install(context, state) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { state.externalBlocked.push(url.hostname); return route.abort('blockedbyclient'); }
    if (!url.pathname.startsWith('/api')) return route.continue();
    state.apiCalls.push({path:url.pathname+url.search,method:route.request().method()});
    if (url.pathname==='/api/v2/iptv/connections' && state.mode==='error') return route.fulfill({status:503,json:{error:'Fixture connection temporarily unavailable. Try again.',error_code:'provider_unavailable'}});
    if (url.pathname==='/api/v2/iptv/connections' && state.mode==='slow') await new Promise(resolve=>{state.releaseSlow=resolve;});
    try { await route.fulfill({json:fixture(state,route.request())}); }
    catch (error) { state.unmocked.push(error.message); await route.fulfill({status:501,json:{error:'Fixture route missing.',error_code:'fixture_missing'}}); }
  });
}
async function navigate(page, name, mobile) {
  if (mobile) await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Navigation'})).toHaveCount(0);
}
async function overflow(page, label) {
  const size=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  expect(size.document,`${label}: document overflow ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.width+1);
  expect(size.body,`${label}: body overflow ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.width+1);
}
const browser=await chromium.launch({headless:true}); const evidence=[];let lastState;
try {
  const viewports=process.argv.includes('--mobile-only')?[{width:390,height:844}]:[{width:1440,height:900},{width:390,height:844}];
  for (const viewport of viewports) {
    const mobile=viewport.width<768;
    const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
    const state={role:'owner',mode:'normal',apiCalls:[],unmocked:[],externalBlocked:[],saved:[]};lastState=state;await install(context,state);
    const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await expect(page.getByRole('heading',{name:'Account',exact:true,level:1})).toBeVisible();
    const asset=await page.locator('script[type="module"]').getAttribute('src');
    for (const name of [...accountPages,...operatorPages]) {
      await navigate(page,name,mobile);await page.waitForLoadState('networkidle');
      await expect(page.getByText(settledText[name],{exact:true})).toBeVisible();
      await expect(page.locator('[role="status"][aria-label="Loading"]')).toHaveCount(0);
      await expect(page.getByText(/Loading (connections|gateways|titles)…/)).toHaveCount(0);
      await page.mouse.move(viewport.width-2,viewport.height-2);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await overflow(page,`${viewport.width} ${name}`);
      await page.screenshot({path:join(captures,`${viewport.width}-${name.toLowerCase().replaceAll(' ','-')}.png`),fullPage:true});
    }
    await page.getByRole('button',{name:'Check Fixture gateway'}).click();
    await expect(page.getByText('Available inputs: 0 · Outputs: 2 · Viewers: 3',{exact:true})).toBeVisible();
    await page.screenshot({path:join(captures,`${viewport.width}-gateway-capacity.png`),fullPage:true});
    await page.getByRole('button',{name:'Manage grants for Fixture gateway'}).click();
    await expect(page.getByRole('button',{name:'Revoke account 2'})).toBeVisible();
    await overflow(page,`${viewport.width} grants dialog`);
    await page.screenshot({path:join(captures,`${viewport.width}-grants-dialog.png`)});
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
    await navigate(page,'VOD matches',mobile);
    const region=page.getByRole('region',{name:'Unmatched provider titles'});
    await expect(page.getByText('Fixture title 0',{exact:true})).toBeVisible();
    await expect(page.getByText('Loading titles…')).toHaveCount(0);await page.waitForLoadState('networkidle');
    await expect.poll(()=>region.evaluate(node=>node.scrollHeight)).toBe(50*(mobile?184:112)+1);
    for(let step=0;step<10;step++) {
      const before=state.apiCalls.filter(call=>call.path.startsWith('/api/v2/iptv/matches?')).length;
      state.scrollAttempts??=[];state.scrollAttempts.push(await region.evaluate(node=>{const before=node.scrollTop;const children=[...node.children].filter(child=>child.hasAttribute('aria-hidden')).map(child=>({style:child.getAttribute('style'),display:getComputedStyle(child).display,height:getComputedStyle(child).height}));node.scrollTop=node.scrollHeight;const immediate=node.scrollTop;node.dispatchEvent(new Event('scroll',{bubbles:true}));return {before,immediate,afterDispatch:node.scrollTop,height:node.clientHeight,total:node.scrollHeight,children};}));
      await expect.poll(()=>state.apiCalls.filter(call=>call.path.startsWith('/api/v2/iptv/matches?')).length).toBeGreaterThan(before);
      await expect(page.getByText('Loading titles…')).toHaveCount(0);
      await expect.poll(async()=>{
        const loaded=state.apiCalls.filter(call=>call.path.startsWith('/api/v2/iptv/matches?')).reduce((maximum,call)=>Math.max(maximum,Number(new URL(origin+call.path).searchParams.get('cursor')?.slice(7)||0)+50),50);
        return await region.evaluate(node=>node.scrollHeight)-(loaded*(mobile?184:112)+1);
      }).toBe(0);
      expect(await page.locator('[data-match-id]').count()).toBeLessThanOrEqual(20);
    }
    await region.evaluate(node=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll',{bubbles:true}));});
    await expect.poll(()=>region.evaluate(node=>({top:node.scrollTop,spacer:node.firstElementChild.getBoundingClientRect().height}))).toEqual({top:0,spacer:0});
    await expect(page.getByText('Fixture title 0',{exact:true})).toBeVisible();
    const opener=page.locator('[data-match-id="vod:1:0"]').getByRole('button',{name:'Match title'});
    await opener.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Metadata ID')).toBeFocused();
    await overflow(page,`${viewport.width} match dialog`);await page.screenshot({path:join(captures,`${viewport.width}-match-dialog.png`)});
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(opener).toBeFocused();
    await opener.click();await page.getByLabel('Metadata ID').fill('tt0133093');await page.getByRole('button',{name:'Save match'}).click();
    await expect(page.locator('[data-match-id="vod:1:0"]').getByRole('button',{name:'Edit match'})).toBeVisible();expect(state.saved).toEqual([{vod_id:'vod:1:0',metadata_id:'tt0133093',type:'movie'}]);
    state.mode='empty';await navigate(page,'Add-ons',mobile);await expect(page.getByText('No add-ons',{exact:true})).toBeVisible();
    await navigate(page,'Xtream connections',mobile);await expect(page.getByText('No Xtream connections',{exact:true})).toBeVisible();
    await navigate(page,'VOD matches',mobile);await expect(page.getByText('No unmatched titles',{exact:true})).toBeVisible();
    await navigate(page,'Gateways',mobile);await expect(page.getByText('No gateways',{exact:true})).toBeVisible();
    state.mode='error';await navigate(page,'Xtream connections',mobile);await expect(page.getByRole('alert').filter({hasText:'Fixture connection temporarily unavailable'})).toBeVisible();
    await page.screenshot({path:join(captures,`${viewport.width}-connections-error.png`),fullPage:true});
    state.mode='normal';await page.getByRole('button',{name:'Try again',exact:true}).click();await expect(page.getByText('Fixture IPTV',{exact:true})).toBeVisible();
    state.mode='slow';await navigate(page,'Devices',mobile);await navigate(page,'Xtream connections',mobile);await expect(page.getByText('Loading connections…',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Add Xtream connection'})).toBeEnabled();
    await page.screenshot({path:join(captures,`${viewport.width}-connections-slow.png`),fullPage:true});
    state.mode='normal';state.releaseSlow();await expect(page.getByText('Fixture IPTV',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Add Xtream connection'}).click();await overflow(page,`${viewport.width} connection dialog`);
    await page.screenshot({path:join(captures,`${viewport.width}-connection-dialog.png`)});await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Add Xtream connection'})).toBeFocused();
    expect(state.unmocked).toEqual([]);expect(errors).toEqual([]);
    expect(state.apiCalls.filter(call=>call.path.startsWith('/api/v2/iptv/matches?')).every(call=>new URL(origin+call.path).searchParams.get('limit')==='50')).toBe(true);
    evidence.push({viewport,asset,pages:[...accountPages,...operatorPages],vodFixtureSize:100000,loadedPages:state.apiCalls.filter(call=>call.path.includes('cursor=cursor_')).length,apiCalls:state.apiCalls.length,externalBlocked:state.externalBlocked,pageErrors:errors});
    await context.close();
  }
  const member=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const state={role:'member',mode:'normal',apiCalls:[],unmocked:[],externalBlocked:[],saved:[]};await install(member,state);
  const page=await member.newPage();await page.goto(origin);await expect(page.getByRole('heading',{name:'Account',exact:true,level:1})).toBeVisible();
  for(const name of operatorPages)await expect(page.getByRole('navigation').getByRole('button',{name,exact:true})).toHaveCount(0);
  evidence.push({role:'member',operatorNavigationHidden:true});await member.close();
  await writeFile(join(captures,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({ok:true,captures,evidence},null,2));
} catch(error) {
  const diagnostics=[];
  for(const context of browser.contexts())for(const page of context.pages())diagnostics.push(await page.evaluate(()=>{
    const node=document.querySelector('.admin-match-scroll');const dialogs=[...document.querySelectorAll('[role=dialog]')].map(dialog=>({bounds:dialog.getBoundingClientRect().toJSON(),top:getComputedStyle(dialog).top,left:getComputedStyle(dialog).left,transform:getComputedStyle(dialog).transform,width:getComputedStyle(dialog).width}));return {dialogs,...(node?{top:node.scrollTop,height:node.clientHeight,total:node.scrollHeight,rows:[...node.querySelectorAll('[data-match-id]')].map(row=>row.getAttribute('data-match-id')),alerts:[...document.querySelectorAll('[role=alert]')].map(row=>row.textContent)}:{})};
  }).catch(()=>({})));
  for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:join(captures,'failure.png'),fullPage:true}).catch(()=>{});
  console.error(JSON.stringify({ok:false,captures,error:error.message,diagnostics,scrollAttempts:lastState?.scrollAttempts,apiCalls:lastState?.apiCalls,unmocked:lastState?.unmocked},null,2));process.exitCode=1;
} finally {await browser.close();}
