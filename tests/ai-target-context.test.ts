// Provider-free behavior checks: real session/client; HTTP only is faked.
import * as targetContext from '../apps/web/src/creator/ai/target-context';
import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiClient } from '../apps/web/src/creator/ai/client';
import { AiSession } from '../apps/web/src/creator/ai/session';
import AiPanel from '../apps/web/src/creator/ai/AiPanel';
import { addLayer, createProject } from '../packages/creator-core/src';
vi.mock('../packages/player-adapter/src', () => ({ createPlayer: vi.fn() }));

it('uses the explicit submitted display target instead of canvas dimensions or later brief hints', async () => {
  const prompt = 'Design target: 128px (final display size, not canvas dimensions).\n\n  A seamless loop on a 512px canvas, with a 64px badge.  ';
  let sent: unknown;
  const project = addLayer(createProject(), 'rect');
  project.layers[0].tracks = { x: [], y: [], scale: [], rotation: [], opacity: [] };
  const session = new AiSession(new AiClient(async (url, init) => {
    if (url === '/api/ai/jobs') { sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ ok: true, job: { id: 'job-1', status: 'running' } }), { status: 202 }); }
    return new Response(JSON.stringify({ ok: true, job: { id: 'job-1', provider: 'codex', status: 'succeeded', project } }));
  }), () => {});
  await session.generate('codex', prompt, true);
  expect(sent).toEqual({ provider: 'codex', prompt });
  expect(session.state.submittedBrief).toBe(prompt);
  expect(session.state.reviewOptions).toEqual({ targetSize: 128, loop: true });
  session.dispose();
});

it('preserves raw brief text and rejects overflow rather than truncating at every target', () => {
  for (const target of targetContext.TARGET_DISPLAY_SIZES) {
    const raw = '  Motion\nwith spacing.  ';
    const prefix = `Design target: ${target}px (final display size, not canvas dimensions).\n\n`;
    expect(targetContext.composeTargetBrief(raw, target)).toBe(prefix + raw);
    const max = targetContext.briefLimitForTarget(target);
    expect(targetContext.composeTargetBrief('x'.repeat(max), target)).toHaveLength(4000);
    expect(() => targetContext.composeTargetBrief('x'.repeat(max + 1), target)).toThrow(/4000/);
    expect(() => targetContext.composeTargetBrief('  \n ', target)).toThrow(/brief/i);
  }
});

it('discloses a default 64px display target before generation', () => {
  const html = renderToStaticMarkup(createElement(AiPanel, { onApply() {} }));
  expect(html).toContain('Target display size');
  expect(html).toContain('value="64" selected=""');
  expect(html).toContain('selected display size is sent with your brief');
});
