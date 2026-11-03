import { useEffect, useRef, useState } from 'react';
import ClaudeConnection from '../ai-auth/ClaudeConnection';
import type { AnimationItem } from 'lottie-web';
import type { ProjectV2 } from '../../../../packages/creator-core/src/v2';
import { createPlayer } from '../../../../packages/player-adapter/src';
import type { Provider, ProviderId } from '../creator/ai/client';
import { RigAiClient, RigAiSession } from './ai';
import type { RigAiState, RigCandidate } from './ai';

function CandidatePreview({candidate,onFailure,onReady}:{candidate:RigCandidate;onFailure:()=>void;onReady:()=>void}){
 const host=useRef<HTMLDivElement>(null);const player=useRef<AnimationItem|null>(null);
 const [frame,setFrame]=useState(0);const [playing,setPlaying]=useState(false);
 const [error,setError]=useState('');const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(!host.current)return;
  let disposed=false;let item:AnimationItem|undefined;
  const failed=()=>{if(disposed)return;setError('The candidate Lottie preview could not render. Apply is blocked.');setPlaying(false);onFailure();};
  try{
   item=createPlayer(host.current,candidate.animation,failed,()=>{if(!disposed){item?.goToAndStop(0,true);setReady(true);onReady();}});player.current=item;
   const enter=()=>{if(!disposed)setFrame(Math.min(candidate.project.durationFrames-1,Math.round(item!.currentFrame)));};
   const complete=()=>{if(!disposed){setPlaying(false);setFrame(candidate.project.durationFrames-1);}};
   item.addEventListener('enterFrame',enter);item.addEventListener('complete',complete);
   return()=>{disposed=true;player.current=null;item!.removeEventListener('enterFrame',enter);item!.removeEventListener('complete',complete);item!.destroy();};
  }catch{failed();return()=>{disposed=true;player.current=null;item?.destroy();};}
 },[candidate,onFailure,onReady]);
 return <div className="rig-ai-review">
  <h3>Review proposal · independent preview</h3>
  <p>{candidate.project.name} · {candidate.project.layers.length} layers · {candidate.project.fps} fps. Not applied to the editor.</p>
  <div ref={host} data-testid="rig-ai-preview" role="img" aria-label="AI candidate Lottie preview" style={{aspectRatio:`${candidate.project.width}/${candidate.project.height}`}}/>
  {error&&<p role="alert" className="rig-error">{error}</p>}
  <div className="rig-actions"><button disabled={!ready||!!error} onClick={()=>{
   const item=player.current;if(!item)return;
   if(playing)item.pause();else{if(item.currentFrame>=candidate.project.durationFrames-1)item.goToAndStop(0,true);item.play();}setPlaying(!playing);
  }}>{playing?'Pause proposal':'Play proposal'}</button>
  <label className="rig-ai-seek">Proposal frame<input aria-label="Proposal frame" type="range" min="0" max={candidate.project.durationFrames-1} step="1" value={frame} disabled={!ready||!!error} onChange={event=>{const next=Number(event.target.value);player.current?.goToAndStop(next,true);setFrame(next);setPlaying(false);}}/></label>
  <output>{frame} / {candidate.project.durationFrames-1}</output></div>
 </div>;
}
export default function RigAiPanel({snapshot,onApply,onClose}:{snapshot:()=>string;onApply:(project:ProjectV2,expected:string)=>void;onClose:()=>void}){
 const [client]=useState(()=>new RigAiClient());
 const session=useRef<RigAiSession|null>(null);
 const [state,setState]=useState<RigAiState>({phase:'idle',active:false});
 const [providers,setProviders]=useState<Provider[]>([]);const [checking,setChecking]=useState(true);const [setup,setSetup]=useState('');
 const [provider,setProvider]=useState<ProviderId>('codex');const [brief,setBrief]=useState('');const [consent,setConsent]=useState(false);
 const [confirming,setConfirming]=useState(false);const [requestError,setRequestError]=useState('');
 const [elapsed,setElapsed]=useState(0);const [previewFailed,setPreviewFailed]=useState(false);
 const [previewReady,setPreviewReady]=useState(false);
 // Stable callback avoids remounting the independent player on each elapsed/frame render.
 const [failPreview]=useState(()=>()=>setPreviewFailed(true));
 const [readyPreview]=useState(()=>()=>setPreviewReady(true));
 const alive=useRef(false);const statusEpoch=useRef(0);
 useEffect(()=>{
  alive.current=true;statusEpoch.current++;const current=new RigAiSession(client,setState);session.current=current;
  return()=>{alive.current=false;current.dispose();session.current=null;};
 },[client]);
 useEffect(()=>{
  let active=true;
  void client.status().then(items=>{if(active){setProviders(items);setSetup('');}}).catch(error=>{if(active)setSetup(error.message);}).finally(()=>{if(active)setChecking(false);});
  return()=>{active=false;};
 },[client]);
 useEffect(()=>{
  if(!state.active||state.startedAt===undefined)return;
  const tick=()=>setElapsed(Math.max(0,Math.floor((Date.now()-state.startedAt!)/1000)));tick();
  const timer=setInterval(tick,1000);return()=>clearInterval(timer);
 },[state.active,state.startedAt]);
 const count=Array.from(brief.trim()).length;
 const installed=providers.some(item=>item.id===provider&&item.installed);
 const canGenerate=installed&&!checking&&!setup&&!state.active&&consent&&count>0&&count<=4000;
 function generate(){
  if(!confirming||!canGenerate)return;
  try{
   const expected=snapshot(); // Freeze locally at the confirmed submit, never in the payload.
   setConfirming(false);setConsent(false);setRequestError('');setPreviewFailed(false);setPreviewReady(false);setElapsed(0);
   void session.current?.generate(provider,brief,true,expected);
  }catch(error){setRequestError(error instanceof Error?error.message:'Request could not start.');}
 }
 return <section className="rig-ai-panel" role="region" aria-label="AI motion v2">
  <div className="rig-ai-heading"><h2>AI motion v2 <small>Experimental object motion</small></h2><button onClick={onClose}>Close AI panel</button></div>
  <p className="rig-hint">Only this brief is sent. No current project, files or repository are uploaded. Your frozen editor snapshot stays on this device.</p>
  <p className="rig-hint">Uses your official Codex / Claude Code CLI account, authentication, billing and quota. You own CLI installation and sign-in. Installed does not mean logged in. Human-character quality remains unapproved; technical validation is not artistic approval.</p>
  <form onSubmit={event=>{event.preventDefault();if(canGenerate){setRequestError('');setConfirming(true);}}}>
   <div className="rig-ai-inputs"><label className="rig-field"><span>AI provider</span><select aria-label="AI provider" value={provider} disabled={state.active||confirming} onChange={event=>setProvider(event.target.value as ProviderId)}>
    {(['codex','claude'] as const).map(id=><option value={id} key={id}>{id==='codex'?'Codex':'Claude Code'} — {checking?'checking':providers.some(item=>item.id===id&&item.installed)?'installed':'not detected'}</option>)}
   </select></label><button type="button" disabled={checking||state.active||confirming} onClick={()=>{
    const epoch=++statusEpoch.current;setChecking(true);setSetup('');
    void client.status().then(items=>{if(alive.current&&epoch===statusEpoch.current)setProviders(items);}).catch(error=>{if(alive.current&&epoch===statusEpoch.current)setSetup(error.message);}).finally(()=>{if(alive.current&&epoch===statusEpoch.current)setChecking(false);});
   }}>Check installed CLIs</button></div>
   <p className="rig-hint">Installed-only status check · no model request.</p>
   {setup&&<p role="alert" className="rig-error">{setup}</p>}
   {provider === 'claude' && <ClaudeConnection disabled={state.active || confirming} />}
   <label className="rig-field"><span>Animation brief</span><textarea aria-label="Animation brief" rows={3} value={brief} disabled={state.active||confirming} onChange={event=>setBrief(event.target.value)} placeholder="Describe an object, its motion and timing. This creates a replacement proposal, not a revision of your current project."/></label>
   <p className="rig-hint">{count} / 4000 characters · proposal replaces the whole project only after Apply.</p>
   <label className="rig-check"><input type="checkbox" checked={consent} disabled={state.active||confirming} onChange={event=>setConsent(event.target.checked)}/>I agree to send this brief to the selected AI provider.</label>
   <button type="submit" className="rig-primary" disabled={!canGenerate||confirming}>Generate proposal</button>
  </form>
  {confirming&&<div className="rig-ai-confirm" role="group" aria-label="Confirm one AI request"><p>Send one request to {provider==='codex'?'Codex':'Claude Code'} using your official CLI account? This may consume your account quota. No automatic retry.</p><div className="rig-actions"><button className="rig-primary" onClick={generate}>Confirm one AI request</button><button onClick={()=>setConfirming(false)}>Back to brief</button></div></div>}
  {requestError&&<p role="alert" className="rig-error">{requestError}</p>}
  <p role="status" className="rig-notice">{state.active?`${state.phase==='cancelling'?'Cancelling':'Running'} · ${elapsed}s elapsed (actual request time). No estimated progress.`:state.phase==='review'?'Review ready. Validated v2 project and export budget; your editor is unchanged.':state.phase==='failed'?'Request error. Your Rig project is unchanged.':state.phase==='cancelled'?'Generation cancelled. Your Rig project is unchanged.':state.phase==='applied'?'Proposal applied.':'Ready for an explicit, confirmed request.'}</p>
  {state.message&&<p role={state.phase==='failed'||state.phase==='review'?'alert':'status'} className={state.phase==='failed'||state.phase==='review'?'rig-error':'rig-hint'}>{state.message}</p>}
  {state.active&&<button onClick={()=>{void session.current?.cancel();}}>Cancel generation</button>}
  {state.phase==='review'&&state.candidate&&<>
   <p className="rig-hint">Submitted to {state.provider}: <span className="rig-ai-brief">{state.submittedBrief}</span></p>
   <CandidatePreview candidate={state.candidate} onFailure={failPreview} onReady={readyPreview}/>
   <div className="rig-actions"><button className="rig-primary" disabled={previewFailed||!previewReady} onClick={()=>session.current?.apply(onApply)}>Apply proposal</button><button onClick={onClose}>Discard proposal</button></div>
  </>}
 </section>;
}
