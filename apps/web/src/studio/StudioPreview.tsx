import {useCallback,useEffect,useRef,useState} from 'react';
import type {AnimationItem} from 'lottie-web';
import {exportLottieV3,type ProjectV3} from '../../../../packages/creator-core/src/v3';
import {createPlayer} from '../../../../packages/player-adapter/src';
export default function StudioPreview({project,frame,onFrame,canPlay=false,onReviewed,onFailure,staticFrame=false,label}:{project:ProjectV3;frame:number;onFrame:(frame:number)=>void;canPlay?:boolean;onReviewed?:()=>void;onFailure?:()=>void;staticFrame?:boolean;label:string}){
 const container=useRef<HTMLDivElement>(null),player=useRef<AnimationItem|null>(null),reviewed=useRef(onReviewed),failed=useRef(onFailure),currentFrame=useRef(frame);
 const [failure,setFailure]=useState(''),[ready,setReady]=useState(false),[playing,setPlaying]=useState(false),[displayFrame,setDisplayFrame]=useState(frame);
 reviewed.current=onReviewed;failed.current=onFailure;currentFrame.current=frame;
 const fail=useCallback(()=>{setFailure('미리보기를 표시하지 못했어요. 문서 편집·저장과 제안 다운로드는 계속 사용할 수 있어요.');setPlaying(false);setReady(false);failed.current?.();},[]);
 useEffect(()=>{
  let item:AnimationItem|undefined;setReady(false);setFailure('');setPlaying(false);setDisplayFrame(currentFrame.current);
  try{
   const animation=exportLottieV3(project);
   item=createPlayer(container.current!,animation as Parameters<typeof createPlayer>[1],fail,()=>{try{item?.goToAndStop(currentFrame.current,true);setReady(true);}catch{fail();}});player.current=item;
   item.addEventListener('complete',()=>setPlaying(false));
   item.addEventListener('enterFrame',event=>setDisplayFrame(Math.floor(event.currentTime)));
  }catch{fail();}
  return ()=>{try{item?.destroy();}catch{/* isolate player teardown from editable document */}player.current=null;};
 },[project,fail]);
 useEffect(()=>{try{player.current?.goToAndStop(frame,true);setPlaying(false);setDisplayFrame(frame);}catch{fail();}},[frame,fail]);
 function play(){try{if(playing){player.current?.pause();setPlaying(false);}else{const next=displayFrame>=project.durationFrames-1?0:displayFrame;player.current?.goToAndPlay(next,true);setPlaying(true);reviewed.current?.();}}catch{fail();}}
 return <div className="studio-preview"><div className="studio-preview-heading"><span>{label}</span><span>{project.width} × {project.height}</span></div><div className="studio-artboard" style={{aspectRatio:`${project.width}/${project.height}`}}><div ref={container} role="img" aria-label={label}/>{!project.layers.length&&<p className="studio-blank">아직 비어 있는 장면<br/><small>브리프에서 첫 방향을 잡아 보세요.</small></p>}</div>{failure&&<p role="alert">{failure}</p>}<div className="studio-transport">{canPlay&&<button disabled={!ready||!!failure} onClick={play}>{playing?'일시 정지':onReviewed?'독립 재생 검토 시작':'재생'}</button>}{staticFrame?<span>정지 프레임 0 · 자동 재생 없음</span>:<label>프레임 <output>{displayFrame}</output><input aria-label={`${label} 프레임`} type="range" min="0" max={project.durationFrames-1} value={Math.min(displayFrame,project.durationFrames-1)} onChange={e=>{const next=Number(e.target.value);try{player.current?.goToAndStop(next,true);setPlaying(false);setDisplayFrame(next);onFrame(next);}catch{fail();}}}/></label>}<span>{project.fps} fps · {project.durationFrames}f</span></div></div>;
}
