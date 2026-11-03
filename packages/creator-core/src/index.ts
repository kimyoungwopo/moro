import type { Obj } from '../../document-core/src';

export type ShapeType = 'rect' | 'ellipse';
export type Property = 'x' | 'y' | 'scale' | 'rotation' | 'opacity';
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type Keyframe = {frame:number;value:number;easing:Easing};
export type CreatorLayer = {id:string;name:string;type:ShapeType;x:number;y:number;width:number;height:number;cornerRadius?:number|null;fill:string;stroke:string;strokeWidth:number;rotation:number;opacity:number;scale:number;tracks:Partial<Record<Property,Keyframe[]>>};
export type CreatorProject = {version:1;name:string;width:number;height:number;fps:number;durationFrames:number;layers:CreatorLayer[]};
const properties:Property[] = ['x','y','scale','rotation','opacity'];
const easings:Easing[] = ['linear','ease-in','ease-out','ease-in-out'];
const ranges:Record<Property,[number,number]> = {x:[-8192,8192],y:[-8192,8192],scale:[1,1000],rotation:[-3600,3600],opacity:[0,100]};
function fail(label:string):never { throw new Error(`Invalid ${label}.`); }
function number(value:unknown,min:number,max:number,label:string,integer=false):asserts value is number {
  if(typeof value !== 'number' || !Number.isFinite(value) || value<min || value>max || (integer && !Number.isInteger(value))) fail(label);
}
function object(value:unknown,keys:string[],label:string):asserts value is Record<string,unknown> {
  if(!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail(label);
  for(const key of Reflect.ownKeys(value)) {
    if(typeof key !== 'string' || !keys.includes(key)) fail(`${label} field`);
    const desc = Object.getOwnPropertyDescriptor(value,key)!;
    if(!('value' in desc)) fail(`${label} accessor`);
  }
}
function name(value:unknown,label:string):asserts value is string {
  if(typeof value !== 'string' || !value.trim() || value.length>200 || Array.from(value).some(char=>char.charCodeAt(0)<32)) fail(label);
}
function projectHeader(p:Record<string,unknown>) {
  if(p.version!==1) fail('version'); name(p.name,'project name');
  number(p.width,16,4096,'width',true); number(p.height,16,4096,'height',true);
  number(p.fps,1,120,'fps',true); number(p.durationFrames,2,3600,'duration',true);
}
export function createProject(options:Partial<Pick<CreatorProject,'name'|'width'|'height'|'fps'|'durationFrames'>> = {}):CreatorProject {
  object(options,['name','width','height','fps','durationFrames'],'options');
  const p:CreatorProject = {version:1,name:'Untitled motion',width:512,height:512,fps:60,durationFrames:120,layers:[],...options};
  projectHeader(p); return p;
}
export function setKeyframe(project:CreatorProject,id:string,property:Property,frame:number,value:number,easing:Easing='linear'):CreatorProject {
  const p=copy(project); if(!properties.includes(property)) fail('property');
  number(frame,0,p.durationFrames-1,'frame',true); number(value,...ranges[property],'value'); if(!easings.includes(easing)) fail('easing');
  const l=layer(p,id); l.tracks[property]=[...(l.tracks[property]??[]).filter(k=>k.frame!==frame),{frame,value,easing}].sort((a,b)=>a.frame-b.frame);
  validate(p); return p;
}
export function removeKeyframe(project:CreatorProject,id:string,property:Property,frame:number):CreatorProject {
  const p=copy(project); if(!properties.includes(property)) fail('property'); number(frame,0,p.durationFrames-1,'frame',true);
  const l=layer(p,id), keys=(l.tracks[property]??[]).filter(k=>k.frame!==frame);
  if(keys.length) l.tracks[property]=keys; else delete l.tracks[property]; return p;
}
// CSS cubic timing: solve x(u)=progress, then evaluate y(u).
const curves:Record<Easing,[number,number,number,number]>={linear:[0,0,1,1],'ease-in':[0.42,0,1,1],'ease-out':[0,0,0.58,1],'ease-in-out':[0.42,0,0.58,1]};
function cubic(t:number,a:number,b:number) { return 3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t; }
function eased(t:number,e:Easing) {
  if(e==='linear') return t; const [x1,y1,x2,y2]=curves[e]; let lo=0,hi=1;
  for(let n=0;n<48;n++) { const mid=(lo+hi)/2; if(cubic(mid,x1,x2)<t) lo=mid; else hi=mid; }
  return cubic((lo+hi)/2,y1,y2);
}
export function sampleLayer(layer:CreatorLayer,frame:number):{x:number;y:number;scale:number;rotation:number;opacity:number} {
  validateLayer(layer); number(frame,-Number.MAX_VALUE,Number.MAX_VALUE,'sample frame');
  const result={x:layer.x,y:layer.y,scale:layer.scale,rotation:layer.rotation,opacity:layer.opacity};
  for(const prop of properties) {
    const keys=layer.tracks[prop]; if(!keys?.length) continue;
    if(frame<=keys[0].frame) { result[prop]=keys[0].value; continue; }
    const last=keys[keys.length-1]; if(frame>=last.frame) { result[prop]=last.value; continue; }
    const index=keys.findIndex(k=>k.frame>frame), a=keys[index-1], b=keys[index];
    result[prop]=a.value+(b.value-a.value)*eased((frame-a.frame)/(b.frame-a.frame),a.easing);
  }
  return result;
}
function constant(k:number|number[]):Obj { return {a:0,k}; }
function animated(l:CreatorLayer,prop:Property):Obj {
  const keys=l.tracks[prop]; const scale=prop==='scale';
  const vector=(v:number)=>scale?[v,v,100]:[v];
  if(!keys?.length || keys.length===1) { const v=keys?.[0]?.value??l[prop]; return constant(scale?vector(v):v); }
  return {a:1,k:keys.map((key,index):Obj=>{
    const result:Obj={t:key.frame,s:vector(key.value)}; const next=keys[index+1];
    if(next) {
      const [x1,y1,x2,y2]=curves[key.easing], size=scale?3:1;
      result.e=vector(next.value);
      result.o={x:Array(size).fill(x1),y:Array(size).fill(y1)};
      result.i={x:Array(size).fill(x2),y:Array(size).fill(y2)};
    }
    return result;
  })};
}
function color(hex:string) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(1); }
export function exportLottie(project:CreatorProject):Obj {
  validate(project);
  return {v:'5.13.0',nm:project.name,ddd:0,w:project.width,h:project.height,fr:project.fps,ip:0,op:project.durationFrames,assets:[],markers:[],layers:[...project.layers].reverse().map((l,index):Obj=>({
    ddd:0,ind:index+1,ty:4,nm:l.name,sr:1,st:0,ip:0,op:project.durationFrames,bm:0,ao:0,
    ks:{a:constant([0,0,0]),p:{s:true,x:animated(l,'x'),y:animated(l,'y')},s:animated(l,'scale'),r:animated(l,'rotation'),o:animated(l,'opacity')},
    shapes:[
      {ty:l.type==='rect'?'rc':'el',d:1,p:constant([0,0]),s:constant([l.width,l.height]),...(l.type==='rect'?{r:constant(l.cornerRadius??0)}:{}),nm:l.type==='rect'?'Rectangle':'Ellipse'},
      {ty:'fl',c:constant(color(l.fill)),o:constant(100),r:1,bm:0,nm:'Fill'},
      {ty:'st',c:constant(color(l.stroke)),o:constant(100),w:constant(l.strokeWidth),lc:1,lj:1,ml:4,bm:0,nm:'Stroke'}
    ]
  }))};
}
const MAX_BYTES=8*1024*1024;
export function serializeProject(project:CreatorProject):string {
  validate(project); const text=JSON.stringify(project,null,2)+'\n'; if(new TextEncoder().encode(text).length>MAX_BYTES) fail('project size (8 MiB)'); return text;
}
export function parseProject(text:string):CreatorProject {
  if(typeof text!=='string' || text.length>MAX_BYTES || new TextEncoder().encode(text).length>MAX_BYTES) fail('project size (8 MiB)');
  let p:unknown; try { p=JSON.parse(text); } catch { fail('project JSON'); }
  validate(p); return p;
}
const layerKeys=['id','name','type','x','y','width','height','cornerRadius','fill','stroke','strokeWidth','rotation','opacity','scale','tracks'];
function array(value:unknown,max:number,label:string):asserts value is unknown[] {
  if(!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || value.length>max) fail(label);
  const keys=Reflect.ownKeys(value);
  if(keys.length!==value.length+1) fail(`${label} fields`);
  for(let i=0;i<value.length;i++) {
    const d=Object.getOwnPropertyDescriptor(value,String(i)); if(!d || !('value' in d)) fail(`${label} accessor`);
  }
}
function validateLayer(l:unknown,duration=3600):asserts l is CreatorLayer {
  object(l,layerKeys,'layer'); name(l.id,'id'); name(l.name,'layer name');
  if(l.type!=='rect' && l.type!=='ellipse') fail('shape type');
  for(const prop of properties) number(l[prop],...ranges[prop],prop);
  number(l.width,1,4096,'shape width'); number(l.height,1,4096,'shape height'); number(l.strokeWidth,0,100,'stroke width');
  if(l.cornerRadius!==undefined && l.cornerRadius!==null) number(l.cornerRadius,0,l.type==='rect'?Math.min(l.width,l.height)/2:0,'corner radius');
  for(const key of ['fill','stroke']) if(typeof l[key]!=='string' || !/^#[a-f0-9]{6}$/i.test(l[key] as string)) fail(key);
  object(l.tracks,properties,'tracks');
  for(const [prop,keys] of Object.entries(l.tracks)) {
    array(keys,100,'key count');
    let previous=-1;
    for(const key of keys) {
      object(key,['frame','value','easing'],'keyframe');
      number(key.frame,0,duration-1,'keyframe frame',true); number(key.value,...ranges[prop as Property],'keyframe value');
      if(key.frame<=previous || !easings.includes(key.easing as Easing)) fail('keyframe order/easing'); previous=key.frame;
    }
  }
}
function validate(p:unknown):asserts p is CreatorProject {
  object(p,['version','name','width','height','fps','durationFrames','layers'],'project'); projectHeader(p);
  array(p.layers,100,'layer count');
  const ids=new Set<string>();
  for(const l of p.layers) { validateLayer(l,p.durationFrames as number); if(ids.has(l.id)) fail('duplicate id'); ids.add(l.id); }
}
function copy(p:CreatorProject) { validate(p); return structuredClone(p); }
function layer(p:CreatorProject,id:string) { const l=p.layers.find(l=>l.id===id); if(!l) fail('layer id'); return l; }
function nextId(p:CreatorProject) { let i=1; while(p.layers.some(l=>l.id===`layer-${i}`)) i++; return `layer-${i}`; }
export function addLayer(project:CreatorProject,type:ShapeType):CreatorProject {
  const p=copy(project); if(type!=='rect' && type!=='ellipse') fail('shape type');
  p.layers.push({id:nextId(p),name:type==='rect'?'Rectangle':'Ellipse',type,x:p.width/2,y:p.height/2,width:type==='rect'?160:100,height:100,fill:'#1B6C80',stroke:'#203B42',strokeWidth:0,rotation:0,opacity:100,scale:100,tracks:{}});
  validate(p); return p;
}
export function updateLayer(project:CreatorProject,id:string,patch:Partial<Omit<CreatorLayer,'id'|'type'|'tracks'>>):CreatorProject {
  object(patch,layerKeys.filter(k=>!['id','type','tracks'].includes(k)),'patch');
  const p=copy(project); Object.assign(layer(p,id),patch); validate(p); return p;
}
export function removeLayer(project:CreatorProject,id:string):CreatorProject {
  const p=copy(project); layer(p,id); p.layers=p.layers.filter(l=>l.id!==id); return p;
}
export function duplicateLayer(project:CreatorProject,id:string):CreatorProject {
  const p=copy(project); const l=structuredClone(layer(p,id)); l.id=nextId(p); p.layers.push(l); validate(p); return p;
}
export function moveLayer(project:CreatorProject,id:string,direction:'up'|'down'):CreatorProject {
  const p=copy(project); layer(p,id); if(direction!=='up' && direction!=='down') fail('direction');
  const i=p.layers.findIndex(l=>l.id===id), j=i+(direction==='up'?1:-1);
  if(j>=0 && j<p.layers.length) [p.layers[i],p.layers[j]]=[p.layers[j],p.layers[i]];
  return p;
}
