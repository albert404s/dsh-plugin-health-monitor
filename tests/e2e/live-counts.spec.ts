import { expect, test, type Page } from '@playwright/test';
import type { LatestData } from '../../src/lib/types';
import { computeStats, hasQuadrantData } from '../../src/lib/scoring';
import { formatCompact } from '../../src/lib/format';

// Synthetic records are intercepted in the browser only, never written to published data.
function snapshotWithCount(source: LatestData, count: number): LatestData {
  const snapshot = structuredClone(source);
  const template = source.plugins.find(plugin => plugin.npm.status === 'verified' && hasQuadrantData(plugin))!;
  snapshot.plugins = Array.from({ length: count }, (_, index) => {
    const plugin = structuredClone(template);
    const repo = `fixture-owner/plugin-${index + 1}`;
    plugin.id = `fixture-plugin-${index + 1}`;
    plugin.name = `测试插件 ${String(index + 1).padStart(3, '0')}`;
    plugin.repo = repo;
    plugin.repository.fullName = repo;
    plugin.repository.url = `https://github.com/${repo}`;
    plugin.repository.description = '仅用于浏览器验收的合成记录';
    plugin.npm.repositoryUrl = plugin.repository.url;
    plugin.npm.packageName = `fixture-package-${index + 1}`;
    plugin.security.packageName = plugin.npm.packageName;
    plugin.github.stars = (index + 1) * 11;
    plugin.npm.downloads30d = (index + 1) * 1000;
    plugin.category = index % 2 ? 'development' : 'productivity';
    return plugin;
  });
  snapshot.runId = `fixture-${count}`;
  snapshot.stats = computeStats(snapshot.plugins);
  return snapshot;
}

async function expectOverview(page: Page, snapshot: LatestData): Promise<void> {
  await expect(page.getByTestId('stats-plugin-count')).toHaveText(String(snapshot.plugins.length));
  await expect(page.getByTestId('stats-total-stars')).toHaveText(formatCompact(snapshot.stats.totalStars));
  await expect(page.getByTestId('stats-total-stars')).toHaveAttribute('title', `${snapshot.stats.totalStars} stars`);
  await expect(page.getByTestId('stats-total-downloads')).toHaveText(formatCompact(snapshot.stats.totalDownloads));
  await expect(page.getByTestId('stats-complete-count')).toHaveText(String(snapshot.stats.completeDataCount));
  await expect(page.getByLabel(`已定位 ${snapshot.plugins.filter(hasQuadrantData).length} 个，全库 ${snapshot.plugins.length} 个`)).toBeVisible();
}

test('a new 50-plugin snapshot updates overview totals, charts and filtered ranking together', async ({ page }) => {
  const source: LatestData = await (await page.request.get('/data/latest.json')).json();
  let snapshot = snapshotWithCount(source, 20);
  await page.route('**/data/latest.json*', route => route.fulfill({ json: snapshot }));
  await page.goto('/');
  await expectOverview(page, snapshot);
  snapshot = snapshotWithCount(source, 50);
  await page.getByRole('button', { name: '重新加载数据快照' }).click();
  await expectOverview(page, snapshot);
  await page.getByRole('link', { name: '探索插件库', exact: false }).click();
  const explorer = page.locator('#all-plugins');
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('50');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toHaveText('展示 50 个· 匹配 50 个 · 全库 50 个');
  await expect(explorer.getByRole('navigation', { name: '插件列表分页' })).toContainText('第 1 / 7 页 · 共 50 个结果');
  await explorer.getByLabel('按分类筛选').selectOption('development');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('展示 25 个');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('匹配 25 个 · 全库 50 个');
  await expect(explorer.getByTestId('ranking-shortfall')).toHaveText('当前筛选仅匹配 25 个，已全部展示。');
  await explorer.getByLabel('展示数量', { exact: true }).selectOption('10');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('展示 10 个');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('匹配 25 个 · 全库 50 个');
  await page.goto('/ecosystem');
  await expect(page.getByRole('complementary', { name: '当前视图插件列表' }).locator('ul button')).toHaveCount(50);
});

test('a target of 100 does not invent records and links directly to collection settings', async ({ page }) => {
  const source: LatestData = await (await page.request.get('/data/latest.json')).json();
  const snapshot = snapshotWithCount(source, 20);
  await page.route('**/data/latest.json*', route => route.fulfill({ json: snapshot }));
  await page.goto('/plugins?top=100&sort=stars');
  const explorer = page.locator('#all-plugins');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('展示 20 个');
  await expect(explorer.getByRole('status', { name: '榜单数量' })).toContainText('匹配 20 个 · 全库 20 个');
  await expect(explorer.getByTestId('ranking-shortfall')).toHaveText('全库已收录 20 个，目标前 100 个需先扩充收录。');
  await explorer.getByRole('link', { name: '扩充收录与更新' }).click();
  await expect(page.getByRole('dialog', { name: '数据更新', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/top=100&sort=stars#collection-controls$/);
});

test('published data refreshes every minute in the foreground and pauses while hidden', async ({ page }) => {
  const source: LatestData = await (await page.request.get('/data/latest.json')).json();
  let snapshot = snapshotWithCount(source, 20);
  let checks = 0;
  await page.route('**/data/latest.json*', route => { checks++; return route.fulfill({ json: snapshot }); });
  await page.clock.install();
  await page.goto('/');
  await expectOverview(page, snapshot);
  const initialChecks = checks;
  snapshot = snapshotWithCount(source, 50);
  await page.clock.fastForward(60_001);
  await expectOverview(page, snapshot);
  expect(checks).toBe(initialChecks + 1);
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  snapshot = snapshotWithCount(source, 60);
  await page.clock.fastForward(120_000);
  expect(checks).toBe(initialChecks + 1);
  await expect(page.getByTestId('stats-plugin-count')).toHaveText('50');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectOverview(page, snapshot);
  expect(checks).toBe(initialChecks + 2);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(checks).toBe(initialChecks + 2);
});
