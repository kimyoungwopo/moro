import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function start(entry) {
 const child=spawn(process.execPath,[entry],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('Local server did not start.'));},5000);
  child.once('exit',code=>{clearTimeout(timer);reject(Error(`Local server exited ${code}`));});
  child.stdout.on('data',chunk=>{const match=/http:\/\/127\.0\.0\.1:\d+/.exec(String(chunk));if(match){clearTimeout(timer);resolve(match[0]);}});
 });
 return {url,close:()=>child.kill()};
}
for(const entry of ['server.mjs','skill/scripts/serve.mjs'])test(`${entry} serves compiled JS, fonts and /docs with local CSP`,async()=>{
 const server=await start(entry);
 try {
  const response=await fetch(server.url);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
  const html=await response.text(),asset=/src="([^"]+\.js)"/.exec(html)?.[1];assert.ok(asset);
  const js=await fetch(server.url+asset);assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);assert.ok((await js.text()).length>1000);
  const cssPath=/href="([^"]+\.css)"/.exec(html)?.[1];assert.ok(cssPath);const css=await(await fetch(server.url+cssPath)).text();const font=/url\(([^)]+\.woff2)\)/.exec(css)?.[1];assert.ok(font);const fontResponse=await fetch(server.url+font);assert.equal(fontResponse.status,200);assert.equal(fontResponse.headers.get('content-type'),'font/woff2');
  assert.equal((await fetch(server.url+'/docs')).status,200);
  assert.equal((await fetch(server.url+'/%2e%2e%2fpackage.json')).status,403);
  assert.equal((await fetch(server.url+'/missing.json')).status,404);
 } finally {server.close();}
});
test('standalone CLI exports valid JSON and React, refuses overwrite and expressions',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'moro-distribution-'));
 const run=args=>spawnSync(process.execPath,['skill/scripts/recolor.mjs',...args],{cwd:root,encoding:'utf8'});
 try {
  const output=path.join(dir,'animation.moro.json'),args=['--sample','orbit','--map','#1B6C80=#C4242A','--out',output,'--react'];
  const first=run(args);assert.equal(first.status,0,first.stderr);
  const before=await readFile(output,'utf8'),json=JSON.parse(before);assert.equal(json.w,512);assert.match(before,/0\.7686274509803922/);
  assert.match(await readFile(path.join(dir,'MoroAnimation.tsx'),'utf8'),/\.\/animation\.moro\.json/);
  assert.match(await readFile(path.join(dir,'lottie-light.d.ts'),'utf8'),/lottie_light/);
  assert.equal(run(args).status,1);assert.equal(await readFile(output,'utf8'),before);
  const blocked=path.join(dir,'blocked.json');assert.equal(run(['--input','fixtures/blocked-expression.json','--out',blocked]).status,1);await assert.rejects(readFile(blocked),{code:'ENOENT'});
 } finally {await rm(dir,{recursive:true,force:true});}
});
