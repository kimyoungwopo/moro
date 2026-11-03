import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import Creator from '../apps/web/src/creator/Creator';
it('links the local-only Rig lab without replacing v1 editing or optional AI', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  try {
    const html = renderToStaticMarkup(createElement(Creator));
    expect(html).toMatch(/<a[^>]*href="\/rig"[^>]*>Rig lab<\/a>/);
    expect(html).toContain('AI assistant');
    expect(html).toContain('Quality lab');
  } finally { vi.unstubAllGlobals(); }
});
