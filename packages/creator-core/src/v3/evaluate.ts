import type {EasingV3,KeyframeV3,LayerV3,PathGeometryV3,ProjectV3,MatrixV3,PathKeyV3,Vec2V3} from './types';
import {curves,fail,num,propertiesV3,validateLayerV3,validateProjectV3} from './validate';
export function bezierV3(t:number,a:number,b:number){return 3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;}
export function easingCoordinatesV3(e:EasingV3):readonly [number,number,number,number] {return typeof e==='string'?curves[e]:[e.x1,e.y1,e.x2,e.y2];}
export function bezierTimeV3(x:number,x1:number,x2:number){if(x<=0)return 0;if(x>=1)return 1;let lo=0,hi=1;for(let n=0;n<52;n++){const m=(lo+hi)/2;if(bezierV3(m,x1,x2)<x)lo=m;else hi=m;}return (lo+hi)/2;}
export function easedV3(t:number,e:EasingV3){if(t<=0)return 0;if(t>=1)return 1;const [x1,y1,x2,y2]=easingCoordinatesV3(e);return bezierV3(bezierTimeV3(t,x1,x2),y1,y2);}
function segment<T extends KeyframeV3|PathKeyV3>(keys:T[],f:number):[T,T,number]|null {if(!keys.length)return null;if(f<=keys[0].frame)return [keys[0],keys[0],0];const last=keys[keys.length-1];if(f>=last.frame)return [last,last,0];const i=keys.findIndex(k=>k.frame>f),a=keys[i-1],b=keys[i];return [a,b,easedV3((f-a.frame)/(b.frame-a.frame),a.easing)];}
export function sampleNumericV3(base:number,keys:KeyframeV3[],frame:number){const s=segment(keys,frame);return s?s[0].value+(s[1].value-s[0].value)*s[2]:base;}
function morph(a:PathGeometryV3,b:PathGeometryV3,t:number):PathGeometryV3 {const mix=(k:'vertices'|'inTangents'|'outTangents')=>a[k].map((v,i)=>v.map((n,j)=>n+(b[k][i][j]-n)*t) as Vec2V3);return {closed:a.closed,vertices:mix('vertices'),inTangents:mix('inTangents'),outTangents:mix('outTangents')};}
export function evaluateLayerV3(layer:LayerV3,frame:number):LayerV3 {validateLayerV3(layer);num(frame,-Number.MAX_VALUE,Number.MAX_VALUE,'sample frame');const out=structuredClone(layer);for(const p of propertiesV3)out[p]=sampleNumericV3(layer[p],layer.tracks[p],frame);if(out.type==='path'&&layer.type==='path'){const s=segment(layer.pathKeys,frame);if(s)out.path=morph(s[0].value,s[1].value,s[2]);}if(out.trim&&layer.trim)for(const p of ['start','end','offset'] as const)out.trim[p]=sampleNumericV3(layer.trim[p],layer.trim.tracks[p],frame);return out;}
export function multiplyV3(a:MatrixV3,b:MatrixV3):MatrixV3 {return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function rotate(r:number):MatrixV3 {return [Math.cos(r),Math.sin(r),-Math.sin(r),Math.cos(r),0,0];}
export function localMatrixV3(layer:LayerV3,frame:number):MatrixV3 {const s=evaluateLayerV3(layer,frame),d=Math.PI/180;
 // Official TransformProperty.js applies anchor, scale, skewFromAxis(-sk,sa),
 // rotate(-r), translation via PREmultiplying Matrix._t. SVG-space order:
 // T R(r) R(-sa) H(-tan(sk)) R(sa) S T(-anchor).
 let m:MatrixV3=[1,0,0,1,s.x,s.y];for(const n of [rotate(s.rotation*d),rotate(-s.skewAxis*d),[1,0,-Math.tan(s.skew*d),1,0,0] as MatrixV3,rotate(s.skewAxis*d),[s.scaleX/100,0,0,s.scaleY/100,0,0] as MatrixV3,[1,0,0,1,-s.pivot[0],-s.pivot[1]] as MatrixV3])m=multiplyV3(m,n);return m;}
export function worldMatrixV3(project:ProjectV3,id:string,frame:number):MatrixV3 {validateProjectV3(project);num(frame,-Number.MAX_VALUE,Number.MAX_VALUE,'sample frame');const nodes=new Map(project.layers.map(l=>[l.id,l])),node=nodes.get(id);if(!node)fail('layer id');function get(l:LayerV3):MatrixV3 {const m=localMatrixV3(l,frame);return l.parentId===null?m:multiplyV3(get(nodes.get(l.parentId)!),m);}const m=get(node);if(!m.every(Number.isFinite))fail('world matrix');return m;}
