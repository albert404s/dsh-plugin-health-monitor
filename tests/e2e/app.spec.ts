import { chromium, expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}
const detail='/plugins/bowenliang123-dsh-context';
const compare='/compare?a=dsh-market-dsh-market&b=michengai-dsh-agency-agents';

test('overview shows real data, decorative fallback and the ecosystem chart', async({page})=>{
  const errors=trackErrors(page); await page.goto('/');
  await expect(page.locator('#home-title')).toContainText('发现好插件');
  await expect(page.getByRole('img',{name:/DSH 插件关注度/})).toBeVisible();
  await expect(page.getByText('已核验插件',{exact:true})).toBeVisible();
  await page.getByLabel('搜索插件名称、功能或仓库').fill('context');
  await page.getByRole('button',{name:'查找插件'}).click();
  await expect(page).toHaveURL(/plugins\?q=context/);
  await expect(page.locator('[data-testid="plugin-row"]').filter({hasText:'dsh-context'})).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('library search, sorting, filters, pagination and clear persist in URL', async({page})=>{
  await page.goto('/plugins'); const explorer=page.locator('#all-plugins');
  await explorer.getByRole('searchbox',{name:'搜索插件',exact:true}).fill('context');
  await expect(page).toHaveURL(/q=context/);
  await expect(explorer.locator('tbody tr').filter({hasText:'dsh-context'})).toHaveCount(1);
  await explorer.getByRole('button',{name:'清除搜索'}).click();
  await explorer.getByLabel('排序方式').selectOption('maintenance');
  await expect(page).toHaveURL(/sort=maintenance/);
  await explorer.getByLabel('按下载数据可用性筛选').selectOption('missing');
  await expect(explorer.locator('tbody tr')).toHaveCount(2);
  await page.reload(); await expect(explorer.getByLabel('按下载数据可用性筛选')).toHaveValue('missing');
  await explorer.getByRole('button',{name:/清除 \d+ 项/}).click();
  await expect(page).not.toHaveURL(/downloads=/);
  const next=explorer.getByRole('button',{name:'下一页'});
  if(await next.isEnabled()) { await next.click(); await expect(page).toHaveURL(/page=2/); }
});

test('changing filters does not jump to the top and back restores the previous filter', async({page})=>{
  await page.goto('/plugins'); await expect(page.locator('[data-testid="plugin-row"]').first()).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,250)); const before=await page.evaluate(()=>window.scrollY);
  await page.locator('#all-plugins').getByLabel('排序方式').selectOption('maintenance');
  const after=await page.evaluate(()=>window.scrollY); expect(Math.abs(after-before)).toBeLessThan(5);
  await page.locator('#all-plugins').getByLabel('按下载数据可用性筛选').selectOption('missing');
  await page.goBack();
  await expect(page.locator('#all-plugins').getByLabel('按下载数据可用性筛选')).toHaveValue('all');
  await expect(page.locator('#all-plugins').getByLabel('排序方式')).toHaveValue('maintenance');
});

test('two plugin selections produce a compare link and limit additional selections', async({page})=>{
  await page.goto('/plugins'); const inputs=page.locator('table input[type="checkbox"]');
  await inputs.nth(0).check(); await inputs.nth(1).check(); await expect(inputs.nth(2)).toBeDisabled();
  await expect(page.getByRole('complementary',{name:'对比选择'})).toContainText('已选 2/2');
  await page.getByRole('link',{name:'开始对比'}).click(); await expect(page).toHaveURL(/compare\?a=.+&b=.+/);
  await expect(page.getByRole('heading',{level:1})).toHaveText('插件对比');
});

test('legacy search and quadrant links redirect preserving parameters', async({page})=>{
  await page.goto('/?q=context&sort=maintenance#all-plugins');
  await expect(page).toHaveURL(/\/plugins\?q=context&sort=maintenance/);
  await page.goto('/quadrant?risk=high&focus=hot-healthy');
  await expect(page).toHaveURL(/\/ecosystem\?risk=high&focus=hot-healthy/);
  await expect(page.getByLabel('按风险筛选')).toHaveValue('high');
});

