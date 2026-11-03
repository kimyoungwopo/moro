import {it,expect} from 'vitest';
import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {exportLottieV3,worldMatrixV3,evaluateLayerV3,parseProjectV3,type PathV3,type GroupV3} from '../packages/creator-core/src/v3';
import advanced from '../fixtures/creator-v3-advanced.json';
import {fixture} from '../fixtures/creator-v3-helpers';
import type {AnimationItem} from 'lottie-web';
it('matches independent official SVG CTM under asynchronous scale keys and reverse seeking',async()=>{
 const p=fixture(),l=p.layers[0] as PathV3;l.masks=[];l.trim=null;
 l.tracks.scaleX=[{frame:0,value:65,easing:{type:'cubic-bezier',x1:.15,y1:1,x2:.6,y2:0}},{frame:90,value:170,easing:'linear'}];
 l.tracks.scaleY=[{frame:15,value:125,easing:'ease-out'},{frame:45,value:75,easing:'ease-in'},{frame:110,value:160,easing:'linear'}];
 l.tracks.skew=[{frame:0,value:-25,easing:'ease-in-out'},{frame:119,value:40,easing:'linear'}];
 const g:GroupV3={id:'parent',name:'Rig',type:'group',parentId:null,x:20,y:-10,pivot:[3,-4],scaleX:110,scaleY:90,rotation:25,opacity:100,skew:-12,skewAxis:67,tracks:{x:[],y:[],scaleX:[],scaleY:[],rotation:[],opacity:[],skew:[],skewAxis:[]},masks:[],trim:null};l.parentId=g.id;p.layers.unshift(g);
 const data=exportLottieV3(p),browser=await chromium.launch({headless:true});
 try {const page=await browser.newPage({viewport:{width:512,height:512}});await page.setContent('<div id="player" style="width:512px;height:512px"></div>');await page.addScriptTag({content:readFileSync('node_modules/lottie-web/build/player/lottie_light.js','utf8')});
 const frames=[0,7.5,15,23.25,44.5,45,65,89.5,90,110,119,23.25,0];
 const actual=await page.evaluate(async({data,frames})=>{const player=(window as unknown as {lottie:{loadAnimation:(v:unknown)=>AnimationItem}}).lottie;const a=player.loadAnimation({container:document.getElementById('player'),renderer:'svg',autoplay:false,loop:false,animationData:data,rendererSettings:{viewBoxOnly:true}});if(!a.isLoaded)await new Promise<void>(resolve=>a.addEventListener('DOMLoaded',()=>resolve()));const renderer=(a as unknown as {renderer:{elements:{data:{nm:string};transformedElement:SVGGraphicsElement}[]}}).renderer;const el=renderer.elements.find(e=>e.data.nm==='Morph')!.transformedElement;const out=frames.map(frame=>{a.goToAndStop(frame,true);const m=el.getCTM()!;return [m.a,m.b,m.c,m.d,m.e,m.f];});a.destroy();return out;},{data,frames});
 for(let f=0;f<frames.length;f++){const expected=worldMatrixV3(p,l.id,frames[f]);actual[f].forEach((n,i)=>expect(n,`frame ${frames[f]} component ${i}`).toBeCloseTo(expected[i],3));}
 }finally{await browser.close();}
},30000);
it('renders real morph/trim geometry and static subtract/inverted SVG mask definitions',async()=>{
 const p=parseProjectV3(JSON.stringify(advanced)),l=p.layers.find(n=>n.type==='path') as PathV3,plain=structuredClone(p),plainLayer=plain.layers.find(n=>n.id===l.id)!;plainLayer.masks=[];plainLayer.trim=null;
 const data=[exportLottieV3(plain),exportLottieV3(p)],frames=[0,55,110,55,0],browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();await page.setContent('<div id="a" style="width:512px;height:512px"></div><div id="b" style="width:512px;height:512px"></div>');await page.addScriptTag({content:readFileSync('node_modules/lottie-web/build/player/lottie_light.js','utf8')});
 const result=await page.evaluate(async({data,frames})=>{const player=(window as unknown as {lottie:{loadAnimation:(v:unknown)=>AnimationItem}}).lottie;const out=[];for(let i=0;i<data.length;i++){const container=document.getElementById(i?'b':'a')!;const a=player.loadAnimation({container,renderer:'svg',autoplay:false,loop:false,animationData:data[i]});if(!a.isLoaded)await new Promise<void>(resolve=>a.addEventListener('DOMLoaded',()=>resolve()));const rendered=(a as unknown as {renderer:{elements:{data:{nm:string};layerElement:SVGGElement}[]}}).renderer.elements.find(e=>e.data.nm==='Morph')!.layerElement;const samples=frames.map(frame=>{a.goToAndStop(frame,true);const paths=[...rendered.querySelectorAll('path')];const longest=paths.reduce((a,b)=>a.getTotalLength()>=b.getTotalLength()?a:b);const matrix=longest.getCTM()!;return {length:longest.getTotalLength(),determinant:matrix.a*matrix.d-matrix.b*matrix.c,d:paths.map(path=>path.getAttribute('d'))};});out.push({samples,masks:container.querySelectorAll('defs mask').length,maskPaths:container.querySelectorAll('defs mask path').length});a.destroy();}return out;},{data,frames});
 expect(result[1].masks).toBeGreaterThan(0);expect(result[1].maskPaths).toBeGreaterThanOrEqual(2);
 // Convert generated precomp-local units back to the original design space;
 // otherwise normalization scale is mistaken for extra trimmed geometry.
 for(let i=0;i<frames.length;i++){const sample=evaluateLayerV3(l,frames[i]) as PathV3;const first=/^\s*M\s*(-?[\d.]+)[, ]+(-?[\d.]+)/.exec(result[0].samples[i].d[0]!);expect(first,JSON.stringify(result[0].samples[i])).not.toBeNull();expect(Number(first![1])).toBeCloseTo(sample.path.vertices[0][0],2);expect(Number(first![2])).toBeCloseTo(sample.path.vertices[0][1],2);const conversion=Math.sqrt(Math.abs(result[1].samples[i].determinant/result[0].samples[i].determinant));expect(result[1].samples[i].length/result[0].samples[i].length*conversion).toBeCloseTo((sample.trim!.end-sample.trim!.start)/100,2);}
 expect(result[0].samples[0].d).not.toEqual(result[0].samples[2].d);expect(result[1].samples[1]).toEqual(result[1].samples[3]);expect(result[1].samples[0]).toEqual(result[1].samples[4]);
 }finally{await browser.close();}
},30000);
