import {describe,it,expect,vi} from 'vitest';
import {DirectorClient,DirectorSession} from '../apps/web/src/studio/session';
import {safeError} from '../apps/web/src/creator/ai/client';

describe('Claude generation safe failure classification',()=>{
 it('explains reasoning timeout without implying login or quota failed',()=>{
  expect(safeError('timeout_thinking')).toMatch(/reasoning/i);
  expect(safeError('timeout_thinking')).not.toMatch(/login|billing|quota/i);
 });
 it('distinguishes incomplete writing and no-response timeout',()=>{
  expect(safeError('timeout_writing')).toMatch(/writing/i);
  expect(safeError('timeout_waiting')).toMatch(/waiting/i);
 });
 it('identifies incompatible output schema without exporting raw diagnostics',()=>{
  expect(safeError('invalid_provider_schema')).toMatch(/output format/i);
  expect(safeError('timeout')).not.toContain('Try a shorter brief');
 });
 it('Studio preserves the safe reasoning failure in Korean, never raw provider text',async()=>{
  const client=new DirectorClient();
  vi.spyOn(client,'start').mockResolvedValue('fixture-safe-error');
  vi.spyOn(client,'poll').mockResolvedValue({id:'fixture-safe-error',provider:'claude',kind:'director',status:'failed',error:{code:'timeout_thinking',message:'PRIVATE_DIAGNOSTIC_CANARY'}});
  const session=new DirectorSession(client,()=>{throw Error('must not validate failed proposal');},()=>7,()=>{});
  await session.generate('claude','Non-sensitive test',true,false);
  expect(session.state.phase).toBe('failed');
  expect(session.state.message).toContain('추론');
  expect(session.state.message).not.toContain('PRIVATE_DIAGNOSTIC_CANARY');
  expect(session.state.proposal).toBeUndefined();
  expect(session.state.active).toBe(false);
  session.dispose();
 });
});
