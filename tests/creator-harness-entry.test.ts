import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import Creator from '../apps/web/src/creator/Creator';

it('offers an opt-in closed Quality lab entry without mounting a provider run on initial render', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  try {
    const html = renderToStaticMarkup(createElement(Creator));
    expect(html).toMatch(/<button[^>]*aria-label="Quality lab"[^>]*aria-expanded="false"/);
    expect(html).not.toContain('Run seven-stage harness');
    expect(html).toContain('Optional AI sends only what you consent to.');
  } finally { vi.unstubAllGlobals(); }
});
