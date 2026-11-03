import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseProjectV2, exportLottieV2, worldMatricesV2 } from '../packages/creator-core/src/v2';
import { mountLottie, seekLottie } from './player-fixture';

test('v2 technical fixture: cubic paths, animated parent chain and static pivot agree with independent light player on reverse seeks', async ({ page }, info) => {
  const project = parseProjectV2(await readFile('fixtures/creator-v2-articulated-curve.json', 'utf8'));
  const animation = exportLottieV2(project);
  await mountLottie(page, animation);
  const targets = [
    { id: 'lower-curve', attribute: 'stroke', color: 'rgb(215,154,78)' },
    { id: 'pivot-tip', attribute: 'fill', color: 'rgb(196,107,87)' },
  ];
  for (const frame of [0, 60, 15, 119, 30, 0]) {
    await seekLottie(page, frame);
    const expected = worldMatricesV2(project, frame);
    for (const target of targets) {
      const actual = await page.locator('#independent').evaluate((element, query) => {
        const svg = element.querySelector('svg');
        const shape = [...element.querySelectorAll('path')].find(path => path.getAttribute(query.attribute)?.replace(/\s/g, '') === query.color);
        if (!svg || !shape) throw Error('Missing independent SVG geometry.');
        const root = svg.getCTM(), matrix = shape.getCTM();
        if (!root || !matrix) throw Error('Missing independent SVG matrix.');
        const normalized = root.inverse().multiply(matrix);
        return [normalized.a, normalized.b, normalized.c, normalized.d, normalized.e, normalized.f];
      }, target);
      const matrix = expected.get(target.id);
      expect(matrix).toBeDefined();
      actual.forEach((value, index) => expect(Math.abs(value - matrix![index])).toBeLessThan(0.08));
    }
  }
  await page.screenshot({ path: info.outputPath('independent-v2-technical-proof.png') });
});

test('v1 creator rejects a v2 rig file without changing the current document or its Undo', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Add rectangle', exact: true }).click();
  await page.getByLabel('Project file', { exact: true }).setInputFiles('fixtures/creator-v2-articulated-curve.json');
  await expect(page.getByRole('alert')).toContainText('version');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Untitled motion');
  await expect(page.getByRole('button', { name: 'Select Rectangle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select Rectangle', exact: true })).toHaveCount(0);
});
