import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { commit, emptyHistory, exportJson, LIMITS, outputName, parseDocument, reactSource, recolor, redo, setColor, undo, type Json, type Obj } from '../packages/document-core/src';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const shape = (color: number[], a = 0) => ({ ty: 'fl', c: { a, k: color }, o: { a: 0, k: 45 }, custom: { untouched: [1, 'value'] } });
const base = (): Obj => ({ v: '5.13.0', w: 320, h: 240, fr: 30, ip: 10, op: 100, layers: [{ ty: 4, shapes: [shape([.1,.2,.3,.4]), {ty:'gr',it:[shape([.1,.2,.3,1])]}] }], assets: [{id:'precomp',layers:[{ty:4,shapes:[shape([.1,.2,.3]),shape([.10001,.2,.3]),{ty:'gf',g:{p:2,k:{a:0,k:[0,1,0,0,1,0,1,0]}}},shape([.1,.2,.3],1)]}]}], futureField: { data: [1,null,'preserve'], __version: 98 } });
describe('document-preserving recolor', () => {
  it('groups exact RGB across nested groups/precomps, preserves alpha, gradients, animation and unknown fields', () => {
    const source=base(), doc=parseDocument(encode(source),'test.json');
    expect(doc.groups).toHaveLength(2); expect(doc.groups[0].paths).toHaveLength(3); expect(doc.groups[0].hex).toBe(doc.groups[1].hex);
    expect(doc.diagnostics).toMatchObject({gradients:1,animated:1,staticProperties:4});
    const result=recolor(doc,setColor({},doc.groups[0],'#FF0000'));
    const expected=structuredClone(source);
    const layers=expected.layers as Obj[], assets=expected.assets as Obj[];
    ((layers[0].shapes as Obj[])[0].c as Obj).k=[1,0,0,.4];
    ((((layers[0].shapes as Obj[])[1].it as Obj[])[0]).c as Obj).k=[1,0,0,1];
    ((((assets[0].layers as Obj[])[0].shapes as Obj[])[0]).c as Obj).k=[1,0,0];
    expect(result).toEqual(expected); expect(doc.original).toEqual(source); expect(doc.bytes).toEqual(encode(source));
  });
  it('reset preserves the exact input floats rather than rounded HEX values',()=>{const doc=parseDocument(encode(base()),'a.json');expect(recolor(doc,{[doc.groups[0].id]:doc.groups[0].hex})).toEqual(doc.original);});
  it('exports and reimports the changed JSON with actual dimensions and timing',()=>{const doc=parseDocument(encode(base()),'a.json'), mapping=setColor({},doc.groups[0],'#ABCDEF');const next=parseDocument(new TextEncoder().encode(exportJson(doc,mapping)),'a.moro.json');expect(next.original).toEqual(recolor(doc,mapping));expect(next).toMatchObject({width:320,height:240,fps:30,first:10,frames:90});});
  it('uses original source bytes even when whitespace differs',()=>{const raw=new TextEncoder().encode('  '+JSON.stringify(base())+'\r\n');expect(parseDocument(raw,'a.json').bytes).toEqual(raw);});
  it('never merges almost-equal source colors and preserves negative zero semantics',()=>{const source=base();(source.layers as Obj[])[0].shapes=[shape([-0,0,0]),shape([0,0,0]),shape([.00001,0,0])];const doc=parseDocument(encode(source),'a');expect(doc.groups.find(g=>g.id==='[0,0,0]')?.paths).toHaveLength(2);});
});
describe('immutability and command payloads',()=>{
  it('isolates source bytes and freezes original objects',()=>{const original=encode(base());const doc=parseDocument(original,'a');const source=doc.bytes;source[0]=0;original[0]=0;expect(doc.bytes[0]).toBe(123);expect(Object.isFrozen(doc.original)).toBe(true);expect(Object.isFrozen(doc.original.layers)).toBe(true);});
  it('records exact paths and before/after values for an undo command',()=>{const doc=parseDocument(encode(base()),'a');const h=commit(emptyHistory(),setColor({},doc.groups[0],'#FF0000'),doc);expect(h.past[0].changes).toHaveLength(3);expect(h.past[0].changes[0]).toEqual({path:doc.groups[0].paths[0],before:[.1,.2,.3,.4],after:[1,0,0,.4]});});
  it('gives an actionable error for an empty file',()=>expect(()=>parseDocument(new Uint8Array(),'empty')).toThrow(/empty/));
});
describe('history transactions',()=>{
  it('one picker Apply is one undo; redo/reset restore exact mappings',()=>{const doc=parseDocument(encode(base()),'a'), group=doc.groups[0];let live=setColor({},group,'#112233');live=setColor(live,group,'#334455');const applied=commit(emptyHistory(),live);expect(applied.past).toHaveLength(1);expect(undo(applied).current).toEqual({});expect(redo(undo(applied)).current).toEqual(live);expect(undo(commit(applied,{})).current).toEqual(live);expect(recolor(doc,undo(applied).current)).toEqual(doc.original);});
  it('invalid or unchanged colors do not create history',()=>{const doc=parseDocument(encode(base()),'a'), h=emptyHistory();expect(commit(h,setColor(h.current,doc.groups[0],'#123'))).toBe(h);expect(commit(h,{})).toBe(h);});
});
describe('untrusted input budgets and diagnostics',()=>{
  it.each(['{','[]','{}','null','{"layers":[]}'])('rejects malformed or incomplete input %s',text=>expect(()=>parseDocument(new TextEncoder().encode(text),'bad')).toThrow());
  it('blocks expressions, URL images, SVG data images and font paths without losing original',()=>{const root=base();root.assets=[{p:'https://example.invalid/a.png'},{p:'data:image/svg+xml;base64,AAAA'}];root.fonts={list:[{fPath:'https://example.invalid/font.woff'}]};root.customExpression={x:'fetch("https://example.invalid")'};const doc=parseDocument(encode(root),'blocked');expect(doc.diagnostics.blocked).toHaveLength(3);expect(()=>exportJson(doc,{})).toThrow(/blocked/);expect(doc.bytes).toEqual(encode(root));});
  it('allows embedded raster images without fetching',()=>{const root=base();root.assets=[{p:'data:image/png;base64,AAAA',u:'',e:1}];expect(parseDocument(encode(root),'embedded').diagnostics.blocked).toEqual([]);});
  it('rejects oversized bytes, too-deep JSON and too many nodes',()=>{expect(()=>parseDocument(new Uint8Array(LIMITS.bytes+1),'huge')).toThrow(/2 MB/);const root=base();let nested:Json=0;for(let i=0;i<70;i++)nested={nested};root.extra=nested;expect(()=>parseDocument(encode(root),'deep')).toThrow(/complexity/);root.extra=Array(100001).fill(0);expect(()=>parseDocument(encode(root),'wide')).toThrow(/complexity/);});
  it('rejects unsafe timing and dimensions',()=>{for(const patch of [{fr:0},{w:9000},{op:20000},{fr:1,op:1000}])expect(()=>parseDocument(encode({...base(),...patch}),'bad')).toThrow();});
  it('all three original samples fit the budgets and expose real colors',()=>{for(const id of ['orbit','success','burst']){const doc=parseDocument(readFileSync(`apps/web/public/samples/${id}.json`),id);expect(doc.groups.length).toBeGreaterThan(1);expect(doc.diagnostics.blocked).toEqual([]);expect(doc.bytes.length).toBeLessThan(LIMITS.bytes);}});
});
describe('React export',()=>{
  it.each(['auto','hover','click'] as const)('generates an expression-free typed player for %s',trigger=>{const text=reactSource('orbit.moro.json',{trigger,autoplay:true,loop:false,speed:1.5});expect(text).toContain("from 'lottie-web/build/player/lottie_light'");expect(text).toContain("from './orbit.moro.json'");expect(text).toContain('prefers-reduced-motion');expect(text).toContain('item.destroy()');expect(text).toContain('item.setSpeed(1.5)');expect(text.includes('onMouseEnter')).toBe(trigger==='hover');});
  it('produces stable names for reimports',()=>expect(outputName('hello.moro.json')).toBe('hello.moro.json'));
});
