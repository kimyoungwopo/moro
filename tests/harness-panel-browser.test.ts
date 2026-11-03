import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { addLayer, createProject } from '../packages/creator-core/src';
let browser: Browser, server: Server, origin: string, page: Page;
let requests: { path: string; body: Record<string, unknown> }[] = [];
let scenario: 'success' | 'running' | 'malformed' = 'success';
let task: Record<string, unknown> = {};
const project = addLayer(createProject(), 'ellipse');
project.name = 'Editor stays local';
for (const layer of project.layers) layer.tracks = { x: [], y: [], scale: [], rotation: [], opacity: [] };
function report() {
  const guidance = { rules: ['<img src=x onerror="window.untrusted=true">'], rationale: '<script>window.untrusted=true</script>' };
  const final = { ...project, name: 'Final fixture' };
  return { schemaVersion: 1, upstream: {}, task, status: 'review_required', blockers: [], sources: [], modelCalls: 7, callBudget: 7, artisticReview: 'not_reviewed', project: final, guidance,
    stages: ['base', 'propose-invariant', 'propose-domain', 'probe-invariant', 'probe-domain', 'compose', 'final'].map(id => ({ id, kind: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? 'project' : 'guidance', attempted: true, status: 'succeeded', data: ['base', 'probe-invariant', 'probe-domain', 'final'].includes(id) ? id === 'base' ? project : { ...project, name: id === 'final' ? final.name : id } : guidance })) };
}
beforeAll(async () => {
  const compiled = await build({ bundle: true, write: false, outdir: 'harness-test-memory', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import HarnessPanel from './apps/web/src/creator/harness/HarnessPanel';
    const initial=${JSON.stringify(project)};
    function App(){const [project,setProject]=useState(initial),[count,setCount]=useState(0),[open,setOpen]=useState(true);
      return <main><p id="editor-name">{project.name}</p><p id="undo-count">{count}</p>
      <button onClick={()=>setProject({...initial,name:'Edited while running'})}>Edit current document</button>
      <button onClick={()=>{setProject(initial);setCount(0)}}>Undo fixture edit</button>
      <button onClick={()=>setOpen(false)}>Close lab</button>
      {open&&<HarnessPanel currentProject={project} onApply={(next,base)=>{window.appliedBase=base;setProject(next);setCount(n=>n+1)}}/>}</main>;
    }createRoot(document.getElementById('root')).render(<App/>);` } });
  const script = compiled.outputFiles.find(file => file.path.endsWith('.js'))!.text;
  const css = compiled.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
  server = createServer(async (req, res) => {
    const path = req.url ?? '/';
    if (!path.startsWith('/api/')) { res.setHeader('Content-Type', path === '/bundle.js' ? 'text/javascript' : 'text/html'); res.end(path === '/bundle.js' ? script : `<html><head><style>body{margin:8px;font:14px sans-serif}main{max-width:960px;margin:auto}button{padding:8px}${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    requests.push({ path, body }); res.setHeader('Content-Type', 'application/json');
    if (path.endsWith('/preflight')) { const human = body.domain === 'human-character'; res.end(JSON.stringify({ ok: true, preflight: { status: human ? 'blocked' : 'ready', blockers: human ? ['Missing path, grouping and pivot capabilities.'] : [], artisticReview: 'not_reviewed', modelCalls: 0, callBudget: 7 } })); return; }
    if (path.endsWith('/harness/jobs')) { task = { provider: body.provider, brief: body.brief, domain: body.domain }; res.statusCode = 202; }
    res.end(JSON.stringify({ ok: true, job: { id: 'fixture1', provider: task.provider, kind: 'harness', status: path.endsWith('/cancel') ? 'cancelled' : path.endsWith('/harness/jobs') || scenario === 'running' ? 'running' : 'succeeded', report: scenario === 'malformed' ? {} : report() } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No fixture port'); origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 30000);
beforeEach(async () => { if (page) await page.close(); requests = []; scenario = 'success'; task = {}; page = await browser.newPage(); page.setDefaultTimeout(2000); await page.goto(origin); await page.getByRole('textbox', { name: 'Harness brief' }).waitFor(); });
afterAll(async () => { await browser?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); });
async function check() { await page.getByRole('textbox', { name: 'Harness brief' }).fill('A compact circle settles.'); await page.getByRole('button', { name: 'Check capabilities', exact: true }).click(); await page.getByRole('checkbox').check(); }
async function run() { await check(); await page.getByRole('button', { name: 'Run seven-stage harness', exact: true }).click(); }
it('uses explicit zero-call checks, invalidates consent on every control and blocks the human domain', async () => {
  expect(requests).toEqual([]); await check(); expect(requests.map(request => request.path)).toEqual(['/api/ai/harness/preflight']);
  for (const name of ['Harness provider', 'Harness domain', 'Harness target size']) {
    const control = page.getByRole('combobox', { name });
    await control.selectOption(name === 'Harness provider' ? 'claude' : name === 'Harness domain' ? 'human-character' : '128');
    expect(await page.getByRole('checkbox').isChecked()).toBe(false);
    expect(await page.getByRole('button', { name: 'Run seven-stage harness' }).isDisabled()).toBe(true);
    await page.getByRole('button', { name: 'Check capabilities', exact: true }).click();
    if (name === 'Harness domain') { await page.getByText('Capabilities blocked · 0 model calls').waitFor(); expect(await page.getByRole('checkbox').isDisabled()).toBe(true); await control.selectOption('ui-motion'); await page.getByRole('button', { name: 'Check capabilities', exact: true }).click(); }
    await page.getByRole('checkbox').check();
  }
  await page.getByRole('textbox', { name: 'Harness brief' }).fill('Changed brief.');
  expect(await page.getByRole('checkbox').isChecked()).toBe(false);
  expect(requests.some(request => request.path.endsWith('/harness/jobs'))).toBe(false);
}, 15000);
it('renders real paused previews, manual candidates, escaped guidance, deltas and a local JSON download', async () => {
  await run(); const candidates = page.getByRole('combobox', { name: 'Candidate stage' }); await candidates.waitFor();
  expect(await candidates.inputValue()).toBe('base');
  expect(await page.getByRole('button', { name: 'Apply reviewed candidate' }).isDisabled()).toBe(true); // semantic no-op
  await candidates.selectOption('probe-domain');
  await page.getByTestId('ai-proposal-preview').locator('svg').waitFor();
  expect(await page.getByRole('button', { name: 'Play proposal', exact: true }).count()).toBe(1);
  expect(await page.locator('.cr-harness script,.cr-harness img').count()).toBe(0);
  expect(await page.getByText('<script>window.untrusted=true</script>', { exact: true }).count()).toBeGreaterThan(0);
  expect(await page.getByText('Changes from editor at submission', { exact: true }).count()).toBe(1);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download review report' }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('harness-review.json');
  const stream = await download.createReadStream(); if (!stream) throw new Error('Missing local report download');
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const localReport = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(localReport).toMatchObject({ schemaVersion: 1, modelCalls: 7, callBudget: 7, artisticReview: 'not_reviewed' });
  expect(localReport).not.toHaveProperty('baseProject');
  expect(requests.filter(request => request.path.endsWith('/harness/jobs'))).toHaveLength(1);
  expect(Object.keys(requests.find(request => request.path.endsWith('/harness/jobs'))!.body).sort()).toEqual(['brief', 'callBudget', 'consent', 'domain', 'provider']);
  await page.getByRole('button', { name: 'Apply reviewed candidate' }).click();
  expect(await page.locator('#editor-name').textContent()).toBe('probe-domain'); expect(await page.locator('#undo-count').textContent()).toBe('1');
  await page.getByRole('button', { name: 'Undo fixture edit' }).click(); expect(await page.locator('#editor-name').textContent()).toBe('Editor stays local');
}, 15000);
it('keeps desktop and 390/320px layouts readable and honors reduced motion with the real Lottie preview', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await run(); await page.getByRole('combobox', { name: 'Candidate stage' }).waitFor();
  await page.getByRole('combobox', { name: 'Proposal size' }).selectOption('512');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const measurements = await page.locator('.cr-harness').evaluate(element => {
      const controls = [...element.querySelectorAll('button,select,textarea')].filter(control => control.getBoundingClientRect().height > 0);
      const note = element.querySelector('.cr-ai-note')!;
      const luminance = (color: string) => {
        const channels = color.match(/[0-9.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const foreground = luminance(getComputedStyle(note).color), background = luminance(getComputedStyle(element).backgroundColor);
      return { overflow: document.documentElement.scrollWidth > window.innerWidth, minHeight: Math.min(...controls.map(control => control.getBoundingClientRect().height)), fieldOverflow: controls.some(control => control.getBoundingClientRect().right > window.innerWidth), noteSize: parseFloat(getComputedStyle(note).fontSize), contrast: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) };
    });
    expect(measurements, `${width}px layout`).toMatchObject({ overflow: false, fieldOverflow: false });
    expect(measurements.minHeight).toBeGreaterThanOrEqual(44);
    expect(measurements.noteSize).toBeGreaterThanOrEqual(12);
    expect(measurements.contrast).toBeGreaterThanOrEqual(4.5);
  }
  expect(await page.getByRole('button', { name: 'Play proposal', exact: true }).isDisabled()).toBe(true);
  await page.getByRole('spinbutton', { name: 'Proposal frame', exact: true }).fill('5');
  expect(await page.getByTestId('ai-proposal-preview').locator('svg').count()).toBe(1);
  expect(await page.getByRole('spinbutton', { name: 'Proposal frame', exact: true }).inputValue()).toBe('5');
}, 15000);
it('disables stale adoption, cancels on close and preserves the editor on malformed output', async () => {
  await run(); await page.getByRole('combobox', { name: 'Candidate stage' }).selectOption('final');
  await page.getByRole('button', { name: 'Edit current document' }).click();
  expect(await page.getByRole('button', { name: 'Apply reviewed candidate' }).isDisabled()).toBe(true);
  expect(await page.locator('#undo-count').textContent()).toBe('0');
  await page.reload(); scenario = 'running'; await run(); await page.getByRole('button', { name: 'Cancel harness' }).waitFor();
  await page.getByRole('button', { name: 'Close lab' }).click();
  await page.waitForFunction(() => !document.querySelector('.cr-harness'));
  await new Promise(resolve => setTimeout(resolve, 50)); expect(requests.some(request => request.path.endsWith('/cancel'))).toBe(true);
  await page.reload(); scenario = 'malformed'; await run();
  await page.getByText(/could not finish this review/).waitFor();
  expect(await page.getByRole('button', { name: 'Apply reviewed candidate' }).count()).toBe(0); expect(await page.locator('#undo-count').textContent()).toBe('0');
}, 15000);