test('ecosystem URL filters survive reload and list selects a readable summary', async({page})=>{
  await page.goto('/ecosystem');
  await page.getByRole('button',{name:/热门 · 活跃/}).click();
  await expect(page).toHaveURL(/focus=hot-healthy/);
  await page.getByLabel('按风险筛选').selectOption('high');
  await page.reload(); await expect(page.getByLabel('按风险筛选')).toHaveValue('high');
  await page.getByRole('heading',{name:'生态分布',exact:true}).hover();
  await expect(page.getByRole('tooltip')).toContainText('固定 0–100 轴，筛选不会重新缩放');
  const list=page.getByRole('complementary',{name:'象限内插件列表'});
  await list.locator('ul button').first().click();
  await expect(list.getByRole('status')).toBeVisible();
  await list.getByRole('link',{name:'查看详情',exact:false}).click();
  await expect(page).toHaveURL(/plugins\//);
});

test('plugin details explain evidence, grouped attention and original sources', async({page})=>{
  const errors=trackErrors(page);await page.goto(detail);
  await expect(page.getByRole('heading',{level:1})).toContainText('dsh-context');
  await expect(page.getByText('维护活跃度',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('数据来源与采集时间').first()).toBeVisible();
  await page.getByRole('button',{name:/为什么是这个关注度/}).click();
  await expect(page.getByText('证据覆盖').first()).toBeVisible();
  await expect(page.locator('#risk-evidence')).toContainText('维护提醒');
  await expect(page.locator('#risk-evidence')).toContainText('公开漏洞');
  await expect(page.locator('#risk-evidence')).toContainText('数据缺口');
  expect(errors).toEqual([]);
});

test('missing npm is unavailable rather than zero and is not described as safe',async({page})=>{
  await page.goto('/plugins/toolclub-dsh-agent-team-gui');
  await expect(page.getByRole('heading',{level:1})).toContainText('dsh-agent-team-gui');
  await expect(page.getByText('暂无可靠 npm 下载数据').first()).toBeVisible();
  await expect(page.getByText('未完成漏洞检查').first()).toBeVisible();
  await expect(page.getByText('信息不完整',{exact:true}).first()).toBeVisible();
});

test('compare matrix remains sticky and selections can swap',async({page})=>{
  const errors=trackErrors(page);await page.goto(compare);
  await expect(page.getByText('指标对照')).toBeVisible();
  await expect(page.getByRole('table').last()).toContainText('数据完整程度');
  const header=page.locator('table').first().locator('thead th').first();
  const top=await page.locator('table').first().evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
  await page.evaluate(y=>window.scrollTo(0,y+320),top);
  await expect.poll(()=>header.evaluate(el=>getComputedStyle(el).position)).toBe('sticky');
  const y=await header.evaluate(el=>el.getBoundingClientRect().top);
  expect(y).toBeGreaterThanOrEqual(63);expect(y).toBeLessThanOrEqual(66);
  await page.getByRole('button',{name:'交换两侧插件'}).click();
  await expect(page).toHaveURL(/a=michengai-dsh-agency-agents&b=dsh-market-dsh-market/);
  expect(errors).toEqual([]);
});

test('different scoring inputs suppress score differences',async({page})=>{
  await page.goto('/compare?a=dsh-market-dsh-market&b=toolclub-dsh-agent-team-gui');
  await expect(page.getByText('参与分项不同，不计算分差').first()).toBeVisible();
});

test('invalid compare IDs recover to two different valid plugins',async({page})=>{
  await page.goto('/compare?a=missing&b=missing');
  await expect(page).not.toHaveURL(/missing/);
  await expect(page.getByRole('heading',{level:1})).toHaveText('插件对比');
});

test('a failed refresh keeps the last usable snapshot visible',async({page})=>{
  await page.goto('/plugins');await expect(page.locator('[data-testid="plugin-row"]').first()).toBeVisible();
  await page.route('**/data/latest.json*',route=>route.fulfill({status:500,body:'offline'}));
  await page.getByRole('button',{name:'重新加载数据快照'}).click();
  await expect(page.getByText(/latest.json 请求失败/).first()).toBeVisible();
  await expect(page.locator('[data-testid="plugin-row"]').first()).toBeVisible();
});

test('bad plugin and partial history do not take down other records',async({page})=>{
  await page.route('**/data/latest.json',async route=>{
    const response=await route.fetch();const json=await response.json();json.plugins[0].github.stars=-1;
    await route.fulfill({response,json});
  });
  await page.route('**/data/history.json',async route=>{
    const response=await route.fetch();const json=await response.json();json.plugins['broken']='invalid';
    await route.fulfill({response,json});
  });
  await page.goto('/plugins');
  await expect(page.locator('[data-testid="plugin-row"]').first()).toBeVisible();
  await expect(page.getByText(/插件记录校验失败/).first()).toBeVisible();
  await page.getByText(/条数据说明/).click();
  await expect(page.getByText(/历史记录已隔离/).first()).toBeVisible();
});

test('method page remains readable when core data fails',async({page})=>{
  await page.route('**/data/latest.json',route=>route.fulfill({status:200,json:{schemaVersion:999}}));
  await page.goto('/method');
  await expect(page.getByRole('heading',{level:1})).toHaveText('数据与方法');
  await expect(page.getByText('快速指南')).toBeVisible();
});

for(const width of [390,768,1024,1366,1440,1920]){
  test('responsive pages at '+width+'px have no page overflow',async({page})=>{
    await page.setViewportSize({width,height:width===1366?768:width===1920?1080:900});
    for(const path of ['/','/plugins','/ecosystem',compare]){
      await page.goto(path);await expect(page.getByRole('heading',{level:1})).toBeVisible();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      expect(overflow,path).toBeLessThanOrEqual(1);
    }
  });
}

test('mobile drawer supports navigation and Escape focus restoration',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('.orbit-breadcrumb .orbit-quiet-hint')).toBeVisible();
  const menu=page.getByRole('button',{name:'打开导航菜单'});
  await menu.click();await expect(page.getByRole('dialog',{name:'导航菜单'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();
  await menu.click();await page.locator('#mobile-nav').getByRole('link',{name:/生态分布/}).click();
  await expect(page).toHaveURL(/ecosystem/);await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reduced motion skips 3D JS and keeps the static orbital visual',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');await page.waitForTimeout(1000);
  await expect(page.locator('.orbit-brand-scene')).toHaveAttribute('data-mode','poster');
  expect(requests.some(url=>url.includes('orbit-scene.ts')||url.includes('three.js'))).toBe(false);
});


test('WebGL scene starts, releases resources and falls back after context loss',async()=>{
  const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:5173/');
  await expect(page.locator('.orbit-brand-scene')).toHaveAttribute('data-mode','webgl',{timeout:15000});
  await page.locator('.orbit-scene-canvas canvas').evaluate(canvas=>{
    canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
  });
  await expect(page.locator('.orbit-brand-scene')).toHaveAttribute('data-mode','poster');
  await expect(page.locator('#home-title')).toBeVisible();
  await page.getByRole('navigation',{name:'主导航',exact:true}).getByRole('link',{name:/插件库/}).click();
  await expect(page.locator('.orbit-scene-canvas')).toHaveCount(0);
  await browser.close();
});

test('unavailable WebGL keeps the static scene and the primary chart usable',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this: HTMLCanvasElement,type: string,...args:unknown[]) {
      if(type==='webgl2') return null;
      return Reflect.apply(original,this,[type,...args]);
    } as typeof original;
  });
  await page.goto('/');await page.waitForTimeout(1000);
  await expect(page.locator('.orbit-brand-scene')).toHaveAttribute('data-mode','poster');
  await expect(page.getByRole('img',{name:/DSH 插件关注度/})).toBeVisible();
});


