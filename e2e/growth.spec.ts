import { expect, test } from '@playwright/test';

test('growth: palette presets apply as one undoable edit', async ({ page }) => {
  await page.goto('/');
  const colors = page.getByRole('textbox', { name: /^Color \d+ HEX$/ });
  await expect(colors.first()).toBeVisible();
  const original = await colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
  const presets = page.getByRole('group', { name: 'Palette presets', exact: true });
  await expect(presets).toBeVisible();
  await presets.getByRole('button', { name: 'Lagoon', exact: true }).click();
  await expect.poll(() => colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).not.toEqual(original);
  const lagoon = await colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(original);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(lagoon);
  await presets.getByRole('button', { name: 'Ember', exact: true }).click();
  await expect.poll(() => colors.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).not.toEqual(lagoon);
});

test('growth: Parcel dispatch is the first and initially loaded showcase', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Samples', exact: true }).getByRole('button').first()).toHaveAccessibleName(/^Parcel dispatch/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Parcel dispatch');
  await expect(page.getByRole('img', { name: 'Edited animation', exact: true }).locator('svg')).toBeVisible();
});

test('growth: GitHub link targets the actual source repository', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /GitHub/i }).first()).toHaveAttribute('href', 'https://github.com/kimyoungwopo/moro');
});
