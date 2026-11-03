import { afterEach, vi, expect, it } from 'vitest';
import { HarnessClient } from '../apps/web/src/creator/harness/client';
import type { Fetcher } from '../apps/web/src/creator/ai/client';
const task = { provider: 'codex' as const, brief: 'Circle settles.', domain: 'ui-motion' as const };
afterEach(() => vi.useRealTimers());
const ready = { status: 'ready', blockers: [], artisticReview: 'not_reviewed', modelCalls: 0, callBudget: 7 };
it('rejects nonconsent, unsupported domain and malformed tasks without transport calls', async () => {
  const fetcher = vi.fn(async () => Response.json({ ok: true, job: { id: 'x' } }));
  const client = new HarnessClient(fetcher);
  for (const [input, consent] of [[task, false], [{ ...task, domain: 'human-character' }, true], [{ ...task, brief: ' ' }, true], [{ ...task, brief: 'x'.repeat(4001) }, true]] as const) {
    await expect(client.start(input, consent)).rejects.toThrow();
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  { ...ready, modelCalls: 1 }, { ...ready, callBudget: 8 }, { ...ready, artisticReview: 'approved' }, { ...ready, blockers: ['blocked'] },
])('rejects malformed capability evidence %j', async preflight => {
  const client = new HarnessClient(async () => Response.json({ ok: true, preflight }));
  await expect(client.preflight(task)).rejects.toThrow('invalid');
});
it('hides raw provider diagnostics and rejects HTTP failures', async () => {
  const client = new HarnessClient(async () => Response.json({ ok: false, error: { code: 'internal', message: 'SECRET /Users/private' } }, { status: 500 }));
  await expect(client.preflight(task)).rejects.toThrow(/could not finish/);
});
it('times out a stuck transport even if it ignores AbortSignal', async () => {
  vi.useFakeTimers();
  const client = new HarnessClient(() => new Promise(() => {}));
  const result = expect(client.preflight(task)).rejects.toThrow('did not respond');
  await vi.advanceTimersByTimeAsync(10001); await result;
});
it('polls harness-only matching jobs and cancels using an empty body', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new HarnessClient(async (url, init) => { calls.push({ url, init }); return Response.json({ ok: true, job: { id: 'j1', kind: 'harness', provider: 'codex', status: url.endsWith('cancel') ? 'cancelled' : 'running', stage: 'probe-domain' } }); });
  expect(await client.poll('j1', task)).toMatchObject({ status: 'running', stage: 'probe-domain' });
  expect(await client.cancel('j1')).toBe('cancelled');
  expect(calls.map(call => call.url)).toEqual(['/api/ai/jobs/j1', '/api/ai/jobs/j1/cancel']);
  expect(JSON.parse(calls[1].init!.body as string)).toEqual({});
});
it.each([{ kind: 'generate' }, { provider: 'claude' }, { id: 'other' }, { stage: 'invented' }, { status: 'unknown' }])('rejects foreign or malformed job %j', async extra => {
  const client = new HarnessClient(async () => Response.json({ ok: true, job: { id: 'j1', kind: 'harness', provider: 'codex', status: 'running', ...extra } }));
  await expect(client.poll('j1', task)).rejects.toThrow('invalid');
});
it('checks capabilities without starting a provider and sends an exact seven-call consent payload', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = async (url, init) => { requests.push({ url, init }); return Response.json(url.endsWith('preflight') ? { ok: true, preflight: ready } : { ok: true, job: { id: 'fixture_1', status: 'running', provider: 'codex', kind: 'harness' } }, { status: url.endsWith('preflight') ? 200 : 202 }); };
  const client = new HarnessClient(fetcher);
  expect(requests).toHaveLength(0);
  expect(await client.preflight(task)).toEqual(ready);
  expect(requests.map(request => request.url)).toEqual(['/api/ai/harness/preflight']);
  expect(await client.start(task, true)).toBe('fixture_1');
  expect(JSON.parse(requests[0].init!.body as string)).toEqual(task);
  expect(JSON.parse(requests[1].init!.body as string)).toEqual({ ...task, consent: true, callBudget: 7 });
  expect(requests[1].init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { 'X-Moro-Request': '1' } });
});
