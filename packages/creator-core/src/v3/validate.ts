import type {LayerV3,PathGeometryV3,ProjectV3,PropertyV3,EasingV3,KeyframeV3} from './types';
// Reuse the audited descriptor-safe primitives, never weaken or mutate v2.
import {arr,obj,num,vec,fail,curves} from '../v2/validate';
export {arr,obj,num,vec,fail,curves};
export const propertiesV3:PropertyV3[]=['x','y','scaleX','scaleY','rotation','opacity','skew','skewAxis'];
export const rangesV3:Record<PropertyV3,[number,number]>={x:[-8192,8192],y:[-8192,8192],scaleX:[1,1000],scaleY:[1,1000],rotation:[-3600,3600],opacity:[0,100],skew:[-75,75],skewAxis:[-3600,3600]};
export function validateEasingV3(e:unknown):asserts e is EasingV3 {if(typeof e==='string'){if(!Object.hasOwn(curves,e))fail('easing');return;}obj(e,['type','x1','y1','x2','y2'],'easing');if(e.type!=='cubic-bezier')fail('easing type');for(const k of ['x1','y1','x2','y2'])num(e[k],0,1,'easing coordinate');}
function name(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>200||Array.from(v).some(c=>{const n=c.charCodeAt(0);return n<32||(n>=127&&n<=159);}))fail('name/id');}
export function validatePathV3(p:unknown):asserts p is PathGeometryV3 {obj(p,['closed','vertices','inTangents','outTangents'],'path');if(typeof p.closed!=='boolean')fail('closed');for(const key of ['vertices','inTangents','outTangents']){arr(p[key],256,'path points');for(const v of p[key])vec(v);}const vs=p.vertices as number[][],ins=p.inTangents as number[][],outs=p.outTangents as number[][];if(vs.length<(p.closed?3:2)||ins.length!==vs.length||outs.length!==vs.length)fail('path length');for(let i=0;i<vs.length;i++)for(let a=0;a<2;a++)for(const ts of [ins,outs])num(vs[i][a]+ts[i][a],-8192,8192,'control point');if(!p.closed&&(ins[0].some(Boolean)||outs[outs.length-1].some(Boolean)))fail('open endpoint');}
function keys(v:unknown,range:[number,number],duration:number):asserts v is KeyframeV3[]{arr(v,100,'keys');let prev=-1;for(const k of v){obj(k,['frame','value','easing'],'key');num(k.frame,0,duration-1,'frame',true);num(k.value,...range,'key value');validateEasingV3(k.easing);if(k.frame<=prev)fail('key order');prev=k.frame;}}
const common=['id','name','type','parentId','x','y','pivot','scaleX','scaleY','rotation','opacity','skew','skewAxis','tracks','masks','trim'];
export function validateLayerV3(l:unknown,duration=3600):asserts l is LayerV3 {
 obj(l,[...common,'width','height','cornerRadius','fill','stroke','strokeWidth','path','pathKeys'],'layer',false);
 const extra=l.type==='group'?[]:l.type==='path'?['path','pathKeys','fill','stroke','strokeWidth']:l.type==='rect'||l.type==='ellipse'?['width','height','cornerRadius','fill','stroke','strokeWidth']:fail('layer type');
 obj(l,[...common,...extra],'layer');name(l.id);name(l.name);if(l.parentId!==null)name(l.parentId);vec(l.pivot);
 for(const p of propertiesV3)num(l[p],...rangesV3[p],p);obj(l.tracks,propertiesV3,'tracks');for(const p of propertiesV3)keys(l.tracks[p],rangesV3[p],duration);
 arr(l.masks,4,'masks');for(const m of l.masks){obj(m,['name','mode','inverted','opacity','path'],'mask');name(m.name);if(m.mode!=='add'&&m.mode!=='subtract')fail('mask mode');if(typeof m.inverted!=='boolean')fail('mask inversion');num(m.opacity,0,100,'mask opacity');validatePathV3(m.path);}
 if(l.type==='group'){if(l.opacity!==100||(l.tracks.opacity as unknown[]).length||l.masks.length||l.trim!==null)fail('group constraints');return;}
 if(l.type!=='path'&&l.trim!==null)fail('primitive trim');
 if(l.trim!==null){obj(l.trim,['start','end','offset','tracks'],'trim');obj(l.trim.tracks,['start','end','offset'],'trim tracks');for(const p of ['start','end','offset'] as const){const range:[number,number]=p==='offset'?[-3600,3600]:[0,100];num(l.trim[p],...range,'trim value');keys(l.trim.tracks[p],range,duration);}}
 if(typeof l.stroke!=='string'||!/^#[0-9a-f]{6}$/i.test(l.stroke))fail('stroke');num(l.strokeWidth,0,100,'stroke width');if(!(l.type==='path'&&l.fill===null)&&(typeof l.fill!=='string'||!/^#[0-9a-f]{6}$/i.test(l.fill)))fail('fill');
 if(l.type!=='path'){num(l.width,1,4096,'width');num(l.height,1,4096,'height');if(l.cornerRadius!==null)num(l.cornerRadius,0,l.type==='rect'?Math.min(l.width,l.height)/2:0,'radius');return;}
 validatePathV3(l.path);if(!l.path.closed&&l.fill!==null)fail('open fill');arr(l.pathKeys,100,'path keys');let prev=-1;for(const k of l.pathKeys){obj(k,['frame','value','easing'],'path key');num(k.frame,0,duration-1,'frame',true);validateEasingV3(k.easing);validatePathV3(k.value);if(k.frame<=prev)fail('path key order');prev=k.frame;if(k.value.closed!==l.path.closed||k.value.vertices.length!==l.path.vertices.length)fail('path topology');}
}
function radius(path:PathGeometryV3){let r=0;for(let i=0;i<path.vertices.length;i++){const p=path.vertices[i];for(const t of [[0,0],path.inTangents[i],path.outTangents[i]])r=Math.max(r,Math.hypot(p[0]+t[0],p[1]+t[1]));}return r;}
export function validateProjectV3(v:unknown):asserts v is ProjectV3 {
 obj(v,['version','name','width','height','fps','durationFrames','layers'],'project');if(v.version!==3)fail('version');name(v.name);num(v.width,16,4096,'width',true);num(v.height,16,4096,'height',true);num(v.fps,1,120,'fps',true);num(v.durationFrames,2,3600,'duration',true);arr(v.layers,100,'layers');const map=new Map<string,LayerV3>();let vertices=0,totalKeys=0,morphVertices=0;
 for(const l of v.layers){validateLayerV3(l,v.durationFrames);if(map.has(l.id))fail('duplicate id');map.set(l.id,l);for(const p of propertiesV3)totalKeys+=l.tracks[p].length;for(const m of l.masks)vertices+=m.path.vertices.length;if(l.trim)for(const p of ['start','end','offset'] as const)totalKeys+=l.trim.tracks[p].length;if(l.type==='path'){vertices+=l.path.vertices.length;totalKeys+=l.pathKeys.length;for(const k of l.pathKeys)morphVertices+=k.value.vertices.length;}}
 if(vertices>2048||totalKeys>10000||morphVertices>16384)fail('total budget');
 for(const l of map.values()){const chain:LayerV3[]=[];let node:LayerV3|undefined=l;const seen=new Set<string>();while(node){if(seen.has(node.id))fail('parent cycle');seen.add(node.id);chain.unshift(node);if(chain.length>9)fail('parent depth');if(node.parentId===null)break;const parent=map.get(node.parentId);if(!parent||parent.type!=='group')fail('parent');node=parent;}
 let minScale=1,maxScale=1,origin=0;
 // Axis-independent singular-value enclosure: ||shear|| <= 1+|tan(sk)|,
 // and ||shear^-1|| has the same bound. Include ALL keyed extrema and pivots.
 for(const n of chain){const values=(p:PropertyV3)=>[n[p],...n.tracks[p].map(k=>k.value)];const ext=(p:PropertyV3)=>Math.max(...values(p).map(Math.abs));const scales=[...values('scaleX'),...values('scaleY')];const shear=1+Math.abs(Math.tan(ext('skew')*Math.PI/180));const localMax=Math.max(...scales)/100*shear,localMin=Math.min(...scales)/100/shear;origin+=maxScale*(Math.hypot(ext('x'),ext('y'))+localMax*Math.hypot(...n.pivot));minScale*=localMin;maxScale*=localMax;if(minScale<0.01-1e-12||maxScale>100+1e-12)fail('world scale limit');if(origin>65536)fail('world extent limit');}
 let r=0;if(l.type==='path'){r=Math.max(radius(l.path),...l.pathKeys.map(k=>radius(k.value)))+l.strokeWidth/2;}else if(l.type!=='group')r=Math.hypot(l.width/2,l.height/2)+l.strokeWidth/2*Math.SQRT2;for(const m of l.masks)r=Math.max(r,radius(m.path));if(origin+maxScale*r>65536)fail('world extent limit');
 }
}
