import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { startNativeHarnessFixture } from './native-harness-fixture';
import { mountLottie, seekLottie, hasTranslation } from './player-fixture';
import { exportLottie, parseProject } from '../packages/creator-core/src';

// Opt-in native Rust integration. All provider responses come from an explicit protocol
// executable under an empty PATH/disposable HOME; none of these tests run real AI.
test.describe('native Harness² app protocol fixture (not inference)', () => {
  test.skip(process.env.MORO_NATIVE_HARNESS_E2E !== '1', 'Build Rust bridge + fixture and opt in with MORO_NATIVE_HARNESS_E2E=1.');
  test('preflight/consent/budget/human gates, native review and independent export/Undo', async ({ page, context }, info) => {
    // Trace proved native review + Apply/save/export completed; a loaded host hit
    // the former 30s whole-test deadline while opening the independent player.
    // Keep every assertion/provider-stage limit, but budget this multi-flow case separately.
    test.setTimeout(90_000);
    const native = await startNativeHarnessFixture(info);
    try {
      const headers = { 'X-Moro-Request': '1' };
      const task = { provider: 'codex', domain: 'ui-motion', brief: 'A compact settling dot. Protocol fixture only.' };
      const pre = await context.request.post(`${native.origin}/api/ai/harness/preflight`, { headers, data: task });
      expect(pre.status()).toBe(200);
      expect((await pre.json()).preflight).toMatchObject({ status: 'ready', modelCalls: 0, callBudget: 7 });
      for (const data of [task, { ...task, consent: false, callBudget: 7 }, { ...task, consent: true, callBudget: 8 }, { ...task, consent: true, callBudget: 7, baseProject: {} }]) {
        const rejected = await context.request.post(`${native.origin}/api/ai/harness/jobs`, { headers, data });
        expect(rejected.status()).toBe(400);
      }
      const human = await context.request.post(`${native.origin}/api/ai/harness/preflight`, { headers, data: { ...task, domain: 'human-character' } });
      expect((await human.json()).preflight).toMatchObject({ status: 'blocked', modelCalls: 0 });
      let creates = 0;
      page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ai/harness/jobs') creates++; });
      await page.goto(`${native.origin}/create`);
      await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
      await page.getByRole('button', { name: 'Quality lab', exact: true }).click();
      expect(creates).toBe(0);
      await page.getByRole('textbox', { name: 'Harness brief', exact: true }).fill(task.brief);
      await page.getByRole('button', { name: 'Check capabilities', exact: true }).click();
      const run = page.getByRole('button', { name: 'Run seven-stage harness', exact: true });
      await expect(run).toBeDisabled();
      expect(creates).toBe(0);
      await page.getByRole('checkbox', { name: /seven|7/ }).check();
      await expect(run).toBeEnabled();
      await run.click();
      const apply = page.getByRole('button', { name: 'Apply reviewed candidate', exact: true });
      await expect(apply).toBeEnabled({ timeout: 25000 });
      expect(creates).toBe(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Untitled motion');
      await expect(page.getByTestId('ai-proposal-preview').locator('svg')).toBeVisible();
      const candidates = page.getByRole('combobox', { name: 'Candidate stage', exact: true });
      await expect(candidates.locator('option')).toHaveCount(4);
      await candidates.selectOption('base');
      await candidates.selectOption('probe-domain');
      await candidates.selectOption('final');
      const reportDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download review report', exact: true }).click();
      const reportPath = info.outputPath('native-report.json');
      await (await reportDownload).saveAs(reportPath);
      const raw = JSON.parse(await readFile(reportPath, 'utf8'));
      const report = raw.report ?? raw;
      expect(report.status).toBe('review_required');
      expect(report.artisticReview).toBe('not_reviewed');
      expect(report.modelCalls).toBe(7);
      expect(report.stages).toHaveLength(7);
      for (const width of [390, 320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.screenshot({ path: info.outputPath('quality-lab-native-review.png'), fullPage: true });
      await apply.click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(report.project.name);
      const saving = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save project', exact: true }).click();
      const projectPath = info.outputPath('candidate.moro.json');
      await (await saving).saveAs(projectPath);
      const saved = parseProject(await readFile(projectPath, 'utf8'));
      expect(saved).toEqual(report.project);
      const exporting = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export Lottie', exact: true }).click();
      const animationPath = info.outputPath('candidate-animation.json');
      await (await exporting).saveAs(animationPath);
      const animation = JSON.parse(await readFile(animationPath, 'utf8'));
      expect(animation).toEqual(exportLottie(saved));
      const independent = await context.newPage();
      try {
        await mountLottie(independent, animation);
        for (const frame of [0, 60, 119]) {
          await seekLottie(independent, frame);
          expect(await hasTranslation(independent, '#independent', 256, 256)).toBe(true);
        }
      } finally { await independent.close(); }
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Untitled motion');
      await expect(page.getByRole('button', { name: 'Select Rectangle', exact: true })).toBeVisible();
    } finally { await native.stop(); }
  });
});
