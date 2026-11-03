import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { createProject } from '../packages/creator-core/src';
import HarnessPanel from '../apps/web/src/creator/harness/HarnessPanel';
it('opens as an opt-in local-only lab with separate capability and seven-call consent controls', () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const html = renderToStaticMarkup(createElement(HarnessPanel, { currentProject: createProject(), onApply: () => {} }));
  expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  for (const label of ['Quality lab', 'Harness brief', 'Check capabilities', 'Run seven-stage harness', 'Harness provider', 'Harness domain', 'Harness target size', 'seven', 'No editor project', 'not artistic approval']) expect(html).toContain(label);
  expect(html).toMatch(/type="submit" disabled/);
});
