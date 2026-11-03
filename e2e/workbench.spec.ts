import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const color = (page: Page) => page.getByRole('textbox', { name: 'Color 1 HEX', exact: true });
const edited = (page: Page) => page.getByRole('img', { name: 'Edited animation', exact: true });
async function ready(page: Page) {
  await page.goto('/');
  await expect(color(page)).toBeVisible();
  await expect(edited(page).locator('svg')).toBeVisible();
}
async function staticPreview(page: Page) {
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.isVisible()) await pause.click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}
async function hasPaint(page: Page, label: string, hex: string) {
  const rgb = hex.match(/[0-9a-f]{2}/gi)!.map(value => parseInt(value, 16));
  return page.getByRole('img', { name: label, exact: true }).locator('svg').evaluate((svg, channels) =>
    [...svg.querySelectorAll('[fill], [stroke]')].some(element => ['fill', 'stroke'].some(property => {
      const value = getComputedStyle(element).getPropertyValue(property);
      return value.replace(/\s/g, '') === `rgb(${channels.join(',')})`;
    })), rgb);
}

test('baseline: edit, compare, undo/redo and actual JSON download/reimport', async ({ page }, testInfo) => {
  await ready(page);
  await staticPreview(page);
  const original = await color(page).inputValue();
  const replacement = '#C4242A';
  expect(original).not.toBe(replacement);
  await color(page).fill(replacement);
  await color(page).press('Enter');
  await expect(color(page)).toHaveValue(replacement);
  await expect.poll(() => hasPaint(page, 'Edited animation', replacement)).toBe(true);
  await page.getByRole('switch', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Compare', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => hasPaint(page, 'Original animation', original)).toBe(true);
  await expect.poll(() => hasPaint(page, 'Original animation', replacement)).toBe(false);
  const transforms = (label: string) => page.getByRole('img', { name: label, exact: true }).locator('svg [transform]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  // Newly mounted Original needs its first player synchronization frame.
  await expect.poll(async () => JSON.stringify(await transforms('Edited animation')) === JSON.stringify(await transforms('Original animation'))).toBe(true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(color(page)).toHaveValue(original);
  await expect.poll(() => hasPaint(page, 'Edited animation', original)).toBe(true);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(color(page)).toHaveValue(replacement);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/\.moro\.json$/);
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const exported = JSON.parse(await readFile(path, 'utf8'));
  expect(exported.layers.length).toBeGreaterThan(0);
  expect(exported.fr).toBeGreaterThan(0);
  const targetRgb = [196 / 255, 36 / 255, 42 / 255];
  const fills: number[][] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const node = value as { ty?: string; c?: { k?: number[] } };
    if ((node.ty === 'fl' || node.ty === 'st') && Array.isArray(node.c?.k)) fills.push(node.c.k.slice(0, 3));
    Object.values(value).forEach(visit);
  }
  visit(exported);
  expect(fills).toContainEqual(targetRgb);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Open Lottie JSON', { exact: true }).setInputFiles(path);
  await page.getByRole('button', { name: 'Replace animation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(download.suggestedFilename().replace(/\.json$/, ''));
  await expect(color(page)).toHaveValue(replacement);
  await expect(edited(page).locator('svg')).toBeVisible();
  await expect.poll(() => hasPaint(page, 'Edited animation', replacement)).toBe(true);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('baseline: expression import blocks preview and edited export without execution', async ({ page }) => {
  await ready(page);
  // A real sample supplies renderable structure; the expression is the only mutation.
  const response = await page.request.get('/samples/orbit.json');
  expect(response.ok()).toBe(true);
  const fixture = await response.json();
  fixture.layers[0].ks.o.x = 'window.__moroExpressionExecuted = true; 100';
  await page.getByLabel('Open Lottie JSON', { exact: true }).setInputFiles({ name: 'blocked-expression.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('blocked-expression');
  await expect(page.getByText('Expressions are not supported.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await expect(edited(page)).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__moroExpressionExecuted'))).toBeUndefined();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download original', exact: true }).last()).toBeEnabled();
});

test('baseline: malformed import retains prior edited document and history', async ({ page }) => {
  await ready(page);
  const name = await page.getByRole('heading', { level: 1 }).textContent();
  await color(page).fill('#C4242A');
  await color(page).press('Enter');
  await page.getByLabel('Open Lottie JSON', { exact: true }).setInputFiles({ name: 'malformed.json', mimeType: 'application/json', buffer: Buffer.from('{"layers": [') });
  await page.getByRole('button', { name: 'Replace animation', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not read this JSON.');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name!);
  await expect(color(page)).toHaveValue('#C4242A');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await expect(edited(page).locator('svg')).toBeVisible();
});

test('baseline: mobile keyboard picker cancel restores color/focus with no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const initial = await color(page).inputValue();
  const swatch = page.getByRole('button', { name: 'Choose color 1', exact: true });
  await swatch.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const picker = page.getByRole('textbox', { name: 'Picker HEX', exact: true });
  await picker.fill('#C4242A');
  await picker.press('Enter');
  // Escape on the modal (not the field's own cancel handler) cancels the transaction.
  await page.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(color(page)).toHaveValue(initial);
  await expect(swatch).toBeFocused();
  await expect(page.getByRole('button', { name: 'Reset colors', exact: true })).toBeDisabled();
  await swatch.press('Enter');
  await picker.fill('#223344');
  await picker.press('Enter');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(color(page)).toHaveValue(initial);
  await expect(swatch).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('switch', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Compare version', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('baseline: reduced motion initially pauses and explicit keyboard play works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  const frame = page.getByRole('slider', { name: 'Animation frame', exact: true });
  await expect(frame).toHaveValue('0');
  // Observe several actual animation frames rather than trusting the button label alone.
  const observed = await frame.evaluate(async input => {
    const values: string[] = [];
    for (let index = 0; index < 12; index++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      values.push((input as HTMLInputElement).value);
    }
    return values;
  });
  expect(new Set(observed)).toEqual(new Set(['0']));
  await play.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(frame).not.toHaveValue('0');
});
