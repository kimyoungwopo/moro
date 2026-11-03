import {it,expect,vi} from 'vitest';
import {DirectorClient,DirectorSession,type DirectorProposal} from '../apps/web/src/studio/session';
import {blankProjectV3} from '../packages/creator-core/src/v3';
const proposal=(stage:'style'|'poses')=>({version:1,stage,summary:'test',review:{focalPoint:'f',silhouette:'s',material:'m',choreography:'c',limitations:'l'},poses:[{frame:0,label:'a'}],project:blankProjectV3()}) as DirectorProposal;
it('restores local stage review without generation or applying and requires explicit accept again',()=>{
 const client=new DirectorClient(),start=vi.spyOn(client,'start');const style=proposal('style'),poses=proposal('poses');const validate=vi.fn((v:unknown)=>v as DirectorProposal);const s=new DirectorSession(client,validate,()=>7,()=>{});
 s.restore({style,poses});
 expect(validate).toHaveBeenNthCalledWith(1,style,'style',null);expect(validate).toHaveBeenNthCalledWith(2,poses,'poses',style);expect(start).not.toHaveBeenCalled();expect(s.state.phase).toBe('review');expect(s.state.stage).toBe('poses');expect(s.state.proposal).toBe(poses);expect(s.state.expectedRevision).toBe(7);expect(s.state.message).toContain('새 AI 생성');
 s.accept();expect(s.state.stage).toBe('motion');expect(s.state.approved).toBe(poses);s.dispose();
});
it('invalid restore leaves existing state unchanged and is refused while a job is active',()=>{
 const s=new DirectorSession(new DirectorClient(),()=>{throw Error('invalid original');},()=>0,()=>{});const before=s.state;
 expect(()=>s.restore({style:proposal('style'),poses:proposal('poses')})).toThrow();expect(s.state).toBe(before);s.state={...before,active:true,phase:'running'};expect(()=>s.restore({})).toThrow();expect(s.state.active).toBe(true);
});
