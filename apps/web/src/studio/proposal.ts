import {parseProjectV3,evaluateLayerV3,type LayerV3} from '../../../../packages/creator-core/src/v3';
import type {DirectorProposal,Stage} from './session';
const channels=['x','y','scaleX','scaleY','rotation','opacity','skew','skewAxis'] as const;
const fail=(message:string):never=>{throw Error(`${message} 문서와 실행 취소 기록은 유지돼요. 제안은 자동 보정하지 않아요.`);};
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return fail('제안 형식이 올바르지 않아요.');return value as Record<string,unknown>;}
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).sort().join('|')!==allowed.sort().join('|'))fail('제안 필드가 맞지 않아요.');}
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)fail('제안 설명의 길이나 형식이 맞지 않아요.');}
function equal(a:unknown,b:unknown,tolerance=0):boolean{
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=tolerance;
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i],tolerance));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const left=a as Record<string,unknown>,right=b as Record<string,unknown>,ka=Object.keys(left),kb=Object.keys(right);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(right,k)&&equal(left[k],right[k],tolerance));}
 return false;
}
function immutable(layer:LayerV3){const value=structuredClone(layer) as unknown as Record<string,unknown>;delete value.tracks;delete value.pathKeys;delete value.trim;return value;}
function sampled(layer:LayerV3,frame:number){const l=evaluateLayerV3(layer,frame);return {numeric:channels.map(p=>l[p]),path:l.type==='path'?l.path:null,trim:l.trim?{start:l.trim.start,end:l.trim.end,offset:l.trim.offset}:null};}
export function assertContinuity(proposal:DirectorProposal,approved:DirectorProposal){
 const p=proposal.project,a=approved.project;
 if(p.width!==a.width||p.height!==a.height||p.fps!==a.fps||p.durationFrames!==a.durationFrames||p.layers.length!==a.layers.length||p.layers.some((layer,i)=>!equal(immutable(layer),immutable(a.layers[i]))))fail('수락한 스타일의 형태·색·정적 속성이 달라졌어요.');
 if(proposal.stage!=='motion')return;
 if(!equal(proposal.poses.map(p=>p.frame),approved.poses.map(p=>p.frame)))fail('수락한 포즈 프레임이 달라졌어요.');
 for(let i=0;i<a.layers.length;i++){
  const before=a.layers[i],after=p.layers[i];
  for(const channel of channels)for(const key of before.tracks[channel])if(!after.tracks[channel].some(k=>k.frame===key.frame&&k.value===key.value))fail('수락한 숫자 키가 달라졌어요.');
  if(before.type==='path'&&after.type==='path')for(const key of before.pathKeys)if(!after.pathKeys.some(k=>k.frame===key.frame&&equal(k.value,key.value)))fail('수락한 경로 키가 달라졌어요.');
  if(before.trim)for(const channel of ['start','end','offset'] as const)for(const key of before.trim.tracks[channel])if(!after.trim?.tracks[channel].some(k=>k.frame===key.frame&&k.value===key.value))fail('수락한 트림 키가 달라졌어요.');
  for(const pose of approved.poses)if(!equal(sampled(before,pose.frame),sampled(after,pose.frame),1e-5))fail(`${pose.frame}f의 수락 포즈와 모션 샘플이 달라졌어요.`);
 }
}
export function validateProposal(value:unknown,stage:Stage,approved:DirectorProposal|null=null):DirectorProposal {
 const proposal=record(value);keys(proposal,['version','stage','summary','review','poses','project']);
 if(proposal.version!==1||proposal.stage!==stage)fail('제안 단계가 맞지 않아요.');text(proposal.summary,1200);
 const review=record(proposal.review);keys(review,['focalPoint','silhouette','material','choreography','limitations']);Object.values(review).forEach(v=>text(v,600));
 const project=parseProjectV3(JSON.stringify(proposal.project));
 if(!Array.isArray(proposal.poses)||proposal.poses.length<(stage==='poses'?3:1)||proposal.poses.length>(stage==='style'?1:5))fail('정지 포즈 개수가 맞지 않아요.');
 let last=-1;const poses=proposal.poses as unknown[];for(const value of poses){const pose=record(value);keys(pose,['frame','label']);if(!Number.isInteger(pose.frame)||Number(pose.frame)<=last||Number(pose.frame)>=project.durationFrames)fail('포즈 프레임이 올바르지 않아요.');last=Number(pose.frame);text(pose.label,200);}
 if(stage==='style'){
  if(!project.layers.some(l=>l.type!=='group'&&l.opacity>0&&(l.fill!==null||l.strokeWidth>0)))fail('스타일 제안에 그릴 수 있는 도형이 없어요. 빈 그룹·투명한 구조만으로 다음 단계에 진행할 수 없어요.');
  if(record(poses[0]).frame!==0||project.layers.some(l=>Object.values(l.tracks).some(t=>t.length)||(l.type==='path'&&l.pathKeys.length)||(l.trim&&Object.values(l.trim.tracks).some(t=>t.length))))fail('스타일 제안에는 애니메이션을 포함할 수 없어요.');
 }else if(!approved||approved.stage!==(stage==='poses'?'style':'poses'))fail('수락한 이전 단계 제안이 필요해요.');
 const validated=value as DirectorProposal;
 if(approved)assertContinuity(validated,approved);
 // Preserve the untouched envelope; parsing/sampling never repairs or replaces provider output.
 return validated;
}
