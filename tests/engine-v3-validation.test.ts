import {describe,it,expect} from 'vitest';
import {validateProjectV3,parseProjectV3,serializeProjectV3,type PathV3} from '../packages/creator-core/src/v3';
import {fixture} from '../fixtures/creator-v3-helpers';
describe('ProjectV3 strict IO',()=>{
 it('round trips advanced authored fields without migration',()=>{const p=fixture();expect(()=>validateProjectV3(p)).not.toThrow();expect(parseProjectV3(serializeProjectV3(p))).toEqual(p);});
 it('rejects descriptor tricks before invoking getters',()=>{let called=false;const p=fixture();Object.defineProperty(p.layers[0],'type',{enumerable:true,get(){called=true;return 'path';}});expect(()=>validateProjectV3(p)).toThrow();expect(called).toBe(false);});
 it('rejects duplicate escaped keys, nesting, byte overflow and nonfinite JSON',()=>{expect(()=>parseProjectV3('{"version":3,"ver\\u0073ion":3}')).toThrow(/duplicate/);expect(()=>parseProjectV3('['.repeat(33)+']'.repeat(33))).toThrow(/depth/);expect(()=>parseProjectV3(' '.repeat(8*1024*1024+1))).toThrow(/size/);expect(()=>parseProjectV3(JSON.stringify(fixture()).replace('"x":240','"x":1e999'))).toThrow();});
 it('rejects topology mismatch, open endpoints, unbounded easing and unknown fields',()=>{for(const edit of [(l:PathV3)=>{l.pathKeys=[{frame:0,value:{...l.path,closed:false},easing:'linear'}];},(l:PathV3)=>{l.path.closed=false;l.fill=null;l.path.inTangents[0]=[1,0];},(l:PathV3)=>{l.tracks.x=[{frame:0,value:1,easing:{type:'cubic-bezier',x1:0,y1:0,x2:1,y2:1.1}}];},(l:PathV3)=>{Object.assign(l,{expression:'evil'});}]){const p=fixture();edit(p.layers[0] as PathV3);expect(()=>validateProjectV3(p)).toThrow();}});
 it('rejects graph, group clipping and conservative transformed mask overflow',()=>{const p=fixture();p.layers[0].parentId='shape';expect(()=>validateProjectV3(p)).toThrow();const q=fixture();q.layers[0].scaleX=1000;q.layers[0].scaleY=1000;q.layers[0].skew=75;q.layers[0].masks[0].path.vertices[0]=[4096,4096];expect(()=>validateProjectV3(q)).toThrow(/world/);});
});
