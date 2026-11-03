// Real React + Chromium, offline fixture HTTP only; never launches a CLI.
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { addLayer, createProject } from '../packages/creator-core/src';
let browser: Browser, server: Server, page: Page, origin: string;
let calls: {path:string;method:string;body:string}[] = [];
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const project = addLayer(createProject({name:'PRIVATE_DOCUMENT'}), 'ellipse');
beforeAll(async()=>{
 const bundle=await build({bundle:true,write:false,outdir:'claude-auth-memory',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import HarnessPanel from './apps/web/src/creator/harness/HarnessPanel';
 import AiPanel from './apps/web/src/creator/ai/AiPanel';
 import RigAiPanel from './apps/web/src/rig/RigAiPanel';
 import Studio from './apps/web/src/studio/Studio';
 import ClaudeConnection from './apps/web/src/ai-auth/ClaudeConnection';
 function App(){const [active,setActive]=useState(false),[open,setOpen]=useState(true);const mode=new URLSearchParams(location.search).get('surface');const project=${JSON.stringify(project)};const fail=()=>{throw Error('Auth must not apply')};
 return mode==='creator'?<AiPanel currentProject={project} onApply={fail}/>:mode==='rig'?<RigAiPanel snapshot={()=>JSON.stringify(project)} onApply={fail} onClose={()=>{}}/>:mode==='studio'?<Studio/>:mode==='shared'?<><button onClick={()=>setActive(v=>!v)}>Toggle generation</button><button onClick={()=>setOpen(v=>!v)}>Toggle widget</button><p id="document">PRIVATE_DOCUMENT</p><p id="undo">7</p>{open&&<ClaudeConnection disabled={active}/>}</>:<HarnessPanel currentProject={project} onApply={fail}/>;}createRoot(document.getElementById('root')).render(<App/>);`}});
 const script=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text;
 const css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'';
 server=createServer(async(req,res)=>{if(req.url?.startsWith('/api/')){let body='';for await(const chunk of req)body+=chunk;calls.push({path:req.url,method:req.method!,body});res.setHeader('Content-Type','application/json');if(req.url.endsWith('/login')){res.statusCode=202;res.end(JSON.stringify({ok:true,provider:'claude',handoff:'terminal_requested',authenticationVerified:false}));return;}res.end(JSON.stringify({ok:true,provider:'claude',installed:true,state:'signed_out',loginMethod:'terminal',scope:'cli-reported',inferenceVerified:false}));return;}res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?script:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:8px}${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('fixture port');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true});
},30000);
beforeEach(async()=>{await page?.close();calls=[];page=await browser.newPage();page.setDefaultTimeout(10000);await page.goto(origin);await page.getByRole('combobox',{name:'Harness provider'}).selectOption('claude');});
afterAll(async()=>{await browser?.close();await new Promise<void>(resolve=>server?.close(()=>resolve()));});
it('shows shared Claude control only on selection, with zero implicit auth requests',async()=>{
 expect(calls).toEqual([]);
 expect(await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).count()).toBe(1);
 await page.getByRole('combobox',{name:'Harness provider'}).selectOption('codex');
 expect(await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).count()).toBe(0);
 expect(calls).toEqual([]);
});

it.each(['creator','rig','studio'])('mounts the real %s provider surface without auth requests or editor changes',async surface=>{
 await page.goto(`${origin}/?surface=${surface}`);
 const selector=page.getByRole('combobox',{name:surface==='studio'?'AI 제공자':'AI provider',exact:true});
 await selector.selectOption('claude');
 const widget=page.getByRole('region',{name:'Claude 연결',exact:true});
 expect(await widget.count()).toBe(1);
 await widget.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();
 await widget.getByText('Claude 로그인이 필요해요',{exact:true}).waitFor();
 await widget.getByRole('button',{name:'Claude 로그인',exact:true}).click();
 await page.keyboard.press('Escape');
 expect(calls.filter(c=>c.path.includes('/auth/'))).toEqual([{path:'/api/ai/auth/claude/status',method:'GET',body:''}]);
 if(surface==='studio')expect(await page.getByRole('button',{name:'실행 취소',exact:true}).isDisabled()).toBe(true);
});
it('offers fixed-command copy only after manual/offline discovery and explicit copy click',async()=>{
 await page.goto(`${origin}/?surface=shared`);
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:(text:string)=>{(window as unknown as {copied:string}).copied=text;return Promise.resolve();}},configurable:true});});
 await page.route('**/api/ai/auth/claude/status',route=>route.abort());
 expect(await page.getByRole('button',{name:'로그인 명령 복사'}).count()).toBe(0);
 await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();
 await page.getByRole('button',{name:'로그인 명령 복사'}).waitFor();
 expect(await page.evaluate(()=>(window as unknown as {copied?:string}).copied)).toBeUndefined();
 await page.getByRole('button',{name:'로그인 명령 복사'}).click();
 expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toBe('claude auth login --claudeai');
 expect(await page.locator('#document').textContent()).toBe('PRIVATE_DOCUMENT');expect(await page.locator('#undo').textContent()).toBe('7');
 expect(calls).toEqual([]);
});
it('keeps shared actions and modal usable at 320/390px and desktop',async()=>{
 await page.goto(`${origin}/?surface=shared`);
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:700});
  const buttons=await page.locator('.moro-claude-auth button').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {height:r.height,left:r.left,right:r.right};}));
  for(const rect of buttons){expect(rect.height).toBeGreaterThanOrEqual(44);expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(width);}
  await page.getByRole('button',{name:'Claude 로그인',exact:true}).click();
  const bounds=await page.getByRole('dialog').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:e.scrollWidth>e.clientWidth};});
  expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(width);expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeLessThanOrEqual(700);expect(bounds.overflow).toBe(false);
  expect(await page.getByRole('dialog').locator('input').count()).toBe(1);
  await page.keyboard.press('Escape');
 }
 expect(calls).toEqual([]);
});
it.each([
 ['signed_in','CLI 로그인 정보가 있어요'],['signed_out','Claude 로그인이 필요해요'],['unknown','로그인 상태를 확인하지 못했어요'],['not_installed','Claude CLI가 설치되어 있지 않아요'],['cli_update_required','Claude CLI 업데이트가 필요해요'],
])('shows safe %s status and never declares inference verified',async(state,label)=>{
 await page.route('**/api/ai/auth/claude/status',route=>route.fulfill({json:{ok:true,provider:'claude',installed:state!=='not_installed',state,loginMethod:'terminal',scope:'cli-reported',inferenceVerified:false}}));
 await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();await page.getByText(label,{exact:true}).waitFor();
 expect(await page.getByText(/토큰 만료·다음 생성 성공 여부는 확인하지 않아요/).count()).toBe(1);
 expect(await page.getByRole('button',{name:'Claude 로그인',exact:true}).isEnabled()).toBe(true);
});
it('does not persist or display private error/status fields and supports manual OS handoff',async()=>{
 await page.evaluate(()=>{localStorage.setItem('existing','KEEP');sessionStorage.setItem('existing','KEEP');});
 await page.route('**/api/ai/auth/claude/login',route=>route.fulfill({status:501,json:{ok:false,error:{code:'manual_login_required',message:'PRIVATE_CODE https://PRIVATE.invalid /Users/private',stderr:'PRIVATE_STDERR'}}}));
 await page.getByRole('textbox',{name:'Harness brief'}).fill('PRIVATE_BRIEF');
 await page.getByRole('button',{name:'Claude 로그인',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'공식 로그인 시작'}).click();
 await page.getByRole('button',{name:'로그인 명령 복사'}).waitFor();
 const widget=page.getByRole('region',{name:'Claude 연결',exact:true});expect(await widget.textContent()).not.toMatch(/PRIVATE_|https:|\/Users/);
 expect(await page.getByRole('textbox',{name:'Harness brief'}).inputValue()).toBe('PRIVATE_BRIEF');
 expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage},cookie:document.cookie}))).toEqual({local:{existing:'KEEP'},session:{existing:'KEEP'},cookie:''});
 await page.route('**/api/ai/auth/claude/status',route=>route.fulfill({json:{ok:true,provider:'claude',installed:true,state:'signed_in',loginMethod:'manual',scope:'cli-reported',inferenceVerified:false,email:'PRIVATE_EMAIL'}}));
 await widget.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();await widget.getByText('로그인 상태를 확인하지 못했어요',{exact:true}).waitFor();
 expect(await widget.textContent()).not.toContain('PRIVATE');
});
it('disables all auth actions during generation and closes consent without launch',async()=>{
 await page.goto(`${origin}/?surface=shared`);
 await page.getByRole('button',{name:'Toggle generation'}).click();
 for(const name of ['Claude 로그인','로그인 상태 확인'])expect(await page.getByRole('button',{name,exact:true}).isDisabled()).toBe(true);
 await page.getByRole('button',{name:'Toggle generation'}).click();
 await page.getByRole('button',{name:'Claude 로그인',exact:true}).click();await page.getByRole('dialog').getByRole('checkbox').check();
 await page.getByRole('button',{name:'Toggle generation'}).evaluate((e:HTMLButtonElement)=>e.click());
 expect(await page.getByRole('dialog').count()).toBe(0);expect(calls).toEqual([]);
 await page.getByRole('button',{name:'Toggle generation'}).click();await page.getByRole('button',{name:'Claude 로그인',exact:true}).click();
 expect(await page.getByRole('dialog').getByRole('checkbox').isChecked()).toBe(false);
 await page.getByRole('button',{name:'Toggle widget'}).evaluate((e:HTMLButtonElement)=>e.click());expect(calls).toEqual([]);
});
it('ignores a pending old response after unmount and never transfers it to a new widget',async()=>{
 await page.goto(`${origin}/?surface=shared`);
 let release!:()=>void, arrived!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}), started=new Promise<void>(resolve=>{arrived=resolve;});
 await page.route('**/api/ai/auth/claude/status',async route=>{arrived();await gate;await route.fulfill({json:{ok:true,provider:'claude',installed:true,state:'signed_in',loginMethod:'terminal',scope:'cli-reported',inferenceVerified:false}});});
 await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();await started;
 await page.getByRole('button',{name:'Toggle widget'}).click();await page.getByRole('button',{name:'Toggle widget'}).click();release();
 await page.waitForTimeout(50);
 expect(await page.getByText('CLI 로그인 정보가 있어요',{exact:true}).count()).toBe(0);
 expect(await page.getByText('로그인 상태는 직접 확인해 주세요.',{exact:true}).count()).toBe(1);
 expect(await page.locator('#document').textContent()).toBe('PRIVATE_DOCUMENT');expect(await page.locator('#undo').textContent()).toBe('7');expect(calls).toEqual([]);
});
it('requires a fresh checkbox, cancels without requests and dispatches exactly one confirmed login',async()=>{
 const login=page.getByRole('button',{name:'Claude 로그인',exact:true});
 await login.click(); const dialog=page.getByRole('dialog');
 expect(await dialog.getByRole('button',{name:'공식 로그인 시작'}).isDisabled()).toBe(true);
 await dialog.getByRole('button',{name:'취소',exact:true}).click(); expect(calls).toEqual([]);
 expect(await login.evaluate(e=>e===document.activeElement)).toBe(true);
 await login.click(); await page.keyboard.press('Escape'); expect(calls).toEqual([]);
 await login.click(); await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'공식 로그인 시작'}).evaluate((e:HTMLButtonElement)=>{e.click();e.click();});
 await page.getByText(/터미널 열기를 요청했어요/).waitFor();
 expect(calls).toEqual([{path:'/api/ai/auth/claude/login',method:'POST',body:'{"consent":true}'}]);
 expect(await page.getByText('CLI 로그인 정보가 있어요',{exact:true}).count()).toBe(0);
 expect(await page.getByRole('textbox').count()).toBe(1);
});
it('refreshes only on explicit click and reports CLI-only signed-out information',async()=>{
 await page.getByRole('button',{name:'로그인 상태 확인',exact:true}).click();
 await page.getByText('Claude 로그인이 필요해요',{exact:true}).waitFor();
 expect(calls).toEqual([{path:'/api/ai/auth/claude/status',method:'GET',body:''}]);
});
