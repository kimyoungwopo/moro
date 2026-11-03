import type {Json,Obj} from '../../../document-core/src';
import type {ProjectV3,LayerV3,PropertyV3,KeyframeV3,PathGeometryV3,PathKeyV3} from './types';
import {validateProjectV3,fail} from './validate';
import {easingCoordinatesV3,bezierTimeV3,bezierV3,sampleNumericV3} from './evaluate';
import {checkSizeV3} from './io';
import {normalizeInvertedMasksV3} from './export-masks';
const constant=(k:Json):Obj=>({a:0,k});
function handles(k:KeyframeV3|PathKeyV3,n=1):Obj {const [x1,y1,x2,y2]=easingCoordinatesV3(k.easing);return {o:{x:Array(n).fill(x1),y:Array(n).fill(y1)},i:{x:Array(n).fill(x2),y:Array(n).fill(y2)}};}
function animated(base:number,keys:KeyframeV3[]):Obj {if(keys.length<2)return constant(keys[0]?.value??base);return {a:1,k:keys.map((key,i):Obj=>({t:key.frame,s:[key.value],...(keys[i+1]?{e:[keys[i+1].value],...handles(key)}:{})}))};}
const channel=(l:LayerV3,p:PropertyV3)=>animated(l[p],l.tracks[p]);
// Exact subdivision of each component's temporal cubic at the union of X/Y
// key times. Sampling/baking linear frames would silently change authored easing.
function splitCurve(keys:KeyframeV3[],start:number,end:number):[number,number,number,number] {
 const index=keys.findIndex((k,i)=>i+1<keys.length&&k.frame<=start&&keys[i+1].frame>=end);
 if(index<0)return [0,0,1,1];const a=keys[index],b=keys[index+1];if(a.value===b.value)return [0,0,1,1];
 const [x1,y1,x2,y2]=easingCoordinatesV3(a.easing),t0=(start-a.frame)/(b.frame-a.frame),t1=(end-a.frame)/(b.frame-a.frame),u0=bezierTimeV3(t0,x1,x2),u1=bezierTimeV3(t1,x1,x2),du=u1-u0,dy=bezierV3(u1,y1,y2)-bezierV3(u0,y1,y2);
 const derivative=(u:number,a:number,b:number)=>3*((1-u)**2*a+2*(1-u)*u*(b-a)+u*u*(1-b));if(dy<=1e-14)return [0,0,1,1];
 // A bounded monotone authored cubic can have a subdivided control polygon
 // outside [0,1] around its stationary point. Clamping those GENERATED handles
 // changes time/value progress. Official BezierEaser supports the exact curve.
 return [derivative(u0,x1,x2)*du/(3*(t1-t0)),derivative(u0,y1,y2)*du/(3*dy),1-derivative(u1,x1,x2)*du/(3*(t1-t0)),1-derivative(u1,y1,y2)*du/(3*dy)];
}
function scale(l:LayerV3):Obj {const x=l.tracks.scaleX,y=l.tracks.scaleY;const vector=(f:number)=>[sampleNumericV3(l.scaleX,x,f),sampleNumericV3(l.scaleY,y,f),100];if(x.length<2&&y.length<2)return constant(vector(0));const times=[...new Set([...x,...y].map(k=>k.frame))].sort((a,b)=>a-b);
 return {a:1,k:times.map((t,i):Obj=>{const out:Obj={t,s:vector(t)},next=times[i+1];if(next!==undefined){const a=splitCurve(x,t,next),b=splitCurve(y,t,next);out.e=vector(next);out.o={x:[a[0],b[0],0],y:[a[1],b[1],0]};out.i={x:[a[2],b[2],1],y:[a[3],b[3],1]};}return out;})};
}
// The official player completes relative handles in-place per keyframe. Never
// share endpoint arrays between a preceding `e` and the next `s`: structuredClone
// preserves aliases, so the shared handles would be converted twice in previews.
function shape(p:PathGeometryV3):Obj {return {v:p.vertices.map(v=>[...v]),i:p.inTangents.map(v=>[...v]),o:p.outTangents.map(v=>[...v]),c:p.closed};}
function pathProperty(base:PathGeometryV3,keys:PathKeyV3[]):Obj {if(keys.length<2)return constant(shape(keys[0]?.value??base));return {a:1,k:keys.map((k,i):Obj=>({t:k.frame,s:[shape(k.value)],...(keys[i+1]?{e:[shape(keys[i+1].value)],...handles(k)}:{})}))};}
const color=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).concat(1);
export function exportLottieV3(project:ProjectV3):Record<string,unknown> {validateProjectV3(project);const layers=[...project.layers].reverse(),ids=new Map(layers.map((l,i)=>[l.id,i+1])),assets:Obj[]=[];const out:Obj={v:'5.13.0',nm:project.name,ddd:0,w:project.width,h:project.height,fr:project.fps,ip:0,op:project.durationFrames,assets,markers:[],layers:layers.map((l):Obj=>{
 const node:Obj={ddd:0,ind:ids.get(l.id)!,ty:l.type==='group'?3:4,nm:l.name,sr:1,st:0,ip:0,op:project.durationFrames,bm:0,ao:0,ks:{a:constant([...l.pivot,0]),p:{s:true,x:channel(l,'x'),y:channel(l,'y')},s:scale(l),r:channel(l,'rotation'),o:channel(l,'opacity'),sk:channel(l,'skew'),sa:channel(l,'skewAxis')}};if(l.parentId!==null)node.parent=ids.get(l.parentId)!;if(l.type==='group')return node;
 if(l.masks.length){node.hasMask=true;node.masksProperties=l.masks.map(m=>({nm:m.name,mode:m.mode==='add'?'a':'s',inv:m.inverted,pt:constant(shape(m.path)),o:constant(m.opacity),x:constant(0)}));}
 const shapes:Obj[]=[l.type==='path'?{ty:'sh',d:1,ks:pathProperty(l.path,l.pathKeys),nm:'Curve'}:{ty:l.type==='rect'?'rc':'el',d:1,p:constant([0,0]),s:constant([l.width,l.height]),...(l.type==='rect'?{r:constant(l.cornerRadius??0)}:{}),nm:l.type==='rect'?'Rectangle':'Ellipse'}];
 if(l.fill!==null)shapes.push({ty:'fl',c:constant(color(l.fill)),o:constant(100),r:1,bm:0,nm:'Fill'});shapes.push({ty:'st',c:constant(color(l.stroke)),o:constant(100),w:constant(l.strokeWidth),lc:l.type==='path'?2:1,lj:l.type==='path'?2:1,ml:4,bm:0,nm:'Stroke'});
 if(l.type==='path'&&l.trim)shapes.push({ty:'tm',s:animated(l.trim.start,l.trim.tracks.start),e:animated(l.trim.end,l.trim.tracks.end),o:animated(l.trim.offset,l.trim.tracks.offset),m:1,nm:'Path trim'});node.shapes=shapes;return normalizeInvertedMasksV3(node,l,project,assets);})};
 // Bound the expanded export before stringifying or cloning it. Authoring remains
 // valid/saveable even when the stricter preview/export budget is exceeded.
 let nodes=0;function scan(v:Json,depth:number){if(++nodes>100000||depth>64)fail('Lottie complexity limit');if(typeof v==='number'&&!Number.isFinite(v))fail('Lottie finite value');if(v&&typeof v==='object')for(const c of Object.values(v))scan(c,depth+1);}scan(out,0);checkSizeV3(JSON.stringify(out),2*1024*1024);return structuredClone(out);
}
