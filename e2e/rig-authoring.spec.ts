import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseProjectV2, exportLottieV2, transformPointV2, worldMatricesV2, inverseMatrixV2 } from '../packages/creator-core/src/v2';
import { mountLottie } from './player-fixture';
async function field(page:Page,label:string,value:number|string){const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(String(value));await input.press('Tab');}
async function save(page:Page,path:string){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save v2 project',exact:true}).click();await(await pending).saveAs(path);return parseProjectV2(await readFile(path,'utf8'));}
async function canvasPoint(page:Page,point:[number,number]){return page.getByTestId('rig-canvas').evaluate((el,p)=>{const m=(el as SVGSVGElement).getScreenCTM();if(!m)throw Error('No canvas CTM');const q=new DOMPoint(...p).matrixTransform(m);return{x:q.x,y:q.y};},point);}

test('Rig lab actual authoring: path handles, parent/pivot, keyframes, save/reopen/export and Undo',async({page,context},info)=>{
 await page.goto('/rig');await expect(page.getByRole('heading',{name:'Rig lab',exact:true})).toBeVisible();
 let posts=0;page.on('request',r=>{if(r.method()==='POST')posts++;});
 await page.getByRole('button',{name:'Add path',exact:true}).click();
 await expect(page.getByTestId('rig-preview').locator('svg')).toBeVisible();
 await field(page,'Out tangent X',36);await field(page,'Out tangent Y',-42);
 const before=await save(page,info.outputPath('before-handle.moro.json'));
 const path=before.layers[0];if(path.type!=='path')throw Error('Missing authored path');
 const v=path.path.vertices[0],o=path.path.outTangents[0],at=transformPointV2(worldMatricesV2(before,0).get(path.id)!,[v[0]+o[0],v[1]+o[1]]);
 await page.getByTestId('rig-canvas').scrollIntoViewIfNeeded();const start=await canvasPoint(page,at);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+18,start.y-12,{steps:6});await page.mouse.up();
 const after=await save(page,info.outputPath('after-handle.moro.json'));if(after.layers[0].type!=='path')throw Error('Missing path');
 expect(after.layers[0].path.outTangents[0]).not.toEqual(o);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page,info.outputPath('undo-handle.moro.json'))).toEqual(before);
 await page.getByRole('button',{name:'Add group',exact:true}).click();
 const withGroup=await save(page,info.outputPath('with-group.moro.json'));const group=withGroup.layers.at(-1)!;
 await page.getByRole('button',{name:`Select ${path.name}`,exact:true}).click();await page.getByRole('combobox',{name:'Parent group',exact:true}).selectOption(group.id);
 await field(page,'Pivot X',12);await field(page,'Pivot Y',-8);await page.getByRole('button',{name:'Preserve-world pivot',exact:true}).click();
 await page.getByRole('combobox',{name:'Keyframe channel',exact:true}).selectOption('rotation');await field(page,'Keyframe value',0);await page.getByRole('button',{name:'Insert keyframe',exact:true}).click();
 await field(page,'Current frame',60);await field(page,'Keyframe value',25);await page.getByRole('button',{name:'Insert keyframe',exact:true}).click();
 const final=await save(page,info.outputPath('authored.moro.json'));const curve=final.layers.find(l=>l.id===path.id)!;
 expect(curve.parentId).toBe(group.id);expect(curve.pivot).toEqual([12,-8]);expect(curve.tracks.rotation.map(k=>k.frame)).toEqual([0,60]);
 const exporting=page.waitForEvent('download');await page.getByRole('button',{name:'Export Lottie',exact:true}).click();const animationPath=info.outputPath('authored.lottie.json');await(await exporting).saveAs(animationPath);const animation=JSON.parse(await readFile(animationPath,'utf8'));expect(animation).toEqual(exportLottieV2(final));
 const fresh=await context.newPage();try{await fresh.goto('/rig');await fresh.getByLabel('Open v2 project file',{exact:true}).setInputFiles(info.outputPath('authored.moro.json'));await fresh.getByRole('button',{name:`Select ${path.name}`,exact:true}).click();expect(await save(fresh,info.outputPath('reopened.moro.json'))).toEqual(final);await fresh.screenshot({path:info.outputPath('rig-authoring-desktop.png'),fullPage:true});}finally{await fresh.close();}
 const independent=await context.newPage();try{await mountLottie(independent,animation);await expect(independent.locator('#independent svg path')).not.toHaveCount(0);}finally{await independent.close();}
 expect(posts).toBe(0);
});

for(const width of[390,320])test(`Rig lab ${width}px: inverse-parent pointer drag, cancellation and single Undo`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.goto('/rig');
 const original=parseProjectV2(await readFile('fixtures/creator-v2-articulated-curve.json','utf8'));
 await page.getByLabel('Open v2 project file',{exact:true}).setInputFiles('fixtures/creator-v2-articulated-curve.json');
 const tip=original.layers.find(l=>l.id==='pivot-tip')!;await page.getByRole('button',{name:`Select ${tip.name}`,exact:true}).click();
 await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await page.getByTestId('rig-canvas').scrollIntoViewIfNeeded();
 const world=worldMatricesV2(original,0),center=transformPointV2(world.get(tip.id)!,[0,0]),start=await canvasPoint(page,center);
 const end={x:start.x+14,y:start.y+12};await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up();
 const moved=await save(page,info.outputPath('moved.moro.json'));const changed=moved.layers.find(l=>l.id===tip.id)!;
 const point=await page.getByTestId('rig-canvas').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!.inverse());return[q.x,q.y] as[number,number];},end);
 const parent=world.get(tip.parentId!)!,a=transformPointV2(inverseMatrixV2(parent),center),b=transformPointV2(inverseMatrixV2(parent),point);
 expect(changed.x).toBeCloseTo(tip.x+b[0]-a[0],2);expect(changed.y).toBeCloseTo(tip.y+b[1]-a[1],2);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page,info.outputPath('restored.moro.json'))).toEqual(original);await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 await page.getByTestId('rig-canvas').scrollIntoViewIfNeeded();const again=await canvasPoint(page,center);await page.mouse.move(again.x,again.y);await page.mouse.down();await page.mouse.move(again.x+10,again.y+10,{steps:5});await page.getByTestId('rig-canvas').dispatchEvent('pointercancel');await page.mouse.up();expect(await save(page,info.outputPath('cancelled.moro.json'))).toEqual(original);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`rig-mobile-${width}.png`),fullPage:true});
});
