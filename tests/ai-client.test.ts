// Provider-free client tests: only HTTP fetch is faked; no CLI/model inference.
import { describe, it, expect, vi, afterEach } from 'vitest';
afterEach(() => vi.useRealTimers());
import { AiClient } from '../apps/web/src/creator/ai/client';
import { AiSession } from '../apps/web/src/creator/ai/session';
import AiPanel from '../apps/web/src/creator/ai/AiPanel';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { addLayer, createProject } from '../packages/creator-core/src';

import * as playerAdapter from '../packages/player-adapter/src';
import * as creatorCore from '../packages/creator-core/src';
import ProposalPreview from '../apps/web/src/creator/ai/ProposalPreview';
import { mountProposalPreview } from '../apps/web/src/creator/ai/preview';
vi.mock('../packages/player-adapter/src', () => ({ createPlayer: vi.fn() }));

const proposal = () => {
  const project = addLayer(createProject({ name: 'Orbit' }), 'ellipse');
  project.layers[0].tracks = { x: [], y: [], scale: [], rotation: [], opacity: [] };
  return project;
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const statusDto = { ok: true, scope: 'installed-only', providers: [{ id: 'codex', label: 'Codex', installed: true }, { id: 'claude', label: 'Claude Code', installed: false }] };

describe('AI client — provider-free fake fetch', () => {
  it('exports real Lottie once for the actual player, starts paused and seeks numeric frames without re-exporting', () => {
    const item = { goToAndStop: vi.fn(), play: vi.fn(), pause: vi.fn(), destroy: vi.fn(), setLoop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), currentFrame: 0 };
    vi.mocked(playerAdapter.createPlayer).mockReturnValue(item as unknown as ReturnType<typeof playerAdapter.createPlayer>);
    const exporter = vi.spyOn(creatorCore, 'exportLottie');
    const host = {} as HTMLElement, project = proposal(), onFrame = vi.fn(), onPlaying = vi.fn();
    try {
      const preview = mountProposalPreview(host, project, { onFrame, onPlaying, onError: vi.fn(), loop: true });
      expect(exporter).toHaveBeenCalledOnce();
      expect(item.setLoop).toHaveBeenCalledWith(true);
      expect(playerAdapter.createPlayer).toHaveBeenLastCalledWith(host, creatorCore.exportLottie(project), expect.any(Function), expect.any(Function));
      exporter.mockClear();
      expect(item.goToAndStop).toHaveBeenCalledWith(0, true);
      expect(item.play).not.toHaveBeenCalled();
      preview.seek(60.4);
      expect(item.goToAndStop).toHaveBeenLastCalledWith(60, true);
      expect(onFrame).toHaveBeenLastCalledWith(60);
      preview.seek(999);
      expect(item.goToAndStop).toHaveBeenLastCalledWith(119, true);
      preview.seek(NaN);
      expect(item.goToAndStop).toHaveBeenLastCalledWith(119, true);
      expect(exporter).not.toHaveBeenCalled();
      preview.play();
      expect(item.play).toHaveBeenCalledOnce();
      expect(onPlaying).toHaveBeenLastCalledWith(true);
      preview.pause();
      expect(item.pause).toHaveBeenCalledOnce();
      expect(onPlaying).toHaveBeenLastCalledWith(false);
      preview.destroy();
      expect(item.destroy).toHaveBeenCalledOnce();
    } finally { exporter.mockRestore(); }
  });
  it('tracks native playback, stops event previews at the final pose, and ignores callbacks after disposal', () => {
    const listeners = new Map<string, () => void>();
    const item = { goToAndStop: vi.fn(), play: vi.fn(), pause: vi.fn(), destroy: vi.fn(), setLoop: vi.fn(), addEventListener: vi.fn((name: string, handler: () => void) => { listeners.set(name, handler); }), removeEventListener: vi.fn(), currentFrame: 0 };
    vi.mocked(playerAdapter.createPlayer).mockReturnValue(item as unknown as ReturnType<typeof playerAdapter.createPlayer>);
    const onFrame = vi.fn(), onPlaying = vi.fn(), onError = vi.fn();
    const preview = mountProposalPreview({} as HTMLElement, proposal(), { onFrame, onPlaying, onError });
    expect(item.setLoop).toHaveBeenCalledWith(false);
    preview.seek(23);
    const [, , failed, ready] = vi.mocked(playerAdapter.createPlayer).mock.calls.at(-1)!;
    ready();
    expect(item.goToAndStop).toHaveBeenLastCalledWith(23, true);
    item.currentFrame = 52.7;
    expect(listeners.has('enterFrame')).toBe(true);
    listeners.get('enterFrame')!();
    expect(onFrame).toHaveBeenLastCalledWith(52);
    expect(listeners.has('complete')).toBe(true);
    listeners.get('complete')!();
    expect(onFrame).toHaveBeenLastCalledWith(119);
    expect(item.goToAndStop).toHaveBeenLastCalledWith(119, true);
    expect(onPlaying).toHaveBeenLastCalledWith(false);
    preview.play();
    expect(item.goToAndStop).toHaveBeenLastCalledWith(0, true);
    preview.destroy();
    const before = [onFrame.mock.calls.length, onPlaying.mock.calls.length, onError.mock.calls.length, item.goToAndStop.mock.calls.length];
    ready(); failed(); listeners.get('enterFrame')!(); listeners.get('complete')!();
    preview.seek(10); preview.play(); preview.pause(); preview.destroy();
    expect([onFrame.mock.calls.length, onPlaying.mock.calls.length, onError.mock.calls.length, item.goToAndStop.mock.calls.length]).toEqual(before);
    expect(item.destroy).toHaveBeenCalledOnce();
    expect(item.removeEventListener).toHaveBeenCalledWith('enterFrame', expect.any(Function));
    expect(item.removeEventListener).toHaveBeenCalledWith('complete', expect.any(Function));
  });
  it('renders pre-Apply preview controls, numeric warnings and the explicit brief/consent/regenerate route', () => {
    const html = renderToStaticMarkup(createElement(ProposalPreview, { project: proposal(), options: { targetSize: 128 } }));
    for (const label of ['Proposal frame', 'Play proposal', 'Proposal size', 'Review needed', 'Not an artistic approval', 'Animation brief', 'new consent', 'Generate proposal again', 'does not see this preview']) expect(html).toContain(label);
    expect(html).toContain('data-testid="ai-proposal-preview"');
    expect(html).toContain('type="number"');
    expect(html).toContain('max="119"');
    for (const size of [64, 128, 512]) expect(html).toContain(`value="${size}"`);
    expect(html).toContain('value="128" selected=""');
    expect(html).not.toContain('Pause proposal');
    expect(html).not.toContain('Apply proposal');
  });
  it('renders no numeric issues only with the explicit sample/visual-review limitation', () => {
    const project = proposal();
    project.layers[0].tracks.x = [{ frame: 0, value: 100, easing: 'linear' }, { frame: 119, value: 300, easing: 'linear' }];
    const html = renderToStaticMarkup(createElement(ProposalPreview, { project }));
    expect(html).toContain('No numeric issues detected');
    expect(html).toContain('Not an artistic approval');
    expect(html).toContain('sampled frames');
    expect(html).toContain('Loop intent not established');
    expect(html).not.toContain('loop_endpoint_mismatch');
  });
  it('preserves the native browser fetch receiver for the default transport', async () => {
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(reply(statusDto));
    });
    try { await expect(new AiClient().status()).resolves.toHaveLength(2); }
    finally { vi.unstubAllGlobals(); }
  });
  it('keeps the submitted brief and provider on the ready proposal rather than later form edits', async () => {
    const session = new AiSession(new AiClient(async url => url === '/api/ai/jobs'
      ? reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202)
      : reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } })), () => {});
    await session.generate('codex', '  seamless loop at 128px  ', true);
    expect(session.state).toMatchObject({ phase: 'ready', provider: 'codex', submittedBrief: 'seamless loop at 128px' });
    session.dispose();
  });
  it('snapshots only explicit loop intent and unambiguous supported target sizes from each submitted brief', async () => {
    for (const [brief, expected] of [
      ['seamless loop at 128px', { loop: true, targetSize: 128 }],
      ['non-looping success at 64px', { loop: false, targetSize: 64 }],
      ['Do not loop this animation at 512 px', { loop: false, targetSize: 512 }],
      ['no loop', { loop: false, targetSize: 64 }],
      ['루프 없음', { loop: false, targetSize: 64 }],
      ['루프 없는 완료 표시', { loop: false, targetSize: 64 }],
      ['not looping', { loop: false, targetSize: 64 }],
      ['Do not make a looping animation', { loop: false, targetSize: 64 }],
      ['maybe a seamless loop', { targetSize: 64 }],
      ['a success event', { targetSize: 64 }],
      ['preview at 64px and 128px', { targetSize: 64 }],
    ] as const) {
      const session = new AiSession(new AiClient(async url => url === '/api/ai/jobs'
        ? reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202)
        : reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } })), () => {});
      await session.generate('codex', brief, true);
      expect(session.state).toHaveProperty('reviewOptions', expected);
      session.dispose();
    }
  });
  it('revalidates at Apply and rejects a proposal mutated after the preview', async () => {
    const session = new AiSession(new AiClient(async url => url === '/api/ai/jobs'
      ? reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202)
      : reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } })), () => {});
    await session.generate('codex', 'orbit', true);
    session.state.project!.fps = 0;
    let applied = false;
    session.apply(() => { applied = true; });
    expect(applied).toBe(false);
    expect(session.state.phase).toBe('failed');
    session.dispose();
  });
  it('ignores an old poll that succeeds after cancellation and a newer generation', async () => {
    const oldPoll = deferred<Response>();
    let starts = 0;
    const session = new AiSession(new AiClient(async url => {
      if (url === '/api/ai/jobs') return reply({ ok: true, job: { id: `job-${++starts}`, status: 'running' } }, 202);
      if (url.endsWith('/cancel')) return reply({ ok: true, job: { id: 'job-1', status: 'cancelled' } });
      if (url.endsWith('job-1')) return oldPoll.promise;
      return reply({ ok: true, job: { id: 'job-2', provider: 'claude', status: 'succeeded', project: { ...proposal(), name: 'Newer' } } });
    }), () => {});
    const first = session.generate('codex', 'orbit', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    await session.cancel();
    await session.generate('claude', 'newer', true);
    oldPoll.resolve(reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } }));
    await first;
    expect(session.state.project?.name).toBe('Newer');
    expect(session.state.provider).toBe('claude');
    session.dispose();
  });
  it('settles cancellation when a pending start fails before returning an owned ID', async () => {
    const start = deferred<Response>();
    const session = new AiSession(new AiClient(async () => start.promise), () => {});
    const pending = session.generate('codex', 'orbit', true);
    await session.cancel();
    start.resolve(reply({ ok: false, error: { code: 'busy', message: 'SECRET' } }, 409));
    await pending;
    expect(session.state.active).toBe(false);
    expect(session.state.phase).toBe('cancelled');
    session.dispose();
  });
  it('keeps generation locked until cancellation is confirmed, then permits retry', async () => {
    const poll = deferred<Response>();
    let cancellations = 0;
    const session = new AiSession(new AiClient(async url => {
      if (url === '/api/ai/jobs') return reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202);
      if (url.endsWith('/cancel')) {
        if (++cancellations === 1) throw new Error('SECRET');
        return reply({ ok: true, job: { id: 'job-1', status: 'cancelled' } });
      }
      return poll.promise;
    }), () => {});
    const pending = session.generate('codex', 'orbit', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    await session.cancel();
    expect(session.state.active).toBe(true);
    expect(session.state.message).toContain('Cancellation could not be confirmed');
    await session.cancel();
    expect(session.state.active).toBe(false);
    poll.resolve(reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } }));
    await pending;
    expect(session.state.project).toBeUndefined();
    session.dispose();
  });
  it('renders the agreed accessible panel labels, explicit consent and no secret inputs', () => {
    const html = renderToStaticMarkup(createElement(AiPanel, { onApply: () => { throw new Error('Must not apply while rendering'); } }));
    for (const text of ['Your AI', 'AI provider', 'Animation brief', 'I agree to send this brief to the selected AI provider.', 'Generate proposal', 'No current project is uploaded.', 'Installed does not mean logged in']) expect(html).toContain(text);
    expect(html).toContain('maxLength="4000"');
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('Apply proposal');
  });
  it('cancels a pending start on unmount, suppresses state updates and cannot apply late success', async () => {
    const start = deferred<Response>();
    const calls: string[] = [];
    let emissions = 0;
    const session = new AiSession(new AiClient(async url => {
      calls.push(url);
      return url === '/api/ai/jobs' ? start.promise : reply({ ok: true, job: { id: 'job-1', status: 'cancelled' } });
    }), () => { emissions++; });
    const pending = session.generate('codex', 'orbit', true);
    session.dispose();
    const before = emissions;
    start.resolve(reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202));
    await pending;
    expect(calls).toEqual(['/api/ai/jobs', '/api/ai/jobs/job-1/cancel']);
    expect(emissions).toBe(before);
    let applied = false;
    session.apply(() => { applied = true; });
    expect(applied).toBe(false);
  });
  it('allows one active job, cancels in-flight polling and never publishes its late success', async () => {
    const poll = deferred<Response>();
    const calls: string[] = [];
    const session = new AiSession(new AiClient(async url => {
      calls.push(url);
      if (url === '/api/ai/jobs') return reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202);
      if (url.endsWith('/cancel')) return reply({ ok: true, job: { id: 'job-1', status: 'succeeded' } });
      return poll.promise;
    }), () => {});
    const pending = session.generate('codex', 'orbit', true);
    await new Promise(resolve => setTimeout(resolve, 0));
    await session.generate('claude', 'second', true);
    expect(calls.filter(url => url === '/api/ai/jobs')).toHaveLength(1);
    await session.cancel();
    poll.resolve(reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: proposal() } }));
    await pending;
    expect(session.state.phase).toBe('cancelled');
    expect(session.state.project).toBeUndefined();
    session.dispose();
  });
  it('bounds polling to 180 seconds and cancels the owned job on timeout', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const session = new AiSession(new AiClient(async url => {
      calls.push(url);
      return reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: url.endsWith('/cancel') ? 'cancelled' : 'running' } }, url === '/api/ai/jobs' ? 202 : 200);
    }), () => {});
    const pending = session.generate('codex', 'orbit', true);
    await vi.advanceTimersByTimeAsync(181000);
    await pending;
    expect(calls.at(-1)).toBe('/api/ai/jobs/job-1/cancel');
    expect(calls.length).toBeLessThanOrEqual(182);
    expect(session.state.active).toBe(false);
    expect(session.state.message).toContain('timed out');
    session.dispose();
  });
  it('polls into a proposal without applying; explicit Apply validates again and can apply only once', async () => {
    vi.useFakeTimers();
    let polls = 0;
    const client = new AiClient(async url => url === '/api/ai/jobs'
      ? reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202)
      : reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: ++polls === 1 ? 'running' : 'succeeded', ...(polls === 1 ? {} : { project: proposal() }) } }));
    const session = new AiSession(client, () => {});
    const applied: unknown[] = [];
    const pending = session.generate('codex', 'orbit', true);
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(session.state.phase).toBe('ready');
    expect(session.state.project?.name).toBe('Orbit');
    expect(applied).toHaveLength(0);
    session.apply(project => applied.push(project));
    session.apply(project => applied.push(project));
    expect(applied).toEqual([proposal()]);
    expect(session.state.phase).toBe('applied');
    session.dispose();
  });
  it('cancels exactly the owned ID with an empty JSON body and rejects mismatched responses', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const client = new AiClient(async (url, init) => { calls.push([url, init]); return reply({ ok: true, job: { id: 'job-1', status: 'cancelled' } }); });
    expect(await client.cancel('job-1')).toBe('cancelled');
    expect(calls[0]).toMatchObject(['/api/ai/jobs/job-1/cancel', { method: 'POST', body: '{}', credentials: 'omit' }]);
    await expect(client.cancel('../status')).rejects.toThrow();
    const wrong = new AiClient(async () => reply({ ok: true, job: { id: 'other', status: 'cancelled' } }));
    await expect(wrong.cancel('job-1')).rejects.toThrow('invalid');
  });
  it('bounds stalled requests and aborts transport without exposing raw errors', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const client = new AiClient(async (_url, init) => { signal = init?.signal as AbortSignal; return new Promise(() => {}); });
    const result = client.start('codex', 'orbit', true).catch(error => error);
    await vi.advanceTimersByTimeAsync(10000);
    expect((await result).message).toBe('The local AI bridge did not respond. Retry or keep editing.');
    expect(signal?.aborted).toBe(true);
    const broken = new AiClient(async () => { throw new Error('SECRET /Users/me'); });
    await expect(broken.start('codex', 'orbit', true)).rejects.toThrow('The local AI bridge did not respond. Retry or keep editing.');
  });
  it('does not trust raw failure messages, mismatched providers or job IDs', async () => {
    const client = new AiClient(async () => reply({ ok: false, error: { code: 'busy', message: 'SECRET' } }, 409));
    await expect(client.start('codex', 'orbit', true)).rejects.toThrow('Another generation is running.');
    for (const job of [
      { id: 'other', provider: 'codex', status: 'succeeded', project: proposal() },
      { id: 'job-1', provider: 'claude', status: 'succeeded', project: proposal() },
    ]) await expect(new AiClient(async () => reply({ ok: true, job })).poll('job-1', 'codex')).rejects.toThrow('invalid');
  });
  it('requires consent and a bounded trimmed brief before sending only provider and prompt', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const client = new AiClient(async (url, init) => { calls.push([url, init]); return reply({ ok: true, job: { id: 'job-1', status: 'running' } }, 202); });
    for (const [prompt, consent] of [['hello', false], ['', true], ['x'.repeat(4001), true]] as const) {
      await expect(client.start('codex', prompt, consent)).rejects.toThrow();
    }
    expect(calls).toHaveLength(0);
    expect(await client.start('codex', '  simple orbit  ', true)).toBe('job-1');
    expect(calls[0][0]).toBe('/api/ai/jobs');
    expect(calls[0][1]).toMatchObject({ method: 'POST', credentials: 'omit', body: JSON.stringify({ provider: 'codex', prompt: 'simple orbit' }), headers: { 'X-Moro-Request': '1', 'Content-Type': 'application/json' } });
  });
  it('validates succeeded project through core parsing and the stricter AI contract', async () => {
    const project = proposal();
    const client = new AiClient(async () => reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project } }));
    expect(await client.poll('job-1', 'codex')).toEqual({ id: 'job-1', provider: 'codex', status: 'succeeded', project });
    for (const invalid of [
      { ...project, fps: 0 },
      { ...project, hook: 'evil' },
      { ...project, layers: Array.from({ length: 21 }, (_, i) => ({ ...project.layers[0], id: `l-${i}` })) },
      { ...project, layers: [{ ...project.layers[0], tracks: {} }] },
      { ...project, name: 'bad\u007f' },
    ]) {
      const bad = new AiClient(async () => reply({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project: invalid } }));
      await expect(bad.poll('job-1', 'codex')).rejects.toThrow('The AI response was invalid. Your animation is unchanged.');
    }
  });
  it('treats missing bridge and malformed status as safe setup errors, never raw server text', async () => {
    for (const fetcher of [
      async () => new Response('<html>local/path/secret</html>'),
      async () => { throw new Error('secret network detail'); },
      async () => reply({ ...statusDto, scope: 'authenticated' }),
      async () => reply({ ...statusDto, providers: [{ id: 'evil', label: 'raw secret', installed: true }] }),
    ]) {
      await expect(new AiClient(fetcher).status()).rejects.toThrow('Local AI bridge unavailable. Keep editing, or start the local AI bridge and retry.');
    }
  });
  it('reads installed-only status over same origin without cookies', async () => {
    const requests: [string, RequestInit | undefined][] = [];
    const client = new AiClient(async (url, init) => { requests.push([String(url), init]); return reply(statusDto); });
    expect(await client.status()).toEqual(statusDto.providers);
    expect(requests[0][0]).toBe('/api/ai/status');
    expect(requests[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Moro-Request': '1' } });
  });
});
