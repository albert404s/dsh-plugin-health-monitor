import { expect, test } from '@playwright/test';
import type { LatestData } from '../../src/lib/types';

test('ranking limit follows sorting, paginates only the shortlist and restores browser history', async ({ page }) => {
  await page.goto('/plugins');
  const explorer = page.locator('#all-plugins');
  const snapshot: LatestData = await (await page.request.get('/data/latest.json')).json();
  const expected = [...snapshot.plugins].sort((a, b) => b.github.stars - a.github.stars || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 10);
  await explorer.getByLabel('排序方式').selectOption('stars');
  await page.evaluate(() => scrollTo(0, 250));
  const scrollBefore = await page.evaluate(() => scrollY);
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('10');
  expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThan(5);
  await expect(page).toHaveURL(/sort=stars&top=10/);
  await expect(explorer.locator('tbody tr')).toHaveCount(8);
  await expect(explorer.locator('tbody tr').first()).toContainText(expected[0].name);
  await explorer.getByRole('button', { name: '下一页' }).click();
  await expect(explorer.locator('tbody tr')).toHaveCount(2);
  await expect(explorer.locator('tbody tr').first()).toContainText(expected[8].name);
  await expect(explorer.getByRole('navigation', { name: '插件列表分页' })).toContainText('第 2 / 2 页 · 共 10 个结果');
  await page.reload();
  await expect(explorer.getByLabel('展示数量', { exact: true })).toHaveValue('10');
  await expect(explorer.locator('tbody tr')).toHaveCount(2);
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('100');
  await expect(page).not.toHaveURL(/page=2/);
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText(`展示 ${snapshot.plugins.length} 个`);
  await expect(explorer.getByTestId('ranking-shortfall')).toContainText(`全库已收录 ${snapshot.plugins.length} 个，目标前 100 个需先扩充收录。`);
  await page.goBack();
  await expect(explorer.getByLabel('展示数量', { exact: true })).toHaveValue('10');
  await expect(explorer.locator('tbody tr')).toHaveCount(2);
});

test('custom limit applies after category filtering and does not discard comparison selections', async ({ page }) => {
  await page.goto('/plugins?sort=stars');
  const explorer = page.locator('#all-plugins');
  await explorer.locator('table input[type="checkbox"]').nth(7).check();
  const comparison = page.getByRole('complementary', { name: '对比选择' });
  await expect(comparison).toContainText('已选 1/2');
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('custom');
  await explorer.getByLabel('自定义展示数量').fill('1');
  await explorer.getByRole('button', { name: '应用数量' }).click();
  await expect(explorer.locator('tbody tr')).toHaveCount(1);
  await expect(explorer.locator('table input[type="checkbox"]:checked')).toHaveCount(0);
  await expect(comparison).toContainText('已选 1/2');
  const snapshot: LatestData = await (await page.request.get('/data/latest.json')).json();
  const originalTopCategory = [...snapshot.plugins].sort((a, b) => b.github.stars - a.github.stars)[0].category;
  const otherCategory = snapshot.plugins.find(plugin => plugin.category !== originalTopCategory)!.category;
  const expected = snapshot.plugins.filter(plugin => plugin.category === otherCategory).sort((a, b) => b.github.stars - a.github.stars)[0];
  await explorer.getByLabel('按分类筛选').selectOption(otherCategory);
  await expect(explorer.locator('tbody tr')).toHaveCount(1);
  await expect(explorer.locator('tbody tr').first()).toContainText(expected.name);
  await expect(page).toHaveURL(/top=1/);
  await explorer.getByRole('button', { name: '移除筛选：展示：最多前 1 个' }).click();
  await expect(page).not.toHaveURL(/top=/);
  await expect(explorer.getByLabel('按分类筛选')).toHaveValue(otherCategory);
  await expect(comparison).toContainText('已选 1/2');
});

test('invalid top links recover to all results and a large valid top never invents entries', async ({ page }) => {
  const explorer = page.locator('#all-plugins');
  for (const top of ['-1', '0', '1.5', '1001', 'oops']) {
    await page.goto('/plugins?top=' + top);
    await expect(explorer.getByLabel('展示数量', { exact: true })).toHaveValue('all');
    await expect(explorer.getByRole('button', { name: '下一页' })).toBeEnabled();
  }
  await page.goto('/plugins?top=1000&sort=downloads');
  const snapshot: LatestData = await (await page.request.get('/data/latest.json')).json();
  await expect(explorer.getByLabel('展示数量', { exact: true })).toHaveValue('custom');
  await expect(explorer.getByLabel('自定义展示数量')).toHaveValue('1000');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText(`展示 ${snapshot.plugins.length} 个`);
  await expect(explorer.getByTestId('ranking-shortfall')).toContainText(`全库已收录 ${snapshot.plugins.length} 个，目标前 1000 个需先扩充收录。`);
  const pages = Math.ceil(snapshot.plugins.length / 8);
  for(let current=1;current<pages;current++) {
    await explorer.getByRole('button', { name: '下一页' }).click();
    await expect(explorer.getByRole('navigation', { name: '插件列表分页' })).toContainText('第 '+(current+1)+' / '+pages+' 页');
  }
  await expect(explorer.getByRole('button', { name: '下一页' })).toBeDisabled();
  await expect(explorer.locator('tbody tr')).toHaveCount(snapshot.plugins.length % 8 || 8);
});

test('mobile ranking settings support keyboard submission and stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/plugins');
  const explorer = page.locator('#all-plugins');
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('custom');
  const count = explorer.getByLabel('自定义展示数量');
  await count.fill('3');
  await count.press('Enter');
  await expect(page).toHaveURL(/top=3/);
  await expect(explorer.locator('[data-testid="plugin-card"]')).toHaveCount(3);
  await explorer.getByLabel('排序方式').selectOption('name');
  await page.reload();
  await expect(count).toHaveValue('3');
  await expect(explorer.getByLabel('排序方式')).toHaveValue('name');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