test('download missing days remain gaps instead of zero-valued chart averages',async({page})=>{
  await page.goto('/plugins/dsh-market-dsh-market');
  await expect(page.getByText('灰色/断点=疑似缺失，不按 0 计入均值')).toBeVisible();
  await expect(page.getByText(/周下载窗口包含平台性缺数日/).first()).toBeVisible();
});


test('quiet headings expose supporting text on hover and keyboard focus only',async({page})=>{
  await page.goto('/');await expect(page.locator('#home-title')).toBeVisible();
  await expect(page.locator('.orbit-hero-intro')).toHaveCount(0);
  await expect(page.locator('.orbit-brand-scene figcaption')).toHaveCount(0);
  await expect(page.locator('.orbit-topbar')).not.toContainText('工作台');
  const current=page.locator('.orbit-breadcrumb .orbit-quiet-hint');
  await current.hover();await expect(page.getByRole('tooltip')).toHaveText('生态指标与近期变化');
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(1,1);await current.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('navigation',{name:'主导航',exact:true}).getByRole('link',{name:'插件库',exact:true}).click();
  await expect(page).toHaveURL(/plugins$/);
  await expect(page.locator('.page-enter')).toHaveCSS('animation-name','orbit-page-in');
});

test('scatter halos keep moving near and inside both charts',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  for (const path of ['/', '/ecosystem']) {
    await page.goto(path);await page.mouse.move(2,2);
    const halo=page.locator('.orbit-scatter-pulse');
    await expect(halo).toHaveAttribute('data-state','running');
    const bounds=await halo.boundingBox();if(!bounds)throw new Error('missing chart bounds');
    for (const x of [bounds.x-30, bounds.x+bounds.width/2]) {
      await page.mouse.move(x,bounds.y+bounds.height/2);
      await expect(halo).toHaveAttribute('data-state','running');
      const ring=halo.locator('circle').first();
      await expect(ring).toHaveCSS('animation-play-state','running');
      const before=await ring.evaluate(el=>getComputedStyle(el).transform);
      await expect.poll(()=>ring.evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.orbit-scatter-pulse')).toHaveCount(0);
});

for (const width of [505,1440]) {
  test('compare annotations stay hidden until hover or focus at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto(compare);
    const matrix=page.getByTestId(width<1024?'compare-mobile-matrix':'compare-desktop-matrix');
    const label=matrix.locator('.orbit-quiet-hint').filter({hasText:/^关注度$/});
    await label.scrollIntoViewIfNeeded();await page.mouse.move(1,1);
    await expect(page.getByText('Star 与 npm 下载的对数归一化合成',{exact:true})).toHaveCount(0);
    await expect(matrix).not.toContainText('评分依据覆盖');
    await label.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Star 与 npm 下载的对数归一化合成');
    await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.mouse.move(1,1);
    const score=matrix.locator('.orbit-score-evidence').first();
    await score.focus();
    await expect(page.getByRole('tooltip')).toHaveText('依据较充分 · 评分依据覆盖 100%');
    await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
}

test('detail supporting metric and score notes use the same quiet hints',async({page})=>{
  await page.goto(detail);
  const summary=page.getByLabel('评分摘要');
  await expect(summary).not.toContainText('依据较充分');
  await expect(summary).not.toContainText('覆盖');
  await summary.locator('.orbit-score-evidence').first().focus();
  await expect(page.getByRole('tooltip')).toContainText('评分依据覆盖');
  await page.keyboard.press('Escape');
  const label=page.locator('#raw-metrics .orbit-quiet-hint').filter({hasText:/^Stars$/});
  await label.hover();
  await expect(page.getByRole('tooltip')).toHaveText('GitHub 当前值');
});
