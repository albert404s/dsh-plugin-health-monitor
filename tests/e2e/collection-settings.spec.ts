import { expect, test, type Page } from '@playwright/test';
const control={version:1,automaticPaused:true,updatedAt:'2026-10-22T01:00:00.000Z',updatedBy:'maintainer'};
const settings={version:1,maxPlugins:100,maxRequests:600,githubReserve:100,updatedAt:null,updatedBy:null};
async function state(page:Page) {
 await page.route('**/data/collection-control.json', route=>route.fulfill({json:control}));
 await page.route('**/data/collection-settings.json',route=>route.fulfill({json:settings}));
 await page.route('**/data/collection-report.json',route=>route.fulfill({json:null}));
}
test('collection settings are separate from ranking and invalid values cannot be submitted',async({page})=>{
 await state(page);await page.goto('/#collection-controls');
 const dialog=page.getByRole('dialog',{name:'数据更新',exact:true});
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
 await expect(dialog.getByLabel('收录目标')).toHaveValue('20');
 await dialog.getByLabel('收录目标').fill('50');
 await dialog.locator('summary').filter({hasText:'采集范围与预算'}).click();
 await expect(dialog.getByLabel('每轮最多采集')).toHaveValue('100');
 await dialog.getByLabel('每轮最多采集').fill('50');
 await dialog.getByLabel('每轮请求上限').fill('300');
 await dialog.getByLabel('GitHub 预留额度').fill('80');
 await dialog.getByRole('button',{name:'准备保存采集设置'}).click();
 await expect(dialog.locator('code')).toHaveText('configure');
 await expect(dialog.locator('dl[aria-label="本次 GitHub 工作流参数"]')).toContainText('target_plugins50');
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
 await expect(dialog.getByRole('link',{name:'到 GitHub保存采集设置'})).toHaveAttribute('href',/actions\/workflows\/update-data.yml$/);
 await dialog.getByLabel('每轮请求上限').fill('0');
 await expect(dialog.getByRole('alert')).toContainText('请求预算');
 await expect(dialog.locator('a.btn-primary')).toHaveAttribute('aria-disabled','true');
});
test('refresh includes a real collection target and explains the difference from the published count',async({page})=>{
 await state(page);await page.goto('/#collection-controls');
 const dialog=page.getByRole('dialog',{name:'数据更新',exact:true});
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
 await dialog.getByLabel('收录目标').fill('50');
 await expect(dialog.locator('.orbit-collection-target')).toContainText('当前实际收录 20 个');
 await expect(dialog.locator('.orbit-collection-target')).toContainText('本次目标 50 个，将查找并核验更多 DSH 插件');
 await expect(dialog.locator('code')).toHaveText('refresh');
 const params=dialog.locator('dl[aria-label="本次 GitHub 工作流参数"]');
 await expect(params).toContainText('target_plugins50');
 await expect(params).toContainText('max_plugins100');
 await expect(params).toContainText('max_requests600');
 await expect(dialog.getByRole('link',{name:'到 GitHub更新数据'})).toHaveAttribute('href',/actions\/workflows\/update-data.yml$/);
 await dialog.getByLabel('收录目标').fill('0');
 await expect(dialog.getByRole('alert')).toContainText('收录目标');
 await expect(dialog.locator('a.btn-primary')).toHaveAttribute('aria-disabled','true');
 await dialog.getByLabel('收录目标').fill('50');
 await expect(dialog.locator('a.btn-primary')).not.toHaveAttribute('aria-disabled','true');
});
test('checking newly published data does not replace a collection target being edited',async({page})=>{
 await state(page);await page.goto('/#collection-controls');
 const dialog=page.getByRole('dialog',{name:'数据更新',exact:true});
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
 await dialog.getByLabel('收录目标').fill('50');
 await page.route('**/data/collection-settings.json',route=>route.fulfill({json:{...settings,targetPlugins:80}}));
 await dialog.getByRole('button',{name:'刷新已发布数据'}).click();
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
 await expect(dialog.getByLabel('收录目标')).toHaveValue('50');
 await expect(dialog.locator('dl[aria-label="本次 GitHub 工作流参数"]')).toContainText('target_plugins50');
});
test('run usage reflects an older preserved snapshot rather than claiming a fresh successful update',async({page})=>{
 await state(page);
 await page.route('**/data/collection-report.json',route=>route.fulfill({json:{
 version:1,startedAt:'2026-10-22T02:00:00.000Z',completedAt:'2026-10-22T02:01:00.000Z',
 configuredPlugins:100,selectedPlugins:50,completedPlugins:20,deferredPlugins:50,maxPlugins:50,maxRequests:300,githubReserve:80,
 requestsMade:300,memoryCacheHits:12,revalidatedCacheHits:30,persistentCacheHits:0,githubRemaining:120,githubResetAt:'2026-10-22T03:00:00.000Z',stopped:true,stopReason:'request_limit',
 discovery:{target:100,verified:20,added:0,candidatesChecked:15,reason:'本轮预算已用完，下次继续核验。'}
 }}));
 await page.goto('/#collection-controls');const dialog=page.getByRole('dialog',{name:'数据更新',exact:true});
 const summary=dialog.locator('summary').filter({hasText:'上次采集记录 · 300 次请求'});await summary.click();
 await expect(dialog).toContainText('本轮触及预算或平台限制，已保留上次有效快照。');
 await expect(dialog).toContainText('300 / 300');
 await expect(dialog).toContainText('未达到收录目标：已核验 20 个，目标 100 个。');
 await expect(dialog).toContainText('本轮预算已用完，下次继续核验。');
 await expect(dialog.getByRole('status')).toHaveText('仅手动采集');
});
test('historic method versions remain visible as separated points after a scoring upgrade',async({page})=>{
 await page.route('**/data/history.json',async route=>{
  const response=await route.fetch(),json=await response.json();
  const id='bowenliang123-dsh-context',base=json.plugins[id][0],end=Date.parse(json.updatedAt);
  json.plugins[id]=[{...base,t:new Date(end-3600000).toISOString(),methodVersion:'1.1.0'},{...base,t:new Date(end).toISOString(),methodVersion:'2.0.0'}];
  await route.fulfill({response,json});
 });
 await page.goto('/plugins/bowenliang123-dsh-context');
 await expect(page.getByRole('img',{name:'插件关注度与维护活跃度历史趋势，方法版本变化处断线'})).toBeVisible();
 await expect(page.locator('#trend')).toContainText('2 个真实快照');
});
