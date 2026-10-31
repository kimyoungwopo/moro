import { writeFile } from 'node:fs/promises';
const prop=k=>({a:0,k});
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(1);
const transform=(position=[256,256], rotation=0, scale=[100,100])=>({o:prop(100),r:typeof rotation==='number'?prop(rotation):rotation,p:prop([...position,0]),a:prop([0,0,0]),s:prop([...scale,100])});
const fill=hex=>({ty:'fl',c:prop(rgb(hex)),o:prop(100),r:1});
const stroke=(hex,width)=>({ty:'st',c:prop(rgb(hex)),o:prop(100),w:prop(width),lc:2,lj:2});
const ellipse=(w,h=w)=>({ty:'el',d:1,p:prop([0,0]),s:prop([w,h])});
const keys=(from,to,end)=>({a:1,k:[{t:0,s:[from],e:[to],o:{x:[.33],y:[.33]},i:{x:[.67],y:[.67]}},{t:end,s:[to]}]});
const layer=(name,shapes,ks,frames)=>({ddd:0,ind:1,ty:4,nm:name,sr:1,ks,ao:0,shapes,ip:0,op:frames,st:0,bm:0});
const base=(name,frames,layers)=>({v:'5.13.0',fr:60,ip:0,op:frames,w:512,h:512,nm:name,ddd:0,assets:[],layers:layers.toReversed().map((x,i)=>({...x,ind:i+1})),markers:[]});
const orbit=base('Orbit loader',240,[
layer('Orbit track',[ellipse(270),stroke('#DDE9EC',12)],transform(),240),
layer('Inner track',[ellipse(170),stroke('#DDE9EC',2)],transform(),240),
layer('Moving arc',[ellipse(270),stroke('#1B6C80',12),{ty:'tm',s:prop(0),e:prop(28),o:prop(0),m:1}],transform([256,256],keys(-90,270,240)),240),
layer('Satellite',[ellipse(28),fill('#D79A4E')],{...transform(),p:{a:0,k:[256,256,0]},a:prop([0,135,0]),r:keys(0,360,240)},240),
layer('Core ring',[ellipse(68),stroke('#1B6C80',3)],transform(),240),
layer('Core',[ellipse(22),fill('#1B6C80')],transform(),240)
]);
const path={ty:'sh',ks:prop({i:[[0,0],[0,0],[0,0]],o:[[0,0],[0,0],[0,0]],v:[[-44,1],[-12,32],[48,-34]],c:false})};
const success=base('Success check',150,[layer('Badge',[ellipse(230),fill('#E1F0E9')],transform(),150),layer('Badge rim',[ellipse(260),stroke('#DDE9EC',2)],transform(),150),layer('Check',[path,stroke('#2A7D63',14),{ty:'tm',s:prop(0),e:keys(0,100,60),o:prop(0),m:1}],transform(),150)]);
const rays=Array.from({length:10},(_,i)=>layer('Ray '+i,[{ty:'rc',d:1,s:prop([12,54]),p:prop([0,-132]),r:prop(6)},fill(i%2?'#D79A4E':'#1B6C80')],{...transform([256,256],i*36),o:keys(18,100,45)},180));
const burst=base('Reaction burst',180,[...rays,layer('Center',[ellipse(122),fill('#E1F0E9')],{...transform(),s:{a:1,k:[{t:0,s:[80,80,100],e:[100,100,100],o:{x:[.2],y:[1]},i:{x:[.5],y:[1]}},{t:45,s:[100,100,100]}]}},180),layer('Plus',[{ty:'rc',d:1,s:prop([12,48]),p:prop([0,0]),r:prop(6)},{ty:'rc',d:1,s:prop([48,12]),p:prop([0,0]),r:prop(6)},fill('#1B6C80')],transform(),180)]);
for(const [id,data] of Object.entries({orbit,success,burst})) await writeFile(new URL(`../apps/web/public/samples/${id}.json`,import.meta.url),JSON.stringify(data,null,2)+'\n');
