// In-memory HTTP transport only: no native CLI, authentication or inference.
import { afterEach, expect, it, vi } from 'vitest';
import { ClaudeAuthClient, ClaudeAuthError, LOGIN_COMMAND } from '../apps/web/src/ai-auth/client';
const dto = {ok:true,provider:'claude',installed:true,state:'signed_in',loginMethod:'terminal',scope:'cli-reported',inferenceVerified:false};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('preserves native fetch receiver, fixed same-origin status and zero constructor requests',async()=>{
 const requests: {url:string;init?:RequestInit}[]=[];
 vi.stubGlobal('fetch',function(this:unknown,url:string,init?:RequestInit){expect(this).toBe(globalThis);requests.push({url,init});return Promise.resolve(reply(dto));});
 const client=new ClaudeAuthClient();expect(requests).toEqual([]);
 expect(await client.status()).toEqual(dto);
 expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({url:'/api/ai/auth/claude/status',init:{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{'X-Moro-Request':'1','Content-Type':'application/json'}}});
 expect(requests[0].init?.body).toBeUndefined();expect(LOGIN_COMMAND).toBe('claude auth login --claudeai');
});
it.each(['signed_out','signed_in','unknown','cli_update_required','not_installed'])('accepts only CLI-reported %s status without inferring availability',async state=>{
 const data={...dto,state,installed:state!=='not_installed'};
 expect(await new ClaudeAuthClient(async()=>reply(data)).status()).toEqual(data);
});
it.each([
 {...dto,email:'PRIVATE_EMAIL'},{...dto,stdout:'PRIVATE_CODE https://secret.invalid'},
 {...dto,provider:'codex'},{...dto,state:'expired'},{...dto,inferenceVerified:true},
 {...dto,installed:false},{...dto,loginMethod:'browser'},{...dto,scope:'authenticated'},
 null,[],{...dto,installed:'true'},
])('rejects malformed/private/overclaimed status without disclosing payload %#',async value=>{
 await expect(new ClaudeAuthClient(async()=>reply(value)).status()).rejects.toThrow('로그인 상태를 확인하지 못했어요');
});
it('sends nothing for false/malformed consent and sends exactly the fixed consent body once',async()=>{
 const fetcher=vi.fn(async()=>reply({ok:true,provider:'claude',handoff:'terminal_requested',authenticationVerified:false},202));
 const client=new ClaudeAuthClient(fetcher);
 for(const consent of [false,undefined,null,1,'true',{consent:true}])await expect(client.login(consent as boolean)).rejects.toThrow('별도 동의');
 expect(fetcher).not.toHaveBeenCalled();await client.login(true);
 expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0]).toMatchObject(['/api/ai/auth/claude/login',{method:'POST',body:'{"consent":true}',credentials:'omit',redirect:'error',headers:{'X-Moro-Request':'1','Content-Type':'application/json'}}]);
});
it.each([
 {ok:true,provider:'claude',handoff:'terminal_requested',authenticationVerified:true},
 {ok:true,provider:'claude',handoff:'signed_in',authenticationVerified:false},
 {ok:true,provider:'claude',handoff:'terminal_requested',authenticationVerified:false,url:'https://PRIVATE.invalid'},
])('never treats malformed handoff or private fields as successful login %#',async value=>{
 await expect(new ClaudeAuthClient(async()=>reply(value,202)).login(true)).rejects.toThrow('로그인 상태를 확인하지 못했어요');
});
it.each([[400,'invalid_request'],[400,'consent_required'],[409,'busy'],[409,'auth_handoff_pending'],[503,'provider_unavailable'],[501,'manual_login_required'],[502,'terminal_handoff_failed'],[504,'terminal_handoff_unconfirmed']] as const)('maps %s %s to safe Korean copy without retries',async(status,code)=>{
 const fetcher=vi.fn(async()=>reply({ok:false,error:{code,message:'PRIVATE_CODE https://PRIVATE.invalid /Users/private',stderr:'PRIVATE_STDERR'}},status));
 const error=await new ClaudeAuthClient(fetcher).login(true).catch(error=>error as ClaudeAuthError);
 expect(error).toBeInstanceOf(ClaudeAuthError);if(!(error instanceof ClaudeAuthError))throw Error('Expected safe error');expect(error.code).toBe(code);expect(error.message).not.toMatch(/PRIVATE|https:|\/Users/);expect(fetcher).toHaveBeenCalledOnce();
});
it('times out a stalled transport, aborts it and never retries or leaks raw errors',async()=>{
 vi.useFakeTimers();let signal:AbortSignal|undefined;
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(()=>{});});
 const result=new ClaudeAuthClient(fetcher).status().catch(error=>error);
 await vi.advanceTimersByTimeAsync(10001);expect((await result).message).toContain('로그인 상태를 확인하지 못했어요');expect(signal?.aborted).toBe(true);expect(fetcher).toHaveBeenCalledOnce();
 for(const fetcher of [async()=>{throw Error('PRIVATE_CODE');},async()=>new Response('<html>PRIVATE_CODE</html>'),async()=>new Response('x'.repeat(8193))]){
  const error=await new ClaudeAuthClient(fetcher).status().catch(error=>error);expect(error.message).not.toContain('PRIVATE');
 }
});
it('settles external cancellation promptly even if a transport ignores abort',async()=>{
 vi.useFakeTimers();const controller=new AbortController();let settled=false;
 const pending=new ClaudeAuthClient(async()=>new Promise<Response>(()=>{})).status(controller.signal).catch(()=>{settled=true;});
 controller.abort();await vi.advanceTimersByTimeAsync(1);expect(settled).toBe(true);await pending;
});
