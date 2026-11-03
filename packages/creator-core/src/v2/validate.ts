import type {LayerV2, ProjectV2, Property} from './types';
export const properties:Property[]=['x','y','scale','rotation','opacity'];
export const ranges:Record<Property,[number,number]>={x:[-8192,8192],y:[-8192,8192],scale:[1,1000],rotation:[-3600,3600],opacity:[0,100]};
export const curves={linear:[0,0,1,1],'ease-in':[0.42,0,1,1],'ease-out':[0,0,0.58,1],'ease-in-out':[0.42,0,0.58,1]} as const;
export function fail(label:string):never {throw new Error(`Invalid ${label}.`);}
export function num(v:unknown,min:number,max:number,label:string,integer=false):asserts v is number {if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v))) fail(label);}
export function obj(v:unknown,keys:string[],label:string,exact=true):asserts v is Record<string,unknown> {
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))) fail(label);
 const own=Reflect.ownKeys(v); if(exact&&own.length!==keys.length) fail(`${label} keys`);
 for(const k of own) {if(typeof k!=='string'||!keys.includes(k))fail(`${label} field`);const d=Object.getOwnPropertyDescriptor(v,k)!;if(!('value'in d)||!d.enumerable)fail(`${label} descriptor`);}
 if(exact&&keys.some(k=>!Object.hasOwn(v,k)))fail(`${label} missing field`);
}
export function arr(v:unknown,max:number,label:string):asserts v is unknown[] {if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max||Reflect.ownKeys(v).length!==v.length+1)fail(label);for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!('value'in d)||!d.enumerable)fail(`${label} descriptor`);}}
function name(v:unknown) {if(typeof v!=='string'||!v.trim()||v.length>200||Array.from(v).some(c=>{const n=c.charCodeAt(0);return n<32||(n>=127&&n<=159);}))fail('name/id');}
export function vec(v:unknown) {arr(v,2,'vector');if(v.length!==2)fail('vector length');for(const n of v)num(n,-4096,4096,'vector component');}
export const commonKeys=['id','name','type','parentId','x','y','pivot','scale','rotation','opacity','tracks'];
export function validateLayerV2(l:unknown,duration=3600):asserts l is LayerV2 {
 // Inspect descriptors before reading the discriminant.
 obj(l,[...commonKeys,'width','height','cornerRadius','fill','stroke','strokeWidth','path'],'layer',false);
 const extra=l.type==='group'?[]:l.type==='path'?['path','fill','stroke','strokeWidth']:l.type==='rect'||l.type==='ellipse'?['width','height','cornerRadius','fill','stroke','strokeWidth']:fail('layer type');
 obj(l,[...commonKeys,...extra],'layer');name(l.id);name(l.name);if(l.parentId!==null)name(l.parentId);vec(l.pivot);
 for(const prop of properties)num(l[prop],...ranges[prop],prop);
 obj(l.tracks,properties,'tracks');for(const prop of properties){const keys=l.tracks[prop];arr(keys,100,'keys');let prev=-1;for(const k of keys){obj(k,['frame','value','easing'],'key');num(k.frame,0,duration-1,'frame',true);num(k.value,...ranges[prop],'key value');if(k.frame<=prev||typeof k.easing!=='string'||!Object.hasOwn(curves,k.easing))fail('key order/easing');prev=k.frame;}}
 if(l.type==='group'){if(l.opacity!==100||(l.tracks.opacity as unknown[]).length)fail('group opacity');return;}
 if(typeof l.stroke!=='string'||!/^#[0-9a-f]{6}$/i.test(l.stroke))fail('stroke');num(l.strokeWidth,0,100,'stroke width');
 if(!(l.type==='path'&&l.fill===null)&&(typeof l.fill!=='string'||!/^#[0-9a-f]{6}$/i.test(l.fill)))fail('fill');
 if(l.type!=='path'){num(l.width,1,4096,'width');num(l.height,1,4096,'height');if(l.cornerRadius!==null)num(l.cornerRadius,0,l.type==='rect'?Math.min(l.width,l.height)/2:0,'radius');return;}
 obj(l.path,['closed','vertices','inTangents','outTangents'],'path');const path=l.path;if(typeof path.closed!=='boolean')fail('closed');
 for(const key of ['vertices','inTangents','outTangents']){arr(path[key],256,'path points');for(const p of path[key] as unknown[])vec(p);}
 const vs=path.vertices as number[][],ins=path.inTangents as number[][],outs=path.outTangents as number[][];
 if(vs.length<(path.closed?3:2)||ins.length!==vs.length||outs.length!==vs.length)fail('path length');
 for(let i=0;i<vs.length;i++)for(let a=0;a<2;a++)for(const ts of [ins,outs])num(vs[i][a]+ts[i][a],-8192,8192,'control point');
 if(!path.closed&&(l.fill!==null||ins[0].some(Boolean)||outs[outs.length-1].some(Boolean)))fail('open path');
}
export function validateProjectV2(v:unknown):asserts v is ProjectV2 {
 obj(v,['version','name','width','height','fps','durationFrames','layers'],'project');if(v.version!==2)fail('version');name(v.name);num(v.width,16,4096,'width',true);num(v.height,16,4096,'height',true);num(v.fps,1,120,'fps',true);num(v.durationFrames,2,3600,'duration',true);arr(v.layers,100,'layers');
 const map=new Map<string,LayerV2>();let vertices=0,keys=0;for(const l of v.layers){validateLayerV2(l,v.durationFrames);if(map.has(l.id))fail('duplicate id');map.set(l.id,l);if(l.type==='path')vertices+=l.path.vertices.length;for(const prop of properties)keys+=l.tracks[prop].length;}if(vertices>2048||keys>10000)fail('total budget');
 for(const l of map.values()) {const chain:LayerV2[]=[];let node:LayerV2|undefined=l;const seen=new Set<string>();while(node){if(seen.has(node.id))fail('parent cycle');seen.add(node.id);chain.unshift(node);if(chain.length>9)fail('parent depth');if(node.parentId===null)break;const parent=map.get(node.parentId);if(!parent||parent.type!=='group')fail('parent');node=parent;}
 let minScale=1,maxScale=1,origin=0;for(const n of chain){const ext=(p:Property)=>Math.max(Math.abs(n[p]),...n.tracks[p].map(k=>Math.abs(k.value)));const ss=[n.scale,...n.tracks.scale.map(k=>k.value)];origin+=maxScale*(Math.hypot(ext('x'),ext('y'))+Math.max(...ss)/100*Math.hypot(...n.pivot));minScale*=Math.min(...ss)/100;maxScale*=Math.max(...ss)/100;if(minScale<0.01-1e-12||maxScale>100+1e-12)fail('world scale limit');if(origin>65536)fail('world extent limit');}
 let radius=0;if(l.type==='path'){for(let i=0;i<l.path.vertices.length;i++){const p=l.path.vertices[i];for(const t of [[0,0],l.path.inTangents[i],l.path.outTangents[i]])radius=Math.max(radius,Math.hypot(p[0]+t[0],p[1]+t[1]));}radius+=l.strokeWidth/2;}else if(l.type!=='group')radius=Math.hypot(l.width/2,l.height/2)+l.strokeWidth/2*Math.SQRT2;
 if(origin+maxScale*radius>65536)fail('world extent limit');
 }
}
