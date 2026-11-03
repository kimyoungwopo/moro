// Deterministic schema derivation; v2 is read-only, v3 is a separate contract.
import fs from 'node:fs';
import {URL} from 'node:url';
import console from 'node:console';
const root=new URL('../../../../',import.meta.url);
const s=JSON.parse(fs.readFileSync(new URL('schemas/creator-project-v2.schema.json',root),'utf8'));
const d=s.$defs,ref=k=>({$ref:`#/$defs/${k}`}),number=(minimum,maximum)=>({type:'number',minimum,maximum}),object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties}),array=(items,maxItems=100)=>({type:'array',items,minItems:0,maxItems});
s.title='Moro local editable project v3';s.properties.version.const=3;
s.description='All fields required. Exact frozen ProjectV3 variants. Local transforms follow official lottie-web 5.13.0: T(position) R(rotation) R(-axis) H(-tan(skew)) R(axis) S(scaleX,scaleY) T(-pivot). Flat bottom-to-top ordering; groups transform only.';
s.$comment='Strict runtime parser and validators are authoritative: <=8MiB UTF8, depth <=32, no duplicate JSON keys, descriptor-safe plain data; names <=200 UTF16; frames ordered and duration-relative; equal path array lengths, control sums and open endpoints; same-topology morph keys; <=100 layers, <=2048 base+mask vertices, <=16384 morph-key vertices, <=100 keys/channel, <=10000 total keys; parent depth <=8 edges. Conservative world enclosure multiplies local max scale by 1+abs(tan(maxAbsSkew)), local min scale divided by same factor; min >=0.01 max <=100; origin plus full control hull/stroke/mask radius <=65536. Schema cannot enforce cross-field, graph, aggregate, UTF16, parser or finite-world rules. Export additionally <=2MiB and <=100000 recursive JSON values, depth <=64. No assets/expressions/effects/code.';
d.easing={anyOf:[{enum:['linear','ease-in','ease-out','ease-in-out']},object({type:{const:'cubic-bezier'},x1:number(0,1),y1:number(0,1),x2:number(0,1),y2:number(0,1)})]};
const ranges={x:[-8192,8192],y:[-8192,8192],scaleX:[1,1000],scaleY:[1,1000],rotation:[-3600,3600],opacity:[0,100],skew:[-75,75],skewAxis:[-3600,3600],start:[0,100],end:[0,100],offset:[-3600,3600]};
for(const [k,r] of Object.entries(ranges))d[k+'Key']=object({frame:{type:'integer',minimum:0,maximum:3599},value:number(...r),easing:ref('easing')});
delete d.scaleKey;
const props=['x','y','scaleX','scaleY','rotation','opacity','skew','skewAxis'];
d.tracks=object(Object.fromEntries(props.map(k=>[k,array(ref(k+'Key'))])));d.groupTracks=JSON.parse(JSON.stringify(d.tracks));d.groupTracks.properties.opacity.maxItems=0;
d.mask=object({name:ref('name'),mode:{enum:['add','subtract']},inverted:{type:'boolean'},opacity:number(0,100),path:ref('geometry')});
d.trim=object({start:number(0,100),end:number(0,100),offset:number(-3600,3600),tracks:object(Object.fromEntries(['start','end','offset'].map(k=>[k,array(ref(k+'Key'))]))) });
d.pathKey=object({frame:{type:'integer',minimum:0,maximum:3599},value:ref('geometry'),easing:ref('easing')});
for(const kind of ['rect','ellipse','path','group']){const l=d[kind];delete l.properties.scale;for(const p of ['scaleX','scaleY','skew','skewAxis'])l.properties[p]=number(...ranges[p]);l.properties.masks=array(ref('mask'),kind==='group'?0:4);l.properties.trim=kind==='path'?{anyOf:[ref('trim'),{type:'null'}]}:{type:'null'};if(kind==='path')l.properties.pathKeys=array(ref('pathKey'));l.required=Object.keys(l.properties);}
fs.writeFileSync(new URL('schemas/creator-project-v3.schema.json',root),JSON.stringify(s,null,2)+'\n');
console.log('Generated separate creator-project-v3.schema.json');
