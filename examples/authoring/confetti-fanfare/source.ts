/// <reference types="node" />
// Original deterministic artwork authored through Moro's real CreatorProject API.
// This is not an AI-generation claim, a CSS animation, or an imported gallery asset.
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {exportLottie,parseProject,serializeProject} from '../../../packages/creator-core/src/index.ts';
import type {CreatorLayer,CreatorProject,Keyframe,Property} from '../../../packages/creator-core/src/index.ts';

const dir=process.argv[2]?resolve(process.argv[2])+'/':fileURLToPath(new URL('.',import.meta.url));
let seed=0x434F4E46;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;}
function between(a:number,b:number){return a+(b-a)*random();}
const round=(n:number)=>Math.round(n*10000)/10000;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const palette=['#FFD166','#FF6B86','#4DE1D4','#B294FF','#FFF3CD','#77AAFF'];
const layers:CreatorLayer[]=[];
function layer(id:string,type:'rect'|'ellipse',width:number,height:number,fill:string,radius=0):CreatorLayer{
 return{id,name:id,type,x:384,y:650,width:round(width),height:round(height),fill,stroke:fill,strokeWidth:0,cornerRadius:type==='rect'?round(Math.min(radius,height/2,width/2)):null,rotation:0,opacity:0,scale:100,tracks:{x:[],y:[],scale:[],rotation:[],opacity:[]}};
}
function key(frame:number,value:number,easing:Keyframe['easing']='linear'):Keyframe{return{frame,value:round(value),easing};}
function fillTrack(l:CreatorLayer,prop:Property,frames:number[],value:(f:number)=>number){l.tracks[prop]=frames.map(f=>key(f,value(f)));}

// Short launch rays sit BEHIND the paper. Two offset bursts read as one celebration.
for(let side=0;side<2;side++)for(let j=0;j<4;j++){
 const start=side===0?12:27;const angle=(-145+j*27+(side===0?0:8))*Math.PI/180;
 const l=layer(`Launch ${side+1} / ray ${j+1}`,'rect',between(30,46),4,palette[(j+side)%palette.length],2);
 l.rotation=round(angle*180/Math.PI);const origin=side===0?190:578;
 const times=[0,start,start+4,start+11,start+20,239];
 fillTrack(l,'x',times,f=>origin+Math.cos(angle)*clamp((f-start)/20,0,1)*132);
 fillTrack(l,'y',times,f=>650+Math.sin(angle)*clamp((f-start)/20,0,1)*132);
 l.tracks.opacity=[key(0,0),key(start,0),key(start+3,82,'ease-out'),key(start+18,0),key(239,0)];
 l.tracks.scale=[key(0,25),key(start,25,'ease-out'),key(start+8,130,'ease-in'),key(start+20,50),key(239,50)];
 layers.push(l);
}

// Ballistic paper, horizontal drag, stagger, spin and gentle flutter; no random playback state.
for(let i=0;i<72;i++){
 const side=i%2;const origin=side===0?190:578;
 const start=Math.round((side===0?12:27)+between(0,11));
 const type=i%5===0?'ellipse':'rect';const ribbon=type==='rect'&&i%4===0;
 const width=type==='ellipse'?between(8,13):ribbon?between(28,42):between(13,24);
 const height=type==='ellipse'?width:ribbon?between(5,8):between(8,13);
 const l=layer(`Paper ${String(i+1).padStart(2,'0')} / ${ribbon?'ribbon':type}`,type,width,height,palette[i%palette.length],ribbon?1.5:1);
 const vx=side===0?between(-120,330):between(-330,120);const vy=between(-750,-600),gravity=520;
 const phase=between(0,Math.PI*2),flutter=between(5,15),spin=between(150,520)*(i%3===0?-1:1),r0=between(-170,170);
 const fallTime=(-vy+Math.sqrt(vy*vy+2*gravity*66))/gravity;
 const end=Math.min(231,Math.ceil(start+fallTime*60));
 const times=[...new Set([0,start-1,start,start+6,...Array.from({length:11},(_,j)=>start+18+j*15),end-8,end,239].filter(f=>f>=0&&f<=239))].sort((a,b)=>a-b);
 const age=(f:number)=>Math.max(0,(f-start)/60);
 fillTrack(l,'x',times,f=>{const t=Math.min(age(f),fallTime);return origin+vx*(1-Math.exp(-.95*t))/.95+flutter*Math.sin(t*5+phase)*(1-Math.exp(-t*2));});
 fillTrack(l,'y',times,f=>{const t=Math.min(age(f),fallTime);return 650+vy*t+.5*gravity*t*t;});
 fillTrack(l,'rotation',times,f=>{const t=age(f);return r0+spin*t+18*Math.sin(t*4+phase)*(1-Math.exp(-t*2));});
 fillTrack(l,'scale',times,f=>f<start?28:f<start+6?28+(f-start)*12:94+8*Math.sin(age(f)*5+phase));
 l.tracks.opacity=[key(0,0),key(start,0),key(start+5,100,'ease-out'),key(end-12,100,'ease-in'),key(end,0),key(239,0)];
 layers.push(l);
}

// Four fleeting four-point glints at the apex, not a static success badge.
for(let i=0;i<4;i++){
 const x=[210,352,500,604][i],y=[218,128,246,164][i],start=[48,67,59,79][i];
 for(let arm=0;arm<2;arm++){
  const l=layer(`Apex glint ${i+1} / arm ${arm+1}`,'rect',i%2===0?28:22,3.5,'#FFF3CD',1.75);l.x=x;l.y=y;l.rotation=45+90*arm;
  l.tracks.scale=[key(0,20),key(start,20,'ease-out'),key(start+7,110,'ease-in'),key(start+23,20),key(239,20)];
  l.tracks.opacity=[key(0,0),key(start,0),key(start+5,94),key(start+22,0),key(239,0)];
  layers.push(l);
 }
}
const project:CreatorProject={version:1,name:'Confetti Fanfare / Twin Burst',width:768,height:768,fps:60,durationFrames:240,layers};
const source=serializeProject(project);parseProject(source);
await mkdir(dir,{recursive:true});
await writeFile(dir+'project.moro.json',source,{flag:'wx'});
await writeFile(dir+'animation.json',JSON.stringify(exportLottie(project),null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({layers:layers.length,frames:project.durationFrames,fps:project.fps,canvas:[project.width,project.height],transparent:true,source:dir+'project.moro.json'}));
