import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('homepage loads real data, chart and explorer', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('生命体征');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('#all-plugins tbody tr').first()).toBeVisible();
  await expect(page.getByText('全部插件').first()).toBeVisible();
  await expect(page.getByText('20').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('search, sort, filters and clear work and are reflected in the URL', async ({ page }) => {
  await page.goto('/');
  const explorer = page.locator('#all-plugins');
  const search = explorer.getByRole('searchbox', { name: '搜索插件' });
  await search.fill('context');
  await expect(page).toHaveURL(/q=context/);
  await expect(explorer.locator('tbody tr').filter({ hasText: 'dsh-context' })).toHaveCount(1);
  await expect(explorer.locator('tbody tr').first()).toBeVisible();

  await explorer.getByRole('button', { name: '清除搜索' }).click();
  await expect(page).not.toHaveURL(/q=/);

  await explorer.getByLabel('排序方式').selectOption('maintenance');
  await expect(page).toHaveURL(/sort=maintenance/);

  await explorer.getByLabel('按下载数据可用性筛选').selectOption('missing');
  await expect(page).toHaveURL(/downloads=missing/);
  await expect(explorer.getByText('已筛选', { exact: false })).toBeVisible();
  await expect(explorer.locator('tbody tr')).toHaveCount(2);
  await explorer.getByRole('button', { name: /清除 \d+ 项/ }).click();
  await expect(page).not.toHaveURL(/downloads=missing/);
});

test('plugin detail explains scores, metrics and sources', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/plugins/bowenliang123-dsh-context');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('dsh-context');
  await expect(page.getByText('人气指数').first()).toBeVisible();
  await expect(page.getByText('维护健康度').first()).toBeVisible();
  await expect(page.getByText('数据来源与采集时间').first()).toBeVisible();
  await page.getByRole('button', { name: /为什么是这个人气指数/ }).click();
  await expect(page.getByText('证据覆盖').first()).toBeVisible();
  await expect(page.getByText('原始值').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('missing npm data does not crash the detail page', async ({ page }) => {
  await page.goto('/plugins/toolclub-dsh-agent-team-gui');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('dsh-agent-team-gui');
  await expect(page.getByText('暂无可靠 npm 下载数据').first()).toBeVisible();
  await expect(page.getByText('未完成漏洞检查').first()).toBeVisible();
  await expect(page.getByText('风险信息不完整').first()).toBeVisible();
});

test('compare page aligns two plugins and marks unavailable metrics', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/compare?a=dsh-market-dsh-market&b=michengai-dsh-agency-agents');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('并排比较');
  await expect(page.getByText('指标对照')).toBeVisible();
  await expect(page.getByRole('table').last()).toContainText('数据完整程度');
  await expect(page.getByText('不会基于单一指标')).toBeVisible();
  await expect(page.getByRole('button', { name: '交换两侧插件' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('quadrant filters points without changing the fixed axes', async ({ page }) => {
  await page.goto('/quadrant');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('四象限');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: /高人气 · 健康/ }).click();
  await expect(page.getByText('高人气 · 健康').first()).toBeVisible();
  await expect(page.getByText('固定 0–100 轴，筛选不会重新缩放')).toBeVisible();
});

test('mobile layout has no horizontal overflow and exposes navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const mobileNav = page.locator('#mobile-nav');
  await expect(mobileNav.getByRole('link', { name: '四象限' })).toBeVisible();
  await mobileNav.getByRole('link', { name: '四象限' }).click();
  await expect(page).toHaveURL(/\/quadrant$/);

  await page.goto('/compare?a=dsh-market-dsh-market&b=michengai-dsh-agency-agents');
  const compareOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(compareOverflow).toBeLessThanOrEqual(1);
  await expect(page.getByText(/A · dsh-market/i).first()).toBeVisible();
  await expect(page.getByText(/B · dsh-agency-agents/i).first()).toBeVisible();
});

test('quadrant page and tablet home do not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/quadrant');
  await expect(page.locator('canvas')).toHaveCount(1);
  const quadrantOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(quadrantOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await expect(page.locator('#all-plugins tbody tr').first()).toBeVisible();
  const homeOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(homeOverflow).toBeLessThanOrEqual(1);
});

test('a failed refresh keeps the previous snapshot visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#all-plugins tbody tr').first()).toBeVisible();
  await page.route('**/data/latest.json*', (route) =>
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'offline' }),
  );
  await page.getByRole('button', { name: '重新加载数据快照' }).click();
  await expect(page.getByText('刷新失败，继续展示上次成功加载的快照。')).toBeVisible();
  await expect(page.locator('#all-plugins tbody tr').first()).toBeVisible();
});

test('data fetch failure renders an error state with recovery help', async ({ page }) => {
  await page.route('**/data/latest.json*', (route) =>
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'offline' }),
  );
  await page.goto('/');
  await expect(page.getByText('数据快照无法加载')).toBeVisible();
  await expect(page.getByText('npm run data:pull')).toBeVisible();
});
