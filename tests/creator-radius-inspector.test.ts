// Server rendering verifies inspector contracts; parent owns browser interaction proof.
import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as core from '../packages/creator-core/src';
import Creator from '../apps/web/src/creator/Creator';
let selectFirstNull = false;
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => {
    const result = actual.useState(initial);
    if (initial === null && selectFirstNull) { selectFirstNull = false; return ['inspected', result[1]]; }
    return result;
  } };
});
vi.mock('../packages/player-adapter/src', () => ({ createPlayer: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function inspector(type: 'rect' | 'ellipse', radius?: number | null) {
  const project = core.addLayer(core.createProject(), type);
  project.layers[0] = { ...project.layers[0], id: 'inspected', width: 120, height: 60, ...(radius === undefined ? {} : { cornerRadius: radius }) };
  vi.spyOn(core, 'createProject').mockReturnValue(project);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  selectFirstNull = true;
  return renderToStaticMarkup(createElement(Creator));
}
it('shows rect-only Corner radius with dynamic half-short-side bounds and legacy zero', () => {
  const html = inspector('rect');
  expect(html).toContain('aria-label="Corner radius"');
  expect(html).toMatch(/aria-label="Corner radius"[^>]*min="0"[^>]*max="30"[^>]*value="0"/);
  expect(html).toContain('Reduce Corner radius before shrinking');
});
it('shows explicit null as zero without rounding old geometry', () => {
  expect(inspector('rect', null)).toMatch(/aria-label="Corner radius"[^>]*value="0"/);
});
it('does not offer a Corner radius control for an ellipse', () => {
  expect(inspector('ellipse')).not.toContain('aria-label="Corner radius"');
});
