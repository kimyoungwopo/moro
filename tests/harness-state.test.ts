import { afterEach, expect, it, vi } from 'vitest';
import { addLayer, createProject } from '../packages/creator-core/src';
import { HarnessClient } from '../apps/web/src/creator/harness/client';
import { HarnessSession } from '../apps/web/src/creator/harness/state';
const task = { provider: 'codex' as const, brief: 'Circle settles.', domain: 'ui-motion' as const };
function fixture() {
  const project = addLayer(createProject(), 'ellipse');
  for (const layer of project.layers) layer.tracks = { x: [], y: [], scale: [], rotation: [], opacity: [] };
  const guidance = { rules: ['Inspect motion.'], rationale: 'Fixture only.' };
  return { schemaVersion: 1, upstream: {}, task, status: 'review_required', blockers: [], sources: [], modelCalls: 7, callBudget: 7, artisticReview: 'not_reviewed', project, guidance,
    stages: ['base', 'propose-invariant', 'propose-domain', 'probe-invariant', 'probe-domain', 'compose', 'final'].map(id => ({ id, kind: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? 'project' : 'guidance', attempted: true, status: 'succeeded', data: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? { ...project, name: id === 'final' ? project.name : id } : guidance })) };
}
function setup() {
  const calls: string[] = [];
  const report = fixture();
  const client = new HarnessClient(async url => {
    calls.push(url);
    if (url.endsWith('preflight')) return Response.json({ ok: true, preflight: { status: 'ready', blockers: [], modelCalls: 0, callBudget: 7, artisticReview: 'not_reviewed' } });
    return Response.json({ ok: true, job: { id: 'j1', provider: 'codex', kind: 'harness', status: url.endsWith('/harness/jobs') ? 'running' : url.endsWith('/cancel') ? 'cancelled' : 'succeeded', report } });
  });
  return { calls, report, client, session: new HarnessSession(client) };
}
afterEach(() => vi.useRealTimers());
it.each(['running', 'transport-error'] as const)('keeps ownership and blocks resubmission until cancellation is confirmed: %s', async outcome => {
  const { session, client, calls } = setup();
  vi.spyOn(client, 'poll').mockResolvedValue({ id: 'j1', status: 'running' });
  const cancel = vi.spyOn(client, 'cancel');
  if (outcome === 'running') cancel.mockResolvedValueOnce('running'); else cancel.mockRejectedValueOnce(new Error('SECRET'));
  cancel.mockResolvedValue('cancelled');
  await session.check(task); session.setConsent(true); await session.run(task, createProject());
  await session.cancel();
  expect(session.state.active).toBe(true); expect(session.state.message).not.toContain('SECRET');
  const count = calls.length; await session.check(task); session.setConsent(true); await session.run(task, createProject());
  expect(calls).toHaveLength(count);
  await session.cancel(); expect(cancel).toHaveBeenCalledTimes(2); expect(session.state.active).toBe(false);
});
it('ignores a successful poll that arrives after cancellation', async () => {
  const { session, client } = setup(); let resolve!: (value: Awaited<ReturnType<HarnessClient['poll']>>) => void;
  const originalPoll = client.poll.bind(client); const completed = await originalPoll('j1', task);
  vi.spyOn(client, 'poll').mockImplementation(() => new Promise(done => { resolve = done; }));
  await session.check(task); session.setConsent(true);
  const run = session.run(task, createProject()); await Promise.resolve(); await Promise.resolve();
  // Wait until the explicit fake transport has returned the start ID.
  for (let i = 0; i < 20 && !resolve; i++) await Promise.resolve();
  expect(resolve).toBeTypeOf('function');
  await session.cancel(); resolve(completed); await run;
  expect(session.state.phase).toBe('cancelled'); expect(session.state.review).toBeUndefined();
});
it('polls sequentially within a finite budget, cancels at the limit and never publishes running output', async () => {
  vi.useFakeTimers(); const { client } = setup();
  const poll = vi.spyOn(client, 'poll').mockResolvedValue({ id: 'j1', status: 'running', stage: 'base' });
  const cancel = vi.spyOn(client, 'cancel').mockResolvedValue('cancelled');
  const session = new HarnessSession(client, () => {}, { pollIntervalMs: 10, maxPolls: 2, maxDurationMs: 1000 });
  await session.check(task); session.setConsent(true); await session.run(task, createProject());
  expect(session.state.phase).toBe('running'); expect(session.state.review).toBeUndefined();
  await vi.advanceTimersByTimeAsync(100);
  expect(poll).toHaveBeenCalledTimes(2); expect(cancel).toHaveBeenCalledExactlyOnceWith('j1');
  expect(session.state.active).toBe(false); expect(session.state.message).toContain('limit');
});
it('cancels a run that is still obtaining its ID and ignores late success', async () => {
  const { session, client } = setup();
  let resolve!: (id: string) => void;
  vi.spyOn(client, 'start').mockImplementation(() => new Promise(done => { resolve = done; }));
  const cancel = vi.spyOn(client, 'cancel').mockResolvedValue('cancelled');
  const poll = vi.spyOn(client, 'poll');
  await session.check(task); session.setConsent(true);
  const run = session.run(task, createProject());
  expect(session.state.active).toBe(true);
  await session.cancel(); resolve('late_id'); await run;
  expect(cancel).toHaveBeenCalledExactlyOnceWith('late_id'); expect(poll).not.toHaveBeenCalled();
  expect(session.state.phase).toBe('cancelled'); expect(session.state.review).toBeUndefined();
});
it('unmount disposal cancels owned work and suppresses later observer updates', async () => {
  const { client } = setup(); const changed = vi.fn();
  vi.spyOn(client, 'poll').mockResolvedValue({ id: 'j1', status: 'running' });
  const cancel = vi.spyOn(client, 'cancel').mockResolvedValue('cancelled');
  const session = new HarnessSession(client, changed);
  await session.check(task); session.setConsent(true); await session.run(task, createProject());
  session.dispose(); const count = changed.mock.calls.length;
  await Promise.resolve(); await Promise.resolve();
  expect(cancel).toHaveBeenCalledExactlyOnceWith('j1'); expect(changed).toHaveBeenCalledTimes(count);
});
it.each(['failed', 'cancelled', 'malformed'] as const)('preserves the editor after %s output', async status => {
  const { session, client } = setup(); const base = createProject(); const before = JSON.stringify(base); const apply = vi.fn();
  if (status === 'malformed') vi.spyOn(client, 'poll').mockRejectedValue(new Error('The harness response was invalid. Your animation is unchanged.'));
  else vi.spyOn(client, 'poll').mockResolvedValue({ id: 'j1', status, message: 'Generation could not finish.' });
  await session.check(task); session.setConsent(true); await session.run(task, base);
  expect(session.state.phase).not.toBe('ready'); expect(session.state.review).toBeUndefined();
  expect(session.apply(base, apply)).toBe(false); expect(apply).not.toHaveBeenCalled(); expect(JSON.stringify(base)).toBe(before);
});
it('ignores old capability checks after a control change', async () => {
  const { session, client } = setup(); let resolve!: (value: Awaited<ReturnType<HarnessClient['preflight']>>) => void;
  vi.spyOn(client, 'preflight').mockImplementation(() => new Promise(done => { resolve = done; }));
  const checking = session.check(task); session.invalidate();
  resolve({ status: 'ready', blockers: [], modelCalls: 0, callBudget: 7, artisticReview: 'not_reviewed' }); await checking;
  expect(session.state.preflight).toBeUndefined(); expect(session.state.consent).toBe(false);
});
it('snapshots locally before the start response and rejects editor changes made in flight', async () => {
  const { session, client } = setup(); let resolve!: (id: string) => void;
  vi.spyOn(client, 'start').mockImplementation(() => new Promise(done => { resolve = done; }));
  const base = createProject(); const original = structuredClone(base); const apply = vi.fn();
  await session.check(task); session.setConsent(true); const run = session.run(task, base);
  base.name = 'Edited in flight'; resolve('j1'); await run;
  expect(session.state.baseProject).toEqual(original);
  expect(session.apply(base, apply)).toBe(false); expect(apply).not.toHaveBeenCalled();
});
it('enforces the wall deadline independently of the poll-count budget', async () => {
  vi.useFakeTimers(); const { client } = setup();
  vi.spyOn(client, 'poll').mockResolvedValue({ id: 'j1', status: 'running' });
  const cancel = vi.spyOn(client, 'cancel').mockResolvedValue('cancelled');
  const session = new HarnessSession(client, () => {}, { maxDurationMs: 25, pollIntervalMs: 1000 });
  await session.check(task); session.setConsent(true); await session.run(task, createProject());
  await vi.advanceTimersByTimeAsync(26);
  expect(cancel).toHaveBeenCalledExactlyOnceWith('j1'); expect(session.state.message).toContain('time limit'); expect(session.state.review).toBeUndefined();
});
it('requires a matching ready preflight and new consent after invalidation', async () => {
  const { session, calls } = setup();
  await session.run(task, createProject());
  expect(calls).toEqual([]);
  await session.check(task); session.setConsent(true);
  await session.run({ ...task, brief: 'Changed target or brief.' }, createProject());
  expect(calls).toEqual(['/api/ai/harness/preflight']);
  await session.check(task); session.setConsent(true); session.invalidate();
  expect(session.state.preflight).toBeUndefined(); expect(session.state.consent).toBe(false);
  await session.run(task, createProject());
  expect(calls.filter(url => url.endsWith('/harness/jobs'))).toHaveLength(0);
});
it('refuses stale-editor adoption and semantic no-ops without touching Undo', async () => {
  const { session, client } = setup(); const base = createProject(); const apply = vi.fn();
  await session.check(task); session.setConsent(true); await session.run(task, base);
  expect(session.apply({ ...base, name: 'Edited while running' }, apply)).toBe(false);
  expect(apply).not.toHaveBeenCalled();
  const selected = session.state.review!.candidates[0].project;
  const other = new HarnessSession(client);
  await other.check(task); other.setConsent(true); await other.run(task, selected);
  expect(other.apply(selected, apply)).toBe(false);
  expect(apply).not.toHaveBeenCalled();
});
it('honors a synchronous parent refusal and catches apply failure without claiming applied', async () => {
  const { session } = setup(); const base = createProject();
  await session.check(task); session.setConsent(true); await session.run(task, base);
  expect(session.apply(base, () => false)).toBe(false);
  expect(session.state.phase).toBe('ready');
  expect(session.apply(base, () => { throw new Error('SECRET'); })).toBe(false);
  expect(session.state.phase).not.toBe('applied');
  expect(session.state.message).not.toContain('SECRET');
});
it('checks without inference then permits one explicitly consented run and manual four-stage adoption', async () => {
  const { session, calls } = setup(); const base = createProject(); const apply = vi.fn();
  expect(calls).toEqual([]);
  await session.check(task);
  expect(calls).toEqual(['/api/ai/harness/preflight']);
  session.setConsent(true);
  await session.run(task, base);
  expect(session.state.phase).toBe('ready');
  expect(session.state.selected).toBe('base');
  expect(session.state.review?.candidates).toHaveLength(4);
  session.select('probe-domain');
  expect(session.apply(base, apply)).toBe(true);
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply.mock.calls[0][0].name).toBe('probe-domain');
  expect(apply.mock.calls[0][1]).toEqual(base);
  expect(session.apply(base, apply)).toBe(false);
});
