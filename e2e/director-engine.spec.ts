import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {parseProjectV3,exportLottieV3,evaluateLayerV3,worldMatrixV3} from '../packages/creator-core/src/v3';
import {mountLottie,seekLottie} from './player-fixture';
import {decodeScreenshot} from './director-png';

// Independent installed-player proof of an OFFLINE technical fixture. NOT AI art.
test('v3 independent player: custom easing + scaleXY/skew matrices and genuine path morph on reverse seeks',async({page},info)=>{
 const project=parseProjectV3(await readFile('fixtures/director-v3-advanced.json','utf8'));
 await mountLottie(page,exportLottieV3(project));
 const marker=page.locator('#independent path').filter({visible:true});
 await expect(marker).not.toHaveCount(0);
 const data:string[]=[];
 for(const frame of[0,15,60,30,119,0]){
  await seekLottie(page,frame);
  const actual=await page.locator('#independent').evaluate(el=>{
   const svg=el.querySelector('svg'),shape=[...el.querySelectorAll('path')].find(p=>p.getAttribute('fill')?.replace(/\s/g,'')==='rgb(215,154,78)');
   if(!svg||!shape)throw Error('Independent player missing morph hero');const root=svg.getCTM(),matrix=shape.getCTM();if(!root||!matrix)throw Error('Missing SVG CTM');const m=root.inverse().multiply(matrix),box=shape.getBBox();return{matrix:[m.a,m.b,m.c,m.d,m.e,m.f],box:{x:box.x,y:box.y,width:box.width,height:box.height},d:shape.getAttribute('d')||''};
  });
  const expected=worldMatrixV3(project,'morph-hero',frame);actual.matrix.forEach((v,i)=>expect(Math.abs(v-expected[i])).toBeLessThan(.08));
  const sampled=evaluateLayerV3(project.layers.find(l=>l.id==='morph-hero')!,frame);if(sampled.type!=='path')throw Error('Not path');
  const xs=sampled.path.vertices.map(v=>v[0]),ys=sampled.path.vertices.map(v=>v[1]);
  expect(actual.box.x).toBeCloseTo(Math.min(...xs),1);expect(actual.box.y).toBeCloseTo(Math.min(...ys),1);
  expect(actual.box.width).toBeCloseTo(Math.max(...xs)-Math.min(...xs),1);expect(actual.box.height).toBeCloseTo(Math.max(...ys)-Math.min(...ys),1);
  expect(actual.d.length).toBeGreaterThan(0);data.push(actual.d);
 }
 expect(data[0]).toBe(data[5]);expect(data[0]).not.toBe(data[2]);await page.screenshot({path:info.outputPath('v3-independent-matrix-morph.png')});
});

test('v3 independent player: add/subtract/inverted masks change pixels and trim changes actual stroked geometry',async({page},info)=>{
 const project=parseProjectV3(await readFile('fixtures/director-v3-advanced.json','utf8'));await mountLottie(page,exportLottieV3(project));
 await page.locator('#independent').evaluate(el=>{(el as HTMLElement).style.width='320px';});
 const lengths:number[]=[];
 for(const frame of[0,15,60,0]){
  await seekLottie(page,frame);const png=await page.locator('#independent').screenshot();const shot=decodeScreenshot(png);expect(shot.width).toBe(320);expect(shot.height).toBe(320);
  expect(shot.pixel(50,65)).toEqual([196,36,42]);expect(shot.pixel(90,65)).toEqual([255,255,255]);
  expect(shot.pixel(230,65)).toEqual([255,255,255]);expect(shot.pixel(270,65)).toEqual([42,125,99]);
  expect(shot.pixel(230,165)).toEqual([255,255,255]);expect(shot.pixel(270,165)).toEqual([120,88,191]);
  lengths.push(await page.locator('#independent').evaluate(el=>[...el.querySelectorAll('path')].filter(p=>p.getAttribute('stroke')?.replace(/\s/g,'')==='rgb(27,108,128)').reduce((n,p)=>n+p.getTotalLength(),0)));
  if(frame===60)await page.screenshot({path:info.outputPath('v3-independent-mask-trim.png')});
 }
 expect(lengths[0]).toBeLessThan(1);expect(lengths[1]).toBeGreaterThan(1);expect(lengths[2]).toBeGreaterThan(lengths[1]);expect(lengths[2]).toBeGreaterThan(70);expect(lengths[3]).toBeCloseTo(lengths[0],3);
});

test('v3 inverted mask normalization preserves animated parent/skew/morph world geometry in a vector-only precomp',async({page})=>{
 const project=parseProjectV3(await readFile('fixtures/director-v3-advanced.json','utf8'));
 const hero=project.layers.find(l=>l.id==='morph-hero')!;if(hero.type!=='path')throw Error('Not path');
 hero.masks=[{name:'Far outside inverse mask',mode:'add',inverted:true,opacity:100,path:{closed:true,vertices:[[1000,1000],[1100,1000],[1100,1100],[1000,1100]],inTangents:[[0,0],[0,0],[0,0],[0,0]],outTangents:[[0,0],[0,0],[0,0],[0,0]]}}];
 await mountLottie(page,exportLottieV3(project));
 for(const frame of[0,15,60,30,119,0]){
  await seekLottie(page,frame);
  const actual=await page.locator('#independent').evaluate(el=>{const svg=el.querySelector('svg'),shape=[...el.querySelectorAll('path')].find(p=>p.getAttribute('fill')?.replace(/\s/g,'')==='rgb(215,154,78)');if(!svg||!shape)throw Error('Missing normalized shape');const root=svg.getCTM(),ctm=shape.getCTM();if(!root||!ctm)throw Error('Missing CTM');const point=shape.getPointAtLength(0).matrixTransform(root.inverse().multiply(ctm));return[point.x,point.y];});
  const layer=evaluateLayerV3(hero,frame);if(layer.type!=='path')throw Error('Not path');const [x,y]=layer.path.vertices[0],m=worldMatrixV3(project,hero.id,frame);
  expect(actual[0]).toBeCloseTo(m[0]*x+m[2]*y+m[4],2);expect(actual[1]).toBeCloseTo(m[1]*x+m[3]*y+m[5],2);
 }
});
