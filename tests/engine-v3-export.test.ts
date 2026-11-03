import {it,expect} from 'vitest';
import {exportLottieV3,type PathV3} from '../packages/creator-core/src/v3';
import {fixture} from '../fixtures/creator-v3-helpers';
import {parseDocument} from '../packages/document-core/src';
it('exports genuine animated sh, per-path tm and normalized local add/subtract/inverted masks',()=>{
 const p=fixture(),l=p.layers[0] as PathV3;
 l.pathKeys=[{frame:0,value:structuredClone(l.path),easing:{type:'cubic-bezier',x1:.2,y1:0,x2:.8,y2:1}},{frame:80,value:{...structuredClone(l.path),vertices:[[20,0],[80,10],[45,95]]},easing:'linear'}];
 l.trim!.tracks.end=[{frame:0,value:10,easing:'ease-in'},{frame:80,value:90,easing:'linear'}];
 l.masks.push({...structuredClone(l.masks[0]),mode:'subtract',inverted:true,opacity:65});
 const before=structuredClone(p),json=exportLottieV3(p),text=JSON.stringify(json);
 const outer=(json.layers as Record<string,unknown>[])[0];
 expect(outer).toMatchObject({ty:0,w:Math.min(p.width,p.height),h:Math.min(p.width,p.height)});
 const asset=(json.assets as {id:string;layers:Record<string,unknown>[]}[]).find(a=>a.id===outer.refId)!;
 expect(asset).toBeDefined();const node=asset.layers[0],shapes=node.shapes as Record<string,unknown>[];
 expect(shapes.find(x=>x.ty==='sh')?.ks).toMatchObject({a:1,k:[{t:0,s:[{c:true}],o:{x:[.2],y:[0]}},{t:80}]});
 expect(shapes.find(x=>x.ty==='tm')).toMatchObject({m:1,e:{a:1,k:[{t:0,s:[10]},{t:80,s:[90]}]}});
 expect(node.masksProperties).toMatchObject([{mode:'a',inv:false,pt:{a:0}},{mode:'s',inv:true,o:{a:0,k:65}}]);
 expect(outer.ks).toMatchObject({sk:{a:0,k:20},sa:{a:0,k:35}});
 expect(node.ks).toMatchObject({s:{a:0,k:[100,100,100]},o:{a:0,k:100}});
 const masks=node.masksProperties as {pt:{k:{v:number[][]}}}[];
 for(const mask of masks)for(const vertex of mask.pt.k.v)for(const value of vertex){expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThanOrEqual(Math.min(p.width,p.height));}
 expect(parseDocument(new TextEncoder().encode(text),'advanced.json').diagnostics.blocked).toEqual([]);
 expect(text).not.toContain('expression');expect(p).toEqual(before);
});
it('fails closed on unsafe export input',()=>{const p=fixture();p.layers[0].skew=Infinity;expect(()=>exportLottieV3(p)).toThrow();});
