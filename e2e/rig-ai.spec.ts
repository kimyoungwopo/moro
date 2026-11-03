import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {parseProjectV2,exportLottieV2,createProjectV2,addLayerV2} from '../packages/creator-core/src/v2';
import {mountLottie,seekLottie} from './player-fixture';

// OFFLINE protocol fixture only. These intercepted tests are NOT live AI proof.
const fixture=async()=>{const p=parseProjectV2(await readFile('fixtures/creator-v2-articulated-curve.json','utf8'));return{...p,name:'OFFLINE fixture, not AI art'};};
async function save(page:Page,path:string){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save v2 project',exact:true}).click();await(await pending).saveAs(path);return parseProjectV2(await readFile(path,'utf8'));}
async function open(page:Page){await page.getByRole('button',{name:'AI generate v2',exact:true}).click();return page.getByRole('region',{name:'AI motion v2',exact:true});}
async function submit(page:Page,brief='A single curved object gently bows, with parent groups and a fixed pivot.'){
 const panel=page.getByRole('region',{name:'AI motion v2',exact:true});await panel.getByRole('combobox',{name:'AI provider',exact:true}).selectOption('codex');await panel.getByRole('textbox',{name:'Animation brief',exact:true}).fill(brief);await panel.getByRole('checkbox',{name:'I agree to send this brief to the selected AI provider.',exact:true}).check();await panel.getByRole('button',{name:'Generate proposal',exact:true}).click();await panel.getByRole('button',{name:'Confirm one AI request',exact:true}).click();return panel;
}
const status={ok:true,scope:'installed-only',providers:[{id:'codex',label:'Codex',installed:true},{id:'claude',label:'Claude Code',installed:false}]};

test('Rig AI v2 OFFLINE: consent, running, separate preview, Apply/save/reopen/export and one Undo',async({page,context},info)=>{
 test.setTimeout(90000);const proposal=await fixture();let posts=0,polls=0,allowResult=false;
 await page.route('**/api/ai/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/ai/status'){await route.fulfill({json:status});return;}
  if(path==='/api/ai/v2/jobs'&&req.method()==='POST'){posts++;expect(req.headers()['x-moro-request']).toBe('1');expect(req.postDataJSON()).toEqual({provider:'codex',prompt:'A single curved object gently bows, with parent groups and a fixed pivot.',consent:true});await route.fulfill({status:202,json:{ok:true,job:{id:'fixture-rig-v2',provider:'codex',status:'running'}}});return;}
  if(path==='/api/ai/jobs/fixture-rig-v2'&&req.method()==='GET'){polls++;await route.fulfill({json:{ok:true,job:allowResult?{id:'fixture-rig-v2',provider:'codex',status:'succeeded',project:proposal}:{id:'fixture-rig-v2',provider:'codex',status:'running'}}});return;}
  await route.fulfill({status:404,json:{ok:false,error:{code:'offline_fixture_only',message:'Unexpected offline route'}}});
 });
 await page.goto('/rig');const before=await save(page,info.outputPath('before.moro.json'));const panel=await open(page);await expect(panel.getByRole('button',{name:'Generate proposal',exact:true})).toBeDisabled();expect(posts).toBe(0);await submit(page);await expect(panel.getByRole('button',{name:'Cancel generation',exact:true})).toBeVisible();await expect.poll(()=>polls).toBeGreaterThan(0);expect(posts).toBe(1);expect(await save(page,info.outputPath('running.moro.json'))).toEqual(before);
 allowResult=true;const apply=panel.getByRole('button',{name:'Apply proposal',exact:true});await expect(apply).toBeEnabled();await expect(panel.getByTestId('rig-ai-preview').locator('svg')).toBeVisible();expect(await save(page,info.outputPath('review.moro.json'))).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await apply.click();expect(await save(page,info.outputPath('applied.moro.json'))).toEqual(proposal);const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export Lottie',exact:true}).click();const output=info.outputPath('animation.json');await(await pending).saveAs(output);const animation=JSON.parse(await readFile(output,'utf8'));expect(animation).toEqual(exportLottieV2(proposal));
 const fresh=await context.newPage();try{await fresh.goto('/rig');await fresh.getByLabel('Open v2 project file',{exact:true}).setInputFiles(info.outputPath('applied.moro.json'));expect(await save(fresh,info.outputPath('reopened.moro.json'))).toEqual(proposal);}finally{await fresh.close();}
 const independent=await context.newPage();try{await mountLottie(independent,animation);for(const f of[0,60,15,119,0])await seekLottie(independent,f);await expect(independent.locator('#independent svg path')).not.toHaveCount(0);}finally{await independent.close();}
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page,info.outputPath('undo.moro.json'))).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();expect(posts).toBe(1);
});

