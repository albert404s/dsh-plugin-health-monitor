# DSH Plugin Health Monitor — 浅色工业未来风改版简报

## 0. 任务性质

在现有「浅色数据主题」改版成果上继续深化视觉方向，不是从零重做。本轮只做本地修改与预览，**不执行 commit / push / PR / merge / 部署 / 版本标签**。

## 1. 仓库现状

- 路径：`D:\AI Programs\github dsh plugins health`
- 分支：`ui/light-tech-redesign`，工作区干净
- HEAD：`785c8f2 feat(ui): redesign dashboard with light data theme`
- 技术栈：React 18 + TypeScript + Vite 6 + Tailwind 3 + ECharts 5 + react-router-dom 6
- 数据：真实静态数据位于 `public/data/`（`latest.json`、`history.json`、`status.json`、`snapshots/`），由 `src/hooks/useData.tsx` 加载；**不得伪造或改写数据**
- 现有页面：`src/pages/HomePage.tsx`、`QuadrantPage.tsx`、`PluginDetailPage.tsx`、`ComparePage.tsx`、`MethodPage.tsx`、`NotFoundPage.tsx`
- 公共组件：`src/components/`（`Header`、`Footer`、`DataNotices`、`StatsStrip`、`RankList`、`PluginExplorer`、`Insights`、`ui.tsx`）
- 图表：`src/components/charts/`（`chartTheme.ts`、`QuadrantChart.tsx`、`ScoreTrendChart.tsx`、`DownloadBars.tsx`、`echarts.ts`）
- 主题入口：`src/index.css`（CSS 变量）与 `tailwind.config.ts`（语义色映射）
- 已有设计文档：`docs/DATA_SOURCES.md`、`docs/SCORING.md`

## 2. 核心视觉概念

把网站设计成 **「DSH 插件生态观测实验室」**：打开页面应看到鲜明的品牌标题、精密的数据读数、占据视觉中心的四象限图。整体具有工业设备、实验仪器与未来科技产品的气质。

参考 <https://nothing.tech/> 的工业设计语言，重点借鉴：点阵字形、工业编号、黑白灰结构、红色强调、有张力的版面。不要照搬手机产品页，要围绕「插件生态数据分析」重新设计。

## 3. 视觉规范

- 主背景：冷白或极浅灰，基准 `#F4F4F2`。
- 内容面板：白色；辅以银灰结构（约 `#E4E4E0` / `#C9C9C4`）与深灰正文（约 `#1A1A1A` / `#4A4A46`）。
- 强调色：红色 `#D71920`，**少量使用**（关键动作、当前项、品牌刻度、警示性强调）。
- 风险等级保留独立、明确的语义颜色，不能只靠品牌红表达；在浅色底上必须可读，并与品牌红有清晰区分（配合文字标签，不能仅靠颜色）。
- 仪器感元素：细线、刻度、圆形状态灯、编号、时间戳、等宽数字（tabular-nums）。
- 点阵字体仅用于**短英文标题、编号或装饰标签**；中文正文、表格、数据说明使用清晰易读的无衬线字体。优先不引入外网字体依赖（可用 CSS 点阵纹理 / 自托管子集 / 系统等宽字体组合实现），并保证无字体时降级不破版。
- 版面：大标题、大小错落的区域、充足留白形成张力；避免整页同尺寸卡片连续堆叠。
- 圆角克制（倾向 0–6px），阴影极轻，接近精密设备而非网页卡片。
- 主视觉：一个银色/半透明的立体品牌元素，与「插件模块、信号、生态」相关。优先 CSS/SVG/渐变/半调纹理等轻量方案，**不引入 three.js 等大型 3D 依赖**。
- 装饰元素（刻度、点阵、扫描线、编号）必须与真实指标清楚区分，不能让人误读为数据。

## 4. 首页信息层次

1. 顶部：简洁导航、项目标识、数据更新时间、采集状态。
2. 首屏：有辨识度的标题、一句话说明、主要操作入口、核心四象限图（视觉中心）。
3. 指标区：关键数字像仪器读数，清楚显示名称、数值、单位，必要时带口径/时间戳。
4. 排行榜与关注区：排名、条形表达、简短标签突出差异。
5. 插件探索区：清楚的搜索、筛选、列表（保留排序、分页）。
6. 详细计算说明按需展开；数据缺失、风险、时效性提示在相关位置直接可见。

减少重复文字；每个区域一个明确视觉重点。

## 5. 全站统一

- 覆盖首页、四象限、插件详情、对比、方法页及所有交互状态（hover / focus / active / disabled / empty / loading / error / tooltip）。
- 检查图表坐标轴、网格、图例、气泡、tooltip，以及代码中写死的暗色配色；保证浅色背景上的文字与图形清晰。
- 保留真实数据、评分逻辑、数据来源、搜索筛选、排序、分页、图表点击、对比等已有功能。
- 趋势图必须使用真实且口径一致的历史数据（`public/data/history.json`、`snapshots/`），不得用假数据补齐。
- 数据来源、更新时间、缺失说明保持可见。

## 6. 响应式与验收

- 检查 390px、768px、1440px 三种宽度；重点关注中文阅读、图表尺寸、长插件名、筛选器、横向溢出。
- 完成 `npm run typecheck`、`npm test`、`npm run build`。
- 具备浏览器能力时用 Playwright（本机已装 chromium）实际打开页面并截图；缺少能力时明确说明未验证项。
- 最终由 Lead 启动仅本机可访问的预览服务并给出准确地址。

## 7. 角色分工与产物

1. **UI Designer（UI 设计师）**：视觉系统、设计令牌、组件与图表视觉规范 → `docs/design/01-visual-system.md`
2. **UX Architect（用户体验设计师）**：信息架构、首页与各页布局、响应式与交互状态 → `docs/design/02-ux-layout.md`
3. **Frontend Developer（前端开发者）**：按两份规范落实代码，保留现有功能与数据逻辑
4. **Evidence Collector（UI 视觉验收设计师）**：用浏览器实际检查页面、三档宽度与截图，输出问题清单

两份规范必须共享同一套令牌与原则；如出现分歧，以 `BRIEF.md` 为准，并在文档中标注。
