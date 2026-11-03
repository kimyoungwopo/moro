import { describe, it, expect } from 'vitest';
import { parseDocument } from '../packages/document-core/src/index';
import * as core from '../packages/creator-core/src/index';

describe('creator project', () => {
  it('samples every transform channel, multiple segments, descending values and empty tracks', () => {
    let p=core.addLayer(core.createProject(),'rect'); const id=p.layers[0].id;
    for(const [prop,start,end] of [['x',-100,100],['y',500,0],['scale',10,210],['rotation',-180,180],['opacity',100,0]] as const) {
      p=core.setKeyframe(p,id,prop,0,start); p=core.setKeyframe(p,id,prop,60,end);
    }
    expect(core.sampleLayer(p.layers[0],30)).toEqual({x:0,y:250,scale:110,rotation:0,opacity:50});
    p=core.setKeyframe(p,id,'x',119,690); expect(core.sampleLayer(p.layers[0],89.5).x).toBe(395);
    p=core.removeKeyframe(core.removeKeyframe(core.removeKeyframe(p,id,'x',0),id,'x',60),id,'x',119);
    expect(core.sampleLayer(p.layers[0],30).x).toBe(256);
  });
  it('rejects executable array hooks and accessors without invoking them', () => {
    const p=core.createProject(); let executed=false;
    Object.defineProperty(p.layers,'toJSON',{value:()=>{executed=true; return [];},enumerable:true});
    expect(()=>core.serializeProject(p)).toThrow(); expect(executed).toBe(false);
    const q=core.addLayer(core.createProject(),'rect');
    Object.defineProperty(q.layers,'0',{get(){executed=true; return p;}});
    expect(()=>core.serializeProject(q)).toThrow(); expect(executed).toBe(false);
  });
  it('exports expression-free shape Lottie in top-first order with independent x/y grids', () => {
    let p=core.addLayer(core.createProject(),'rect'); const id=p.layers[0].id;
    for(const [prop,a,b] of [['x',0,400],['scale',50,200],['rotation',-90,90],['opacity',0,100]] as const) { p=core.setKeyframe(p,id,prop,10,a,'ease-in'); p=core.setKeyframe(p,id,prop,110,b); }
    p=core.setKeyframe(p,id,'y',20,100,'ease-out'); p=core.setKeyframe(p,id,'y',80,300); p=core.addLayer(p,'ellipse');
    p=core.setKeyframe(p,p.layers[1].id,'x',5,64);
    const out=core.exportLottie(p); expect(out).toMatchObject({w:512,h:512,fr:60,ip:0,op:120,assets:[]});
    const layers=out.layers as unknown as {nm:string;ty:number;ks:Record<string,unknown>;shapes:{ty:string;p?:{k:number[]};s?:{k:number[]}}[]}[];
    expect(layers.map(l=>l.nm)).toEqual(['Ellipse','Rectangle']); expect(layers.every(l=>l.ty===4)).toBe(true);
    expect(layers[0].ks.p).toMatchObject({s:true,x:{a:0,k:64},y:{a:0,k:256}});
    expect(layers[1].ks.a).toEqual({a:0,k:[0,0,0]});
    expect(layers[1].shapes[0]).toMatchObject({ty:'rc',p:{k:[0,0]},s:{k:[160,100]}}); expect(layers[0].shapes[0].ty).toBe('el');
    const pos=layers[1].ks.p as {s:boolean;x:{k:{t:number;s:number[];e?:number[];o?:{x:number[];y:number[]};i?:{x:number[];y:number[]}}[]};y:{k:{t:number}[]}};
    expect(pos.s).toBe(true); expect(pos.x.k.map(k=>k.t)).toEqual([10,110]); expect(pos.y.k.map(k=>k.t)).toEqual([20,80]);
    expect(pos.x.k[0]).toMatchObject({s:[0],e:[400],o:{x:[0.42],y:[0]},i:{x:[1],y:[1]}});
    expect(layers[1].ks.s).toMatchObject({a:1,k:[{s:[50,50,100],e:[200,200,100]},{s:[200,200,100]}]});
    const doc=parseDocument(new TextEncoder().encode(JSON.stringify(out)),'created.json'); expect(doc.diagnostics.blocked).toEqual([]); expect(doc.groups.length).toBeGreaterThan(0);
    expect(core.exportLottie(core.createProject()).layers).toEqual([]);
  });
  it.each(['linear','ease-in','ease-out','ease-in-out'] as const)('exported %s cubic evaluates to the sampler at fractional and held times', easing => {
    let p=core.addLayer(core.createProject(),'ellipse'); const id=p.layers[0].id;
    p=core.setKeyframe(p,id,'x',10,10,easing); p=core.setKeyframe(p,id,'x',110,410);
    const out=core.exportLottie(p);
    type Segment={t:number;s:number[];e:number[];o:{x:number[];y:number[]};i:{x:number[];y:number[]}};
    const keys=(out.layers as unknown as {ks:{p:{x:{k:Segment[]}}}}[])[0].ks.p.x.k;
    const bez=(t:number,a:number,b:number)=>3*t*(1-t)**2*a+3*t*t*(1-t)*b+t**3;
    for(const frame of [0,10,22.5,35,60,85,109.5,110,119]) {
      const k=keys[0]; const progress=Math.max(0,Math.min(1,(frame-k.t)/(keys[1].t-k.t))); let low=0,high=1;
      for(let i=0;i<55;i++) {const mid=(low+high)/2;if(bez(mid,k.o.x[0],k.i.x[0])<progress)low=mid;else high=mid;}
      const value=k.s[0]+(k.e[0]-k.s[0])*bez((low+high)/2,k.o.y[0],k.i.y[0]);
      expect(core.sampleLayer(p.layers[0],frame).x).toBeCloseTo(value,7);
    }
  });
  it('roundtrips data only and rejects unsafe, oversized and invalid project structures', () => {
    const p=core.addLayer(core.createProject(),'ellipse'); const text=core.serializeProject(p);
    expect(core.parseProject(text)).toEqual(p); expect(core.parseProject(text)).not.toBe(p);
    const mutate=(fn:(p:core.CreatorProject)=>void)=>{ const q=structuredClone(p); fn(q); return JSON.stringify(q); };
    for(const bad of ['', '(()=>{globalThis.pwned=true})()', '{"__proto__":{}}', text.replace('"version": 1','"version": 2'), mutate(q=>q.layers.push(q.layers[0])), mutate(q=>q.layers[0].tracks.x=[{frame:120,value:1,easing:'linear'}]), mutate(q=>q.layers[0].tracks.x=[{frame:0,value:1,easing:'linear'},{frame:0,value:2,easing:'linear'}]), mutate(q=>(q.layers[0].tracks as Record<string,unknown>).z=[]), mutate(q=>q.layers[0].fill='url(javascript:alert(1))'), mutate(q=>(q as unknown as Record<string,unknown>).expression='alert(1)'), ' '.repeat(8*1024*1024+1), '['.repeat(10000)+'0'+']'.repeat(10000)]) expect(()=>core.parseProject(bad)).toThrow();
    const q=structuredClone(p); q.layers[0].opacity=Infinity; expect(()=>core.serializeProject(q)).toThrow();
    const unsafe=Object.defineProperty({},'name',{get(){throw new Error('getter executed');},enumerable:true});
    expect(()=>core.createProject(unsafe)).toThrow('accessor');
    expect(({} as Record<string,unknown>).pwned).toBeUndefined();
  });
  it('sorts/replaces bounded keys immutably and removes tracks', () => {
    const p=core.addLayer(core.createProject(),'rect'), id=p.layers[0].id;
    const a=core.setKeyframe(p,id,'x',60,400,'ease-in'); const b=core.setKeyframe(a,id,'x',0,100);
    expect(p.layers[0].tracks).toEqual({}); expect(b.layers[0].tracks.x?.map(k=>k.frame)).toEqual([0,60]);
    const c=core.setKeyframe(b,id,'x',60,500,'ease-out'); expect(c.layers[0].tracks.x).toHaveLength(2); expect(c.layers[0].tracks.x?.[1].value).toBe(500);
    const d=core.removeKeyframe(core.removeKeyframe(c,id,'x',60),id,'x',0); expect(d.layers[0].tracks.x ?? []).toEqual([]);
    for(const [prop,frame,value,easing] of [['z',0,2,'linear'],['x',120,2,'linear'],['y',-1,2,'linear'],['x',0.1,2,'linear'],['x',0,NaN,'linear'],['opacity',0,101,'linear'],['scale',0,0,'linear'],['rotation',0,-3601,'linear'],['x',0,2,'spring']]) expect(()=>core.setKeyframe(p,id,prop as never,frame as number,value as number,easing as never)).toThrow();
    let many=p; for(let i=0;i<100;i++) many=core.setKeyframe(many,id,'y',i,i);
    expect(()=>core.setKeyframe(many,id,'y',100,100)).toThrow(); expect(core.setKeyframe(many,id,'y',0,2).layers[0].tracks.y).toHaveLength(100);
  });
  it.each([['linear',0.5],['ease-in',0.3153568125],['ease-out',0.6846431875],['ease-in-out',0.5]] as const)('samples %s outgoing cubic timing before, middle and end', (easing,middle) => {
    let p=core.addLayer(core.createProject(),'ellipse'); const id=p.layers[0].id;
    p=core.setKeyframe(p,id,'x',10,0,easing); p=core.setKeyframe(p,id,'x',110,100,'linear');
    expect(core.sampleLayer(p.layers[0],0).x).toBe(0); expect(core.sampleLayer(p.layers[0],10).x).toBe(0);
    expect(core.sampleLayer(p.layers[0],60).x).toBeCloseTo(middle*100,5);
    expect(core.sampleLayer(p.layers[0],110).x).toBe(100); expect(core.sampleLayer(p.layers[0],119).x).toBe(100);
    expect(core.sampleLayer(p.layers[0],60).y).toBe(256);
    p=core.setKeyframe(p,id,'opacity',70,32); expect(core.sampleLayer(p.layers[0],0).opacity).toBe(32);
    expect(()=>core.sampleLayer(p.layers[0],NaN)).toThrow();
  });
  it('immutably creates, edits, duplicates, reorders and removes centered shapes', () => {
    const blank=core.createProject(); const one=core.addLayer(blank,'rect'); const two=core.addLayer(one,'ellipse');
    expect(blank.layers).toEqual([]); expect(one.layers).toHaveLength(1);
    expect(one.layers[0]).toMatchObject({type:'rect',x:256,y:256,width:160,height:100,fill:'#1B6C80',stroke:'#203B42',strokeWidth:0,rotation:0,opacity:100,scale:100,tracks:{}});
    expect(two.layers[1]).toMatchObject({type:'ellipse',width:100,height:100});
    const id=one.layers[0].id;
    const edited=core.updateLayer(two,id,{x:20,fill:'#ff0000',name:'Red'});
    expect(two.layers[0].x).toBe(256); expect(edited.layers[0].x).toBe(20);
    const dup=core.duplicateLayer(edited,id); expect(new Set(dup.layers.map(l=>l.id)).size).toBe(3); expect(dup.layers[2].x).toBe(20);
    const moved=core.moveLayer(dup,id,'up'); expect(moved.layers[1].id).toBe(id);
    expect(core.moveLayer(moved,id,'down').layers[0].id).toBe(id);
    expect(core.removeLayer(dup,id).layers.map(l=>l.id)).not.toContain(id);
    expect(core.moveLayer(one,id,'down')).toEqual(one);
    for(const patch of [{x:NaN},{y:8193},{width:0},{height:4097},{opacity:101},{scale:0},{rotation:3601},{strokeWidth:101},{fill:'red'},{id:'hijack'},{type:'path'},{tracks:{}},JSON.parse('{"__proto__":{}}')]) expect(()=>core.updateLayer(one,id,patch as never)).toThrow();
    for(const fn of [core.removeLayer,core.duplicateLayer]) expect(()=>fn(one,'missing')).toThrow();
    expect(()=>core.moveLayer(one,id,'sideways' as never)).toThrow();
    expect(()=>core.addLayer(one,'path' as never)).toThrow();
    let full=blank; for(let i=0;i<100;i++) full=core.addLayer(full,'rect');
    expect(()=>core.addLayer(full,'rect')).toThrow(); expect(()=>core.duplicateLayer(full,full.layers[0].id)).toThrow();
  });
  it('rejects invalid project bounds and untrusted option fields', () => {
    for (const options of [{width:15},{width:4097},{height:16.5},{fps:0},{fps:121},{durationFrames:1},{durationFrames:3601},{width:NaN},{fps:Infinity},{name:''},{name:'a'.repeat(201)},{version:2},{layers:[]},JSON.parse('{"__proto__":{}}')]) {
      expect(() => core.createProject(options as never)).toThrow();
    }
    expect(core.createProject({width:16,height:4096,fps:120,durationFrames:3600})).toMatchObject({width:16,height:4096});
  });
  it('creates a blank default project and independent custom documents', () => {
    expect(core.createProject()).toEqual({version:1,name:'Untitled motion',width:512,height:512,fps:60,durationFrames:120,layers:[]});
    const custom = core.createProject({name:'Demo',width:640,height:480,fps:30,durationFrames:90});
    expect(custom).toMatchObject({name:'Demo',width:640,height:480,fps:30,durationFrames:90});
    expect(core.createProject().layers).not.toBe(core.createProject().layers);
  });
});
