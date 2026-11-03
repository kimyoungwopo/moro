import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { addLayer, createProject, serializeProject, setKeyframe } from '../packages/creator-core/src/index';
const dirs:string[]=[];
afterEach(()=>{ for(const dir of dirs.splice(0)) rmSync(dir,{recursive:true,force:true}); });
const run=(...args:string[])=>spawnSync(process.execPath,[resolve('scripts/moro-create.mjs'),...args],{encoding:'utf8',timeout:15000});
function fixture() {
  const dir=mkdtempSync(join(homedir(),'.hermes/cache/scratch/moro-cli-')); dirs.push(dir);
  let p=addLayer(createProject(),'ellipse'); const id=p.layers[0].id;
  p=setKeyframe(p,id,'x',0,100,'ease-in-out'); p=setKeyframe(p,id,'x',60,400);
  const input=join(dir,'project.moro.json'),out=join(dir,'animation.json'); writeFileSync(input,serializeProject(p)); return {dir,input,out};
}
describe('real creator CLI',()=>{
  it('writes nonempty shape Lottie and refuses overwrite including validation mode',()=>{
    const {input,out}=fixture(); const result=run('--input',input,'--out',out);
    expect(result.status,result.stderr).toBe(0); const bytes=readFileSync(out,'utf8'); expect(bytes.length).toBeGreaterThan(200);
    expect(JSON.parse(bytes)).toMatchObject({w:512,op:120,layers:[{ty:4,ks:{p:{s:true,x:{a:1,k:[{t:0,s:[100]},{t:60,s:[400]}]}}}}]});
    expect(run('--input',input,'--out',out).status).not.toBe(0);
    expect(run('--input',input,'--out',out,'--validate').status).not.toBe(0); expect(readFileSync(out,'utf8')).toBe(bytes);
    expect(run('--input',input,'--out',input).status).not.toBe(0);
  });
  it('validates without output and rejects unsafe data without executing it',()=>{
    const {dir,input,out}=fixture(); expect(run('--input',input,'--validate').status).toBe(0); expect(existsSync(out)).toBe(false);
    const marker=join(dir,'executed');
    for(const bad of [`import('node:fs').then(fs=>fs.writeFileSync(${JSON.stringify(marker)},'bad'))`, '{"version":1,"__proto__":{"polluted":true}}', '1e309', ' '.repeat(8*1024*1024+1)]) {
      writeFileSync(input,bad); const result=run('--input',input,'--out',out); expect(result.status).not.toBe(0); expect(existsSync(out)).toBe(false); expect(existsSync(marker)).toBe(false);
    }
    writeFileSync(input,Buffer.from([0xff,0xfe])); expect(run('--input',input,'--validate').status).not.toBe(0);
  });
  it('rejects output symlinks and invalid arguments; documents prerequisites and bounds',()=>{
    const {dir,input,out}=fixture(); const target=join(dir,'target'); writeFileSync(target,'preserve'); symlinkSync(target,out);
    expect(run('--input',input,'--out',out).status).not.toBe(0); expect(readFileSync(target,'utf8')).toBe('preserve');
    for(const args of [[],['--input',input],['--input',input,'--out',join(dir,'new'),'--evil'],['--input',input,'--input',input,'--validate'],['--input']]) expect(run(...args).status).not.toBe(0);
    const help=run('--help'); expect(help.status).toBe(0); expect(help.stdout).toContain('npm ci'); expect(help.stdout).toContain('4096'); expect(help.stdout).toContain('3600');
  });
});