test('Rig AI v2 OFFLINE: stale result cannot replace edits made during generation',async({page},info)=>{
 const proposal=await fixture();let ready=false,posts=0;await page.route('**/api/ai/**',async route=>{const path=new URL(route.request().url()).pathname;
 if(path==='/api/ai/status'){await route.fulfill({json:status});return;}
 if(path==='/api/ai/v2/jobs'){posts++;await route.fulfill({status:202,json:{ok:true,job:{id:'stale-v2',provider:'codex',status:'running'}}});return;}
 if(path==='/api/ai/jobs/stale-v2'){await route.fulfill({json:{ok:true,job:ready?{id:'stale-v2',provider:'codex',status:'succeeded',project:proposal}:{id:'stale-v2',provider:'codex',status:'running'}}});return;}
 await route.fulfill({status:404,json:{ok:false,error:{code:'offline_fixture_only'}}});});
 await page.goto('/rig');await open(page);const panel=await submit(page);await expect(panel.getByRole('button',{name:'Cancel generation',exact:true})).toBeVisible();await page.getByRole('button',{name:'Add ellipse',exact:true}).click();const edited=await save(page,info.outputPath('edited.moro.json'));ready=true;const apply=panel.getByRole('button',{name:'Apply proposal',exact:true});await expect(apply).toBeVisible();if(await apply.isEnabled())await apply.click();expect(await save(page,info.outputPath('after-stale.moro.json'))).toEqual(edited);await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await save(page,info.outputPath('after-stale-undo.moro.json'))).layers).toHaveLength(0);expect(posts).toBe(1);
});

test('Rig AI v2 OFFLINE: cancel and malformed result preserve document and Undo',async({page},info)=>{
 let cancelled=false,mode:'running'|'invalid'='running',posts=0;await page.route('**/api/ai/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;
 if(path==='/api/ai/status'){await route.fulfill({json:status});return;}
 if(path==='/api/ai/v2/jobs'){posts++;cancelled=false;await route.fulfill({status:202,json:{ok:true,job:{id:'failure-v2',provider:'codex',status:'running'}}});return;}
 if(path==='/api/ai/jobs/failure-v2/cancel'){cancelled=true;expect(req.postDataJSON()).toEqual({});await route.fulfill({json:{ok:true,job:{id:'failure-v2',provider:'codex',status:'cancelled'}}});return;}
 if(path==='/api/ai/jobs/failure-v2'){await route.fulfill({json:{ok:true,job:mode==='invalid'?{id:'failure-v2',provider:'codex',status:'succeeded',project:{version:1,name:'Wrong schema'}}:{id:'failure-v2',provider:'codex',status:cancelled?'cancelled':'running'}}});return;}
 await route.fulfill({status:404,json:{ok:false,error:{code:'offline_fixture_only'}}});});
 await page.goto('/rig');const before=await save(page,info.outputPath('before.moro.json'));await open(page);const panel=await submit(page);await panel.getByRole('button',{name:'Cancel generation',exact:true}).click();await expect.poll(()=>cancelled).toBe(true);expect(await save(page,info.outputPath('cancelled.moro.json'))).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();mode='invalid';await submit(page,'Another small nonhuman object.');await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('button',{name:'Apply proposal',exact:true})).toHaveCount(0);expect(await save(page,info.outputPath('invalid.moro.json'))).toEqual(before);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();expect(posts).toBe(2);
});

test('Rig AI v2 OFFLINE: export-budget failure cannot crash or replace editable work',async({page},info)=>{
 let proposal=createProjectV2();for(let i=0;i<12;i++)proposal=addLayerV2(proposal,'rect');
 for(const layer of proposal.layers)for(const property of ['x','y','scale','rotation','opacity'] as const)layer.tracks[property]=Array.from({length:100},(_,frame)=>({frame,value:property==='scale'?frame+1:frame,easing:'linear' as const}));
 expect(()=>exportLottieV2(proposal)).toThrow();let posts=0;
 await page.route('**/api/ai/**',async route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/api/ai/status'){await route.fulfill({json:status});return;}
  if(path==='/api/ai/v2/jobs'){posts++;await route.fulfill({status:202,json:{ok:true,job:{id:'budget-v2',provider:'codex',status:'running'}}});return;}
  if(path==='/api/ai/jobs/budget-v2'){await route.fulfill({json:{ok:true,job:{id:'budget-v2',provider:'codex',status:'succeeded',project:proposal}}});return;}
  await route.fulfill({status:404,json:{ok:false,error:{code:'offline_fixture_only'}}});
 });
 await page.goto('/rig');await page.getByRole('button',{name:'Add ellipse',exact:true}).click();const before=await save(page,info.outputPath('before-budget.moro.json'));await open(page);const panel=await submit(page);
 await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('button',{name:'Apply proposal',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Rig lab',exact:true})).toBeVisible();expect(await save(page,info.outputPath('after-budget.moro.json'))).toEqual(before);await expect(page.getByRole('button',{name:'Export Lottie',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await save(page,info.outputPath('budget-undo.moro.json'))).layers).toHaveLength(0);expect(posts).toBe(1);
});

for(const width of[320,390])test(`Rig AI v2 OFFLINE ${width}px: consent controls fit and opening never generates`,async({page},info)=>{
 let posts=0;await page.route('**/api/ai/**',async route=>{if(route.request().method()==='POST')posts++;await route.fulfill({json:status});});await page.setViewportSize({width,height:900});await page.goto('/rig');const panel=await open(page);await expect(panel.getByRole('textbox',{name:'Animation brief',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`rig-ai-${width}.png`),fullPage:true});await panel.getByRole('button',{name:'Close AI panel',exact:true}).click();expect(posts).toBe(0);
});
