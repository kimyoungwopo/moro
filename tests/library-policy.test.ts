import {expect,it} from 'vitest';
import {addLayer,createProject} from '../packages/creator-core/src';
import {prepareMotion,assertCapacity,validateSavedMotion} from '../apps/web/src/creator/library/policy';

it('saves an independent validated JSON snapshot with source attribution',()=>{
  const project=addLayer(createProject(),'rect');
  const saved=prepareMotion({project,origin:'ai',provider:'codex',brief:'A wave'},'motion-1','2026-10-31T00:00:00.000Z');
  expect(saved).toMatchObject({version:1,id:'motion-1',origin:'ai',provider:'codex',brief:'A wave'});
  project.layers[0].name='Changed later';
  expect(saved.project.layers[0].name).toBe('Rectangle');
});

it('rejects invalid metadata and executable fields before inspecting values',()=>{
  const base={project:createProject(),origin:'editor' as const};
  for(const bad of [{...base,origin:'example'},{...base,provider:'other'},{...base,brief:42},{...base,brief:'x'.repeat(8001)},{...base,token:'secret'},{...base,project:{...base.project,width:0}}]) {
    expect(()=>prepareMotion(bad as never,'motion-1','2026-10-31T00:00:00.000Z')).toThrow();
  }
  let executed=false;
  const unsafe=Object.defineProperty({...base},'brief',{get(){executed=true;return 'unsafe';},enumerable:true});
  expect(()=>prepareMotion(unsafe,'motion-1','2026-10-31T00:00:00.000Z')).toThrow();
  expect(executed).toBe(false);
  expect(()=>prepareMotion(base,'','2026-10-31T00:00:00.000Z')).toThrow();
  expect(()=>prepareMotion(base,'motion-1','not-a-date')).toThrow();
});

it('rejects the thirteenth save without changing any existing entries',()=>{
  for(const n of [0,1,11]) expect(()=>assertCapacity(n)).not.toThrow();
  for(const n of [12,13]) expect(()=>assertCapacity(n)).toThrow(/full.*12/i);
});
it('validates read records without executing accessors or accepting unknown versions',()=>{
  const record=prepareMotion({project:createProject(),origin:'editor'},'motion-1','2026-10-31T00:00:00.000Z');
  expect(validateSavedMotion(record)).toEqual(record);
  expect(validateSavedMotion(record)).not.toBe(record);
  for(const bad of [null,{...record,version:2},{...record,token:'secret'},{...record,project:{...record.project,layers:[{script:'evil'}]}}]) expect(()=>validateSavedMotion(bad)).toThrow();
  let ran=false;
  const bad=Object.defineProperty({...record},'project',{get(){ran=true;return record.project;}});
  expect(()=>validateSavedMotion(bad)).toThrow();expect(ran).toBe(false);
});
