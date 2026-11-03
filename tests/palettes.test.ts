import {describe,expect,it} from 'vitest';
import {commit,emptyHistory,parseDocument,recolor,undo, type ColorGroup} from '../packages/document-core/src';
import {paletteMapping,PALETTES} from '../apps/web/src/palettes';
const colors=['#1B6C80','#D79A4E','#DDE9EC','#203B42','#FFFFFF'];
const groups:ColorGroup[]=colors.map((hex,i)=>({id:String(i),hex,rgb:[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16)/255),paths:[['layers',0,'shapes',i,'c','k']]}));
describe('curated palette transactions',()=>{
 it('maps source tones deterministically into named palette roles',()=>{const p=PALETTES.find(x=>x.id==='lagoon')!;const m=paletteMapping(groups,p);expect(m['0']).toBe(p.colors.primary);expect(m['1']).toBe(p.colors.accent);expect(m['2']).toBe(p.colors.neutral);expect(m['3']).toBe(p.colors.ink);expect(m['4']).toBeUndefined();});
 it('preserves original bytes, alpha and unknown fields and undoes one full preset in one step',()=>{const source={w:512,h:512,fr:60,ip:0,op:240,custom:{keep:true},layers:[{ty:4,shapes:groups.map(g=>({ty:'fl',c:{a:0,k:[...g.rgb,.42]},o:{a:0,k:67}}))}]};const bytes=new TextEncoder().encode(JSON.stringify(source));const doc=parseDocument(bytes,'palette.json');const h=commit(emptyHistory(),paletteMapping(doc.groups,PALETTES[0]),doc);expect(h.past).toHaveLength(1);const edited=recolor(doc,h.current);expect(edited.custom).toEqual({keep:true});expect(JSON.stringify(edited)).toContain('0.42');expect(recolor(doc,undo(h).current)).toEqual(source);expect(doc.bytes).toEqual(bytes);});
 it('offers unique accessible names, valid targets and deterministic mappings',()=>{expect(new Set(PALETTES.map(p=>p.name)).size).toBe(PALETTES.length);for(const p of PALETTES){expect(Object.values(p.colors).every(v=>/^#[0-9A-F]{6}$/.test(v))).toBe(true);expect(paletteMapping(groups,p)).toEqual(paletteMapping(groups,p));}});
});
