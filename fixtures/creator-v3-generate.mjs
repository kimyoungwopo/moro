// Reproducible, synthetic local fixtures only; no provider/model calls.
import fs from 'node:fs';
import {buildSync,transformSync} from 'esbuild';
const helper=transformSync(fs.readFileSync('fixtures/creator-v3-helpers.ts','utf8'),{loader:'ts',format:'esm'}).code;
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
const core=buildSync({entryPoints:['packages/creator-core/src/v3.ts'],bundle:true,platform:'node',format:'esm',write:false}).outputFiles[0].text;
const {validateProjectV3,serializeProjectV3,blankProjectV3}=await import('data:text/javascript;base64,'+Buffer.from(core).toString('base64'));
const advanced=fixture(),l=advanced.layers[0],easing={type:'cubic-bezier',x1:.2,y1:.05,x2:.65,y2:.95};
l.tracks.scaleX=[{frame:0,value:80,easing},{frame:110,value:150,easing:'linear'}];l.tracks.scaleY=[{frame:10,value:125,easing:'ease-in'},{frame:90,value:70,easing:'linear'}];
l.tracks.skew=[{frame:0,value:-18,easing:'ease-in-out'},{frame:110,value:30,easing:'linear'}];
l.pathKeys=[{frame:0,value:structuredClone(l.path),easing},{frame:110,value:{...structuredClone(l.path),vertices:[[10,5],[105,10],[55,105]]},easing:'linear'}];
l.trim.tracks.end=[{frame:0,value:15,easing:'ease-out'},{frame:110,value:100,easing:'linear'}];l.trim.tracks.offset=[{frame:0,value:0,easing:'linear'},{frame:110,value:90,easing:'linear'}];
l.masks.push({...structuredClone(l.masks[0]),name:'Subtract inverted',mode:'subtract',inverted:true,opacity:75});
const g={id:'root',name:'Transform rig',type:'group',parentId:null,x:20,y:0,pivot:[0,0],scaleX:105,scaleY:95,rotation:10,opacity:100,skew:-7,skewAxis:55,tracks:{x:[],y:[],scaleX:[],scaleY:[],rotation:[],opacity:[],skew:[],skewAxis:[]},masks:[],trim:null};l.parentId=g.id;advanced.layers.unshift(g);
fs.writeFileSync('fixtures/creator-v3-advanced.json',serializeProjectV3(advanced));
const cases=[{id:'empty',valid:true,project:blankProjectV3()},{id:'advanced-all-features',valid:true,project:advanced}];
function good(id,edit){const p=fixture();edit(p,p.layers[0]);cases.push({id,valid:true,project:p});}
function bad(id,edit){const p=fixture();edit(p,p.layers[0]);cases.push({id,valid:false,project:p});}
good('open-morph',(_,l)=>{l.path.closed=false;l.fill=null;l.pathKeys=[{frame:0,value:structuredClone(l.path),easing:'linear'},{frame:100,value:{...structuredClone(l.path),vertices:[[5,0],[100,0],[50,80]]},easing:'ease-out'}];});
for(const type of ['rect','ellipse'])good(type+'-masked',(_,l)=>{delete l.path;delete l.pathKeys;l.type=type;l.width=100;l.height=80;l.cornerRadius=type==='rect'?20:null;l.trim=null;});
bad('v2-version',(p)=>{p.version=2;});bad('unknown-project-field',p=>{p.assets=[];});bad('unknown-layer-field',(_,l)=>{l.expression='x';});bad('legacy-scale',(_,l)=>{l.scale=100;});bad('missing-independent-scale',(_,l)=>{delete l.scaleY;});
bad('unbounded-easing',(_,l)=>{l.tracks.x=[{frame:0,value:0,easing:{...easing,y2:1.01}}];});bad('easing-extra',(_,l)=>{l.tracks.x=[{frame:0,value:0,easing:{...easing,code:'x'}}];});bad('easing-unknown',(_,l)=>{l.tracks.x=[{frame:0,value:0,easing:'spring'}];});bad('key-order',(_,l)=>{l.tracks.x=[{frame:2,value:0,easing:'linear'},{frame:1,value:1,easing:'linear'}];});bad('frame-at-duration',(p,l)=>{l.tracks.skew=[{frame:p.durationFrames,value:0,easing:'linear'}];});
bad('topology-count',(_,l)=>{l.pathKeys=[{frame:0,value:{...structuredClone(l.path),vertices:[[0,0],[10,0],[0,10],[5,5]]},easing:'linear'}];});bad('topology-closure',(_,l)=>{l.pathKeys=[{frame:0,value:{...structuredClone(l.path),closed:false},easing:'linear'}];});bad('morph-open-endpoint',(_,l)=>{l.path.closed=false;l.fill=null;const path=structuredClone(l.path);path.outTangents[2]=[1,0];l.pathKeys=[{frame:10,value:path,easing:'linear'}];});
bad('mask-unknown',(_,l)=>{l.masks[0].mode='intersect';});bad('mask-opacity',(_,l)=>{l.masks[0].opacity=101;});bad('mask-animated',(_,l)=>{l.masks[0].keys=[];});bad('five-masks',(_,l)=>{l.masks=Array.from({length:5},()=>structuredClone(l.masks[0]));});bad('mask-control-sum',(_,l)=>{l.masks[0].path.vertices[0]=[4096,0];l.masks[0].path.outTangents[0]=[4096.1,0];});bad('trim-percent',(_,l)=>{l.trim.start=-1;});bad('trim-key-range',(_,l)=>{l.trim.tracks.end=[{frame:0,value:101,easing:'linear'}];});
bad('duplicate-id',(p,l)=>{p.layers.push(structuredClone(l));});bad('parent-cycle',(_,l)=>{l.parentId=l.id;});bad('missing-parent',(_,l)=>{l.parentId='absent';});bad('parent-not-group',(p,l)=>{p.layers.push({...structuredClone(l),id:'other',parentId:l.id});});bad('group-clipping',p=>{p.layers.push({...structuredClone(g),masks:structuredClone(p.layers[0].masks)});});bad('group-opacity',p=>{p.layers.push({...structuredClone(g),opacity:90});});
bad('scale-range',(_,l)=>{l.scaleX=0;});bad('skew-range',(_,l)=>{l.skew=76;});bad('axis-range',(_,l)=>{l.skewAxis=3601;});bad('world-mask-extent',(_,l)=>{l.scaleX=1000;l.scaleY=1000;l.skew=75;l.masks[0].path.vertices[0]=[4096,4096];});bad('world-min-singular',(p,l)=>{const parent=structuredClone(g);parent.scaleY=1;p.layers.unshift(parent);l.parentId=parent.id;l.scaleY=1;});
for(const c of cases){let valid=true;try{validateProjectV3(c.project);}catch{valid=false;}if(valid!==c.valid)throw Error('Unexpected corpus validity '+c.id);}
fs.writeFileSync('fixtures/creator-v3-corpus.json',JSON.stringify({schemaVersion:1,cases},null,2)+'\n');
console.log(JSON.stringify({cases:cases.length,valid:cases.filter(c=>c.valid).length,invalid:cases.filter(c=>!c.valid).length}));
