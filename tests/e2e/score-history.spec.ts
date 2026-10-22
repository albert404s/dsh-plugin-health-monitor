import { expect, test } from '@playwright/test';

test('old score snapshots remain visible and A → B → A is rendered as three disconnected method runs', async ({ page }) => {
  const latest = await (await page.request.get('/data/latest.json')).json();
  const plugin = latest.plugins[0];
  const methods = ['1.1.0', '1.1.0', '2.0.0', '2.0.0', '1.1.0', '1.1.0'];
  const points = methods.map((methodVersion, index) => ({
    t: new Date(Date.parse(latest.generatedAt) - (methods.length - index - 1) * 12 * 3600000).toISOString(),
    methodVersion, stars: plugin.github.stars, downloads: plugin.npm.downloads30d,
    popularity: 20 + index, maintenance: 40 + index, riskLevel: 'low',
    commits30d: plugin.github.commits30d, issuesOpened90d: plugin.github.issues.opened90d,
    issuesClosed90d: plugin.github.issues.closed90d, prsOpened90d: plugin.github.pullRequests.opened90d,
    prsMerged90d: plugin.github.pullRequests.merged90d,
    releaseAt: plugin.github.latestRelease?.publishedAt ?? null, archived: false,
  }));
  await page.route('**/data/history.json', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ schemaVersion: 1, updatedAt: latest.generatedAt, retentionDays: 90, plugins: { [plugin.id]: points } }),
  }));
  await page.goto('/plugins/' + plugin.id);
  const chart = page.getByRole('img', { name: /插件关注度与维护活跃度历史趋势/ });
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toBeVisible();
  await expect(page.getByText('6 个真实快照', { exact: true })).toBeVisible();
  const series = await chart.evaluate(async element => {
    // Read the chart through its public instance API to verify its real line data.
    const moduleUrl = '/src/components/charts/echarts.ts';
    const { echarts } = await import(moduleUrl);
    const option = echarts.getInstanceByDom(element)?.getOption();
    return option?.series?.map((item: { name: string; data: Array<number | null>; connectNulls: boolean }) => ({
      name: item.name, data: item.data, connectNulls: item.connectNulls,
    }));
  });
  expect(series).toHaveLength(6);
  expect(series.filter((item: { name: string }) => item.name === '维护活跃度').map((item: { data: Array<number | null> }) => item.data))
    .toEqual([[40, 41, null, null, null, null], [null, null, 42, 43, null, null], [null, null, null, null, 44, 45]]);
  expect(series.every((item: { connectNulls: boolean }) => item.connectNulls === false)).toBe(true);
});
