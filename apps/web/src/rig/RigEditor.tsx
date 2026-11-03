import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { AnimationItem } from 'lottie-web';
import {
 createProjectV2, addLayerV2, updateLayerV2, removeLayerV2, duplicateLayerV2, moveLayerV2,
 setKeyframeV2, removeKeyframeV2, sampleLayerV2, worldMatricesV2, transformPointV2,
 pathDataV2, layerBoundsV2, setPivotV2, reparentLayerV2, serializeProjectV2, parseProjectV2,
 migrateProjectV1, exportLottieV2,
} from '../../../../packages/creator-core/src/v2';
import type { ProjectV2, LayerV2, Vec2, Property, Easing } from '../../../../packages/creator-core/src/v2';
import { parseProject } from '../../../../packages/creator-core/src';
import { createPlayer } from '../../../../packages/player-adapter/src';
import { createHistory, commitHistory, undoHistory, redoHistory, beginGesture, endGesture, cancelGesture } from './history';
import type { History } from './history';
import { dragLayer, dragHandle, convertPath, nearestHandle } from './editing';
import type { Handle } from './editing';
import RigAiPanel from './RigAiPanel';
import { prepareRigAiApply } from './ai';
import './rig.css';

const properties:Property[]=['x','y','scale','rotation','opacity'];
const easings:Easing[]=['linear','ease-in','ease-out','ease-in-out'];
const errorText=(error:unknown)=>error instanceof Error?error.message:'This edit could not be applied.';
function download(text:string,name:string){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const a=document.createElement('a'); a.href=url; a.download=name; a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Field({label,value,onCommit,type='number',disabled=false}:{label:string;value:string|number;onCommit:(text:string)=>void;type?:'number'|'text';disabled?:boolean}){
 return <label className="rig-field"><span>{label}</span><input key={String(value)} aria-label={label} type={type} step={type==='number'?'any':undefined} defaultValue={value} disabled={disabled}
 onBlur={event=>{ if(event.currentTarget.value!==String(value)) onCommit(event.currentTarget.value); }}
 onKeyDown={event=>{if(event.key==='Enter'){event.currentTarget.blur();} if(event.key==='Escape'){event.currentTarget.value=String(value);event.currentTarget.blur();}}}/></label>;
}
function NumberField({label,value,onCommit,disabled}:{label:string;value:number;onCommit:(value:number)=>void;disabled?:boolean}){
 return <Field label={label} value={value} disabled={disabled} onCommit={text=>onCommit(text.trim()===''?NaN:Number(text))}/>;
}
function Geometry({layer}:{layer:LayerV2}){
 if(layer.type==='group') return null;
 const style={fill:layer.fill??'none',stroke:layer.stroke,strokeWidth:layer.strokeWidth};
 if(layer.type==='path') return <path d={pathDataV2(layer.path)} {...style} strokeLinecap="round" strokeLinejoin="round"/>;
 if(layer.type==='rect') return <rect x={-layer.width/2} y={-layer.height/2} width={layer.width} height={layer.height} rx={layer.cornerRadius??0} {...style}/>;
 return <ellipse rx={layer.width/2} ry={layer.height/2} {...style}/>;
}
type Drag={pointer:number;id:string;frame:number;source:ProjectV2;from:Vec2;handle?:Handle;offset:Vec2};
export default function RigEditor(){
 const [history,setHistory]=useState(()=>createHistory(createProjectV2()));
 const historyRef=useRef(history); historyRef.current=history;
 const project=history.present;
 const [saved,setSaved]=useState(()=>serializeProjectV2(project));
 const serialized=useMemo(()=>serializeProjectV2(project),[project]);
 const dirty=serialized!==saved;
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=project.layers.find(layer=>layer.id===selectedId);
 const [vertex,setVertex]=useState(0);
 const [frame,setFrame]=useState(0); const frameRef=useRef(frame);frameRef.current=frame;
 const [playing,setPlaying]=useState(false);
 const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const [property,setProperty]=useState<Property>('x');
 const [keyValue,setKeyValue]=useState(0); const [easing,setEasing]=useState<Easing>('linear');
 const [pivotX,setPivotX]=useState(0); const [pivotY,setPivotY]=useState(0);
 const [showNew,setShowNew]=useState(false);
 const [showAi,setShowAi]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null); const copyRef=useRef<HTMLInputElement>(null);
 const canvas=useRef<SVGSVGElement>(null); const preview=useRef<HTMLDivElement>(null);
 const player=useRef<AnimationItem|null>(null); const drag=useRef<Drag|null>(null);
 const [canvasPixels,setCanvasPixels]=useState(512);
 const world=useMemo(()=>worldMatricesV2(project,frame),[project,frame]);
 const exported=useMemo(()=>{try{return{animation:exportLottieV2(project),error:''};}catch(failure){return{animation:null,error:errorText(failure)};}},[project]);
 const animation=exported.animation;
 const sampled=selected?sampleLayerV2(selected,frame):null;
 const activeVertex=selected?.type==='path'?Math.min(vertex,selected.path.vertices.length-1):0;
 const bounds=selected?layerBoundsV2(project,selected.id,frame):null;
 const handleRadius=7*project.width/canvasPixels; const targetRadius=22*project.width/canvasPixels;
 function replaceHistory(next:History<ProjectV2>){historyRef.current=next;setHistory(next);}
 function apply(change:(current:ProjectV2)=>ProjectV2){
  if(drag.current) return null;
  try{const next=change(historyRef.current.present);replaceHistory(commitHistory(historyRef.current,next));setError('');return next;}
  catch(failure){setError(errorText(failure));return null;}
 }
 function cancel(){if(!drag.current)return;drag.current=null;replaceHistory(cancelGesture(historyRef.current));}
 function applyAi(candidate:ProjectV2,expected:string){
  // Synchronous parent boundary: no render snapshot or async setState freshness check.
  if(drag.current||historyRef.current.gesture)throw Error('Finish the active gesture before applying this proposal.');
  if(serializeProjectV2(historyRef.current.present)!==expected)throw Error('Your project changed after this request. Generate a fresh proposal before applying.');
  const next=prepareRigAiApply(historyRef.current,expected,candidate);
  replaceHistory(commitHistory(historyRef.current,next));
  setPlaying(false);setFrame(0);setSelectedId(null);setError('');
  setNotice('Applied AI proposal. Undo restores the previous project. Save v2 project and Export Lottie use the existing controls. Human-character quality remains unapproved.');
 }
 function undo(){setPlaying(false);if(drag.current){cancel();return;}replaceHistory(undoHistory(historyRef.current));setError('');}
 function redo(){setPlaying(false);if(drag.current){cancel();return;}replaceHistory(redoHistory(historyRef.current));setError('');}
 function seek(value:number){if(!Number.isFinite(value))return;cancel();setPlaying(false);setFrame(Math.min(project.durationFrames-1,Math.max(0,Math.round(value))));}
 function select(id:string){setSelectedId(id);setVertex(0);setProperty('x');const node=historyRef.current.present.layers.find(layer=>layer.id===id);if(node)setKeyValue(sampleLayerV2(node,frameRef.current).x);setError('');}
 function patch(value:Parameters<typeof updateLayerV2>[2]){if(selected)apply(p=>updateLayerV2(p,selected.id,value));}
 function setPropertyValue(prop:Property,value:number){
   if(!selected)return;
  setPlaying(false);const frozen=Math.round(frameRef.current);setFrame(frozen);
  apply(p=>selected.tracks[prop].length?setKeyframeV2(p,selected.id,prop,frozen,value,easing):updateLayerV2(p,selected.id,{[prop]:value}));
 }
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const observer=new ResizeObserver(()=>setCanvasPixels(Math.max(1,element.getBoundingClientRect().width)));
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!preview.current||!animation)return;
  const item=createPlayer(preview.current,animation,()=>setError('Lottie player could not render this export.'),()=>item.goToAndStop(frameRef.current,true));
  player.current=item;return()=>{player.current=null;item.destroy();};
 },[animation]);
 useEffect(()=>{player.current?.goToAndStop(frame,true);},[frame]);
 useEffect(()=>{
  if(!playing)return;
  const started=performance.now();const first=frameRef.current;let raf=0;
  const tick=(now:number)=>{const next=first+(now-started)*project.fps/1000;
   if(next>=project.durationFrames-1){setFrame(project.durationFrames-1);setPlaying(false);return;}
   setFrame(next);raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[playing,project.fps,project.durationFrames]);
 useEffect(()=>{
  const listener=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',listener);return()=>window.removeEventListener('beforeunload',listener);
 },[dirty]);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');const changed=()=>{if(media.matches)setPlaying(false);};
  media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);
 },[]);
 const selectedPivotX=selected?.pivot[0]??0; const selectedPivotY=selected?.pivot[1]??0;
 useEffect(()=>{setPivotX(selectedPivotX);setPivotY(selectedPivotY);},[selectedId,selectedPivotX,selectedPivotY]);
 function canvasPoint(event:ReactPointerEvent):Vec2{
  const ctm=canvas.current?.getScreenCTM();if(!ctm)throw Error('Canvas transform is unavailable.');
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());return [point.x,point.y];
 }
 function startDrag(event:ReactPointerEvent,id:string,handle?:Handle){
  if(event.button!==0||drag.current)return;event.preventDefault();event.stopPropagation();
  try{
   const frozen=Math.round(frameRef.current);setPlaying(false);setFrame(frozen);
   const source=historyRef.current.present;const from=canvasPoint(event);
   const resolved=handle?nearestHandle(source,id,frozen,from,activeVertex):undefined;
   setSelectedId(id);if(resolved)setVertex(resolved.index);
   const offset:Vec2=[0,0];const node=source.layers.find(layer=>layer.id===id);
   if(resolved&&node?.type==='path'){
    const vertex=node.path.vertices[resolved.index];const tangent=resolved.kind==='vertex'?[0,0]:node.path[resolved.kind==='in'?'inTangents':'outTangents'][resolved.index];
    const actual=transformPointV2(worldMatricesV2(source,frozen).get(id)!,[vertex[0]+tangent[0],vertex[1]+tangent[1]]);
    offset[0]=actual[0]-from[0];offset[1]=actual[1]-from[1];
   }
   drag.current={pointer:event.pointerId,id,frame:frozen,source,from,handle:resolved,offset};
   replaceHistory(beginGesture(historyRef.current));canvas.current?.setPointerCapture(event.pointerId);setError('');
  }catch(failure){cancel();setError(errorText(failure));}
 }
 function moveDrag(event:ReactPointerEvent){
  const gesture=drag.current;if(!gesture||event.pointerId!==gesture.pointer)return;
  try{const point=canvasPoint(event);
   const next=gesture.handle?dragHandle(gesture.source,gesture.id,gesture.frame,gesture.handle,[point[0]+gesture.offset[0],point[1]+gesture.offset[1]]):dragLayer(gesture.source,gesture.id,gesture.frame,gesture.from,point);
   replaceHistory(commitHistory(historyRef.current,next));setError('');
  }catch(failure){cancel();setError(errorText(failure));}
 }
 function finishDrag(event:ReactPointerEvent){
  if(!drag.current||event.pointerId!==drag.current.pointer)return;
  drag.current=null;replaceHistory(endGesture(historyRef.current));
  if(canvas.current?.hasPointerCapture(event.pointerId))canvas.current.releasePointerCapture(event.pointerId);
 }
 function editPoint(kind:Handle['kind'],axis:number,value:number){
  if(selected?.type!=='path')return;
  const field=kind==='vertex'?'vertices':kind==='in'?'inTangents':'outTangents';
  const path=structuredClone(selected.path);path[field][activeVertex][axis]=value;patch({path});
 }
 function addVertex(){
  if(selected?.type!=='path')return;
  const path=structuredClone(selected.path);const last=path.vertices[path.vertices.length-1];
  path.vertices.push([last[0]+40,last[1]+40]);path.inTangents.push([0,0]);path.outTangents.push([0,0]);
  if(apply(p=>updateLayerV2(p,selected.id,{path})))setVertex(path.vertices.length-1);
 }
 function removeVertex(){
  if(selected?.type!=='path')return;
  const path=structuredClone(selected.path);
  for(const field of ['vertices','inTangents','outTangents'] as const)path[field].splice(activeVertex,1);
  if(!path.closed&&path.vertices.length){path.inTangents[0]=[0,0];path.outTangents[path.vertices.length-1]=[0,0];}
  if(apply(p=>updateLayerV2(p,selected.id,{path})))setVertex(Math.max(0,activeVertex-1));
 }
 async function openFile(file:File|undefined,copy:boolean){
  if(!file)return;
  try{
   if(file.size>8*1024*1024)throw Error('Project file exceeds 8 MiB.');
   const text=await file.text();const next=copy?migrateProjectV1(parseProject(text)):parseProjectV2(text);
   if(dirty&&!window.confirm('Replace unsaved Rig lab edits?'))return;
   cancel();setPlaying(false);setFrame(0);setSelectedId(null);
   if(copy){replaceHistory(commitHistory(historyRef.current,next));setNotice('Imported a v1 COPY. The original file is unchanged. Save this as a new v2 project.');}
   else{replaceHistory(createHistory(next));setSaved(serializeProjectV2(next));setNotice('Opened editable v2 project.');}
   setError('');
  }catch(failure){setError(errorText(failure));}
 }
 const filename=(project.name.replace(/[^a-z0-9_-]+/gi,'-')||'rig-project');
 return <main className="moro-rig" onKeyDown={event=>{
  if(event.key==='Escape'){cancel();setPlaying(false);}
  const target=event.target as HTMLElement;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(target.tagName)){event.preventDefault();if(event.shiftKey)redo();else undo();}
 }}>
  <header className="rig-header"><div><h1>Rig lab</h1><p>Local v2 · cubic paths & transform hierarchies</p></div><span className="rig-save-state">{dirty?'Unsaved edits':'Saved snapshot'}</span>
   <div className="rig-actions">
    <button aria-expanded={showAi} onClick={()=>setShowAi(!showAi)}>AI generate v2</button>
    <button onClick={()=>setShowNew(!showNew)}>New project</button>
    <button onClick={()=>fileRef.current?.click()}>Open v2 project</button>
    <button onClick={()=>copyRef.current?.click()}>Import v1 COPY</button>
    <button onClick={()=>{try{download(serializeProjectV2(project),`${filename}.moro.json`);setSaved(serializeProjectV2(project));setNotice('Editable v2 file downloaded.');}catch(failure){setError(errorText(failure));}}}>Save v2 project</button>
    <button className="rig-primary" disabled={!animation} onClick={()=>{try{download(JSON.stringify(exportLottieV2(project),null,2),`${filename}.lottie.json`);setNotice('Exported Lottie JSON. Export does not save the editable project.');}catch(failure){setError(errorText(failure));}}}>Export Lottie</button>
   </div>
   <input hidden aria-label="Open v2 project file" ref={fileRef} type="file" accept=".json,.moro.json" onChange={event=>{void openFile(event.target.files?.[0],false);event.target.value='';}}/>
   <input hidden aria-label="Import v1 copy file" ref={copyRef} type="file" accept=".json,.moro.json" onChange={event=>{void openFile(event.target.files?.[0],true);event.target.value='';}}/>
  </header>
  {showNew&&<form className="rig-new" aria-label="New rig project" onSubmit={event=>{
   event.preventDefault();const form=new FormData(event.currentTarget);
   if(dirty&&!window.confirm('Replace unsaved Rig lab edits?'))return;
   const next=apply(()=>createProjectV2({name:String(form.get('name')),width:Number(form.get('width')),height:Number(form.get('height')),fps:Number(form.get('fps')),durationFrames:Number(form.get('duration'))}));
   if(next){setFrame(0);setPlaying(false);setSelectedId(null);setShowNew(false);}
  }}>
   <label>Project name<input aria-label="New project name" name="name" defaultValue="Untitled rig" required/></label>
   <label>Canvas width<input aria-label="Canvas width" type="number" name="width" min="16" max="4096" defaultValue="512" required/></label>
   <label>Canvas height<input aria-label="Canvas height" type="number" name="height" min="16" max="4096" defaultValue="512" required/></label>
   <label>FPS<input aria-label="Frames per second" type="number" name="fps" min="1" max="120" defaultValue="60" required/></label>
   <label>Duration<input aria-label="Duration frames" type="number" name="duration" min="2" max="3600" defaultValue="120" required/></label>
   <button type="submit">Create blank rig</button><button type="button" onClick={()=>setShowNew(false)}>Cancel new project</button>
  </form>}
  {(error||exported.error)&&<p className="rig-error" role="alert">{error||exported.error}</p>}
  <p className="rig-notice" role="status">{notice||'Local manual v2 authoring · optional, explicitly confirmed AI object-motion proposals. Experimental; human-character quality remains unapproved.'}</p>
  {showAi&&<RigAiPanel snapshot={()=>serializeProjectV2(historyRef.current.present)} onApply={applyAi} onClose={()=>setShowAi(false)}/>}
  <div className="rig-workspace">
   <aside className="rig-layers" aria-label="Rig layers"><h2>Layers <small>{project.layers.length}/100</small></h2>
    <div className="rig-add">{(['rect','ellipse','path','group'] as const).map(type=><button key={type} onClick={()=>{const next=apply(p=>addLayerV2(p,type));if(next)select(next.layers[next.layers.length-1].id);}}>Add {type}</button>)}</div>
    <div className="rig-actions"><button disabled={!history.past.length&&!history.gesture} onClick={undo}>Undo</button><button disabled={!history.future.length||!!history.gesture} onClick={redo}>Redo</button></div>
    <p className="rig-hint">Top first · paint order, not tree order</p>
    <ol>{[...project.layers].reverse().map(layer=><li key={layer.id}><button aria-label={`Select ${layer.name}`} aria-pressed={layer.id===selectedId} onClick={()=>select(layer.id)}><span>{layer.type==='group'?'◇':layer.type==='path'?'⌁':'▱'}</span><span>{layer.name}<small>{layer.type}{layer.parentId?` · in ${project.layers.find(p=>p.id===layer.parentId)?.name}`:' · root'}</small></span></button></li>)}</ol>
    {!project.layers.length&&<p className="rig-hint">Add a path to start editing vertices and tangents.</p>}
    {selected&&<div className="rig-layer-actions"><button onClick={()=>apply(p=>moveLayerV2(p,selected.id,'up'))}>Move up</button><button onClick={()=>apply(p=>moveLayerV2(p,selected.id,'down'))}>Move down</button><button onClick={()=>{const next=apply(p=>duplicateLayerV2(p,selected.id));if(next)select(next.layers[next.layers.length-1].id);}}>Duplicate subtree</button><button onClick={()=>{if(apply(p=>removeLayerV2(p,selected.id)))setSelectedId(null);}}>Remove layer</button></div>}
   </aside>
   <section className="rig-stage" aria-label="Rig authoring stage">
    <div className="rig-stage-heading"><h2>{project.name}</h2><small>{project.width} × {project.height} · {project.fps} fps</small></div>
    <svg className="rig-canvas" ref={canvas} data-testid="rig-canvas" role="img" aria-label="Rig authoring canvas" viewBox={`0 0 ${project.width} ${project.height}`} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancel} onLostPointerCapture={cancel}>
     <rect width={project.width} height={project.height} fill="#ffffff" onPointerDown={()=>{if(!drag.current)setSelectedId(null);}}/>
     {project.layers.filter(layer=>layer.type!=='group').map(layer=><g key={layer.id} data-layer-id={layer.id} aria-label={`Canvas ${layer.name}`} transform={`matrix(${world.get(layer.id)!.join(' ')})`} opacity={sampleLayerV2(layer,frame).opacity/100} onPointerDown={event=>startDrag(event,layer.id)} className="rig-shape"><Geometry layer={layer}/></g>)}
     {bounds&&selected&&<g className="rig-selection"><rect data-testid="rig-selection" x={bounds.minX} y={bounds.minY} width={Math.max(1,bounds.maxX-bounds.minX)} height={Math.max(1,bounds.maxY-bounds.minY)} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents={selected.type==='group'?'all':'none'} onPointerDown={event=>startDrag(event,selected.id)}/>
      <circle cx={transformPointV2(world.get(selected.id)!,selected.pivot)[0]} cy={transformPointV2(world.get(selected.id)!,selected.pivot)[1]} r={handleRadius*.6} fill="white" stroke="var(--accent)" pointerEvents="none"/>
     </g>}
     {selected?.type==='path'&&<g className="rig-handles">
      {selected.path.vertices.map((point,index)=>{const at=transformPointV2(world.get(selected.id)!,point);return <g key={index} onPointerDown={event=>startDrag(event,selected.id,{kind:'vertex',index})} data-testid={`rig-vertex-${index}`} aria-label={`Vertex ${index+1}`}><circle cx={at[0]} cy={at[1]} r={targetRadius} fill="transparent"/><circle cx={at[0]} cy={at[1]} r={handleRadius} fill={activeVertex===index?'var(--accent)':'white'} stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/></g>;})}
      {(['in','out'] as const).map(kind=>{
       if(!selected.path.closed&&((kind==='in'&&activeVertex===0)||(kind==='out'&&activeVertex===selected.path.vertices.length-1)))return null;
       const point=selected.path.vertices[activeVertex];const tangent=selected.path[kind==='in'?'inTangents':'outTangents'][activeVertex];
       const from=transformPointV2(world.get(selected.id)!,point);const to=transformPointV2(world.get(selected.id)!,[point[0]+tangent[0],point[1]+tangent[1]]);
       return <g key={kind} data-testid={`rig-tangent-${kind}`} aria-label={`${kind} tangent`} onPointerDown={event=>startDrag(event,selected.id,{kind,index:activeVertex})}>
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="var(--accent)" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
        <circle cx={to[0]} cy={to[1]} r={targetRadius} fill="transparent"/><rect x={to[0]-handleRadius*.8} y={to[1]-handleRadius*.8} width={handleRadius*1.6} height={handleRadius*1.6} fill="white" stroke="var(--accent)" vectorEffect="non-scaling-stroke"/>
       </g>;
      })}
     </g>}
    </svg>
    <div className="rig-transport"><button onClick={()=>{cancel();setPlaying(!playing);}}>{playing?'Pause':'Play'}</button><button onClick={()=>seek(0)}>First frame</button>
     <label>Frame<input aria-label="Seek frame" type="range" min="0" max={project.durationFrames-1} step="1" value={Math.round(frame)} onChange={event=>seek(Number(event.target.value))}/></label>
     <NumberField label="Current frame" value={Math.round(frame)} onCommit={seek}/><output>{Math.round(frame)} / {project.durationFrames-1}</output>
    </div>
    <details className="rig-player" open><summary>Export player · same frame</summary><div ref={preview} data-testid="rig-preview" aria-label="Lottie export preview" style={{aspectRatio:`${project.width}/${project.height}`}}/></details>
   </section>
   <aside className="rig-inspector" aria-label="Rig inspector"><h2>Inspector</h2>
    {!selected||!sampled?<p className="rig-hint">Select a layer or a group. Drag the shape to move; select path vertices to author cubic curves.</p>:<>
     <Field label="Layer name" type="text" value={selected.name} onCommit={name=>patch({name})}/>
     <label className="rig-field"><span>Parent group · preserve world</span><select aria-label="Parent group" value={selected.parentId??''} onChange={event=>apply(p=>reparentLayerV2(p,selected.id,event.target.value||null))}><option value="">Canvas root</option>{project.layers.filter(layer=>layer.type==='group'&&layer.id!==selected.id).map(layer=><option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label>
     <p className="rig-hint">Parenting requires static target and old/new ancestry. Rejected edits leave the project unchanged.</p>
     <h3>Local transforms</h3><div className="rig-grid">{properties.filter(prop=>selected.type!=='group'||prop!=='opacity').map(prop=><NumberField key={prop} label={prop==='x'?'Parent-local pivot X':prop==='y'?'Parent-local pivot Y':prop==='scale'?'Scale (%)':prop==='rotation'?'Rotation (°)':'Opacity (%)'} value={sampled[prop]} onCommit={value=>setPropertyValue(prop,value)}/>)}</div>
     <p className="rig-hint">Animated channels edit a key at the current frame. Groups transform only; opacity does not inherit.</p>
     <h3>Static local pivot</h3><div className="rig-grid"><NumberField label="Pivot X" value={pivotX} onCommit={setPivotX}/><NumberField label="Pivot Y" value={pivotY} onCommit={setPivotY}/></div>
     <div className="rig-actions"><button onClick={()=>apply(p=>setPivotV2(p,selected.id,[pivotX,pivotY],false))}>Apply pivot</button><button onClick={()=>apply(p=>setPivotV2(p,selected.id,[pivotX,pivotY],true))}>Preserve-world pivot</button></div>
     <p className="rig-hint">Preserve-world pivot rejects transform animation; it never bakes a single pose.</p>
     {selected.type!=='group'&&<><h3>Geometry & style</h3>{selected.type!=='path'&&<div className="rig-grid"><NumberField label="Width" value={selected.width} onCommit={width=>patch({width})}/><NumberField label="Height" value={selected.height} onCommit={height=>patch({height})}/>{selected.type==='rect'&&<NumberField label="Corner radius" value={selected.cornerRadius??0} onCommit={cornerRadius=>patch({cornerRadius})}/>}</div>}
      <Field label="Fill hex or none" type="text" value={selected.fill??'none'} onCommit={text=>patch({fill:text==='none'?null:text})}/><Field label="Stroke hex" type="text" value={selected.stroke} onCommit={stroke=>patch({stroke})}/><NumberField label="Stroke width" value={selected.strokeWidth} onCommit={strokeWidth=>patch({strokeWidth})}/></>}
     {selected.type==='path'&&<section aria-label="Cubic path editor"><h3>Cubic path</h3><label className="rig-check"><input aria-label="Closed path" type="checkbox" checked={selected.path.closed} onChange={event=>apply(p=>convertPath(p,selected.id,event.target.checked))}/>Closed contour</label><p className="rig-hint">Opening clears fill and the unused end handles. Tangents are offsets from the selected vertex.</p>
      <label className="rig-field"><span>Selected vertex</span><select aria-label="Selected vertex" value={activeVertex} onChange={event=>setVertex(Number(event.target.value))}>{selected.path.vertices.map((_,index)=><option key={index} value={index}>Vertex {index+1}</option>)}</select></label>
      {(['vertex','in','out'] as const).map(kind=><div className="rig-grid" key={kind}>{([0,1] as const).map(axis=>{const unused=!selected.path.closed&&((kind==='in'&&activeVertex===0)||(kind==='out'&&activeVertex===selected.path.vertices.length-1));return <NumberField key={axis} label={`${kind==='vertex'?'Vertex':kind==='in'?'In tangent':'Out tangent'} ${axis===0?'X':'Y'}`} value={selected.path[kind==='vertex'?'vertices':kind==='in'?'inTangents':'outTangents'][activeVertex][axis]} disabled={unused} onCommit={value=>editPoint(kind,axis,value)}/>;})}</div>)}
      <div className="rig-actions"><button onClick={addVertex}>Add vertex</button><button onClick={removeVertex}>Remove vertex</button></div>
     </section>}
     <section aria-label="Rig keyframes"><h3>Keyframes</h3><label className="rig-field"><span>Keyframe channel</span><select aria-label="Keyframe channel" value={property} onChange={event=>{setProperty(event.target.value as Property);setKeyValue(sampled[event.target.value as Property]);}}>{properties.filter(prop=>selected.type!=='group'||prop!=='opacity').map(prop=><option key={prop}>{prop}</option>)}</select></label>
      <NumberField label="Keyframe value" value={keyValue} onCommit={setKeyValue}/><label className="rig-field"><span>Outgoing easing</span><select aria-label="Keyframe easing" value={easing} onChange={event=>setEasing(event.target.value as Easing)}>{easings.map(value=><option key={value}>{value}</option>)}</select></label>
      <div className="rig-actions"><button onClick={()=>apply(p=>setKeyframeV2(p,selected.id,property,Math.round(frame),keyValue,easing))}>Insert keyframe</button><button onClick={()=>apply(p=>removeKeyframeV2(p,selected.id,property,Math.round(frame)))}>Remove keyframe</button></div>
      <div className="rig-key-list">{selected.tracks[property].map(key=><button key={key.frame} aria-label={`Seek ${property} key ${key.frame}`} onClick={()=>{seek(key.frame);setKeyValue(key.value);setEasing(key.easing);}}>{key.frame}f · {key.value} · {key.easing}</button>)}</div>
     </section>
    </>}
   </aside>
  </div>
 </main>;
}
