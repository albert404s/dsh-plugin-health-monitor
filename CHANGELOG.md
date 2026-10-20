# Changelog

## [0.1.0] - 2026-10-20

### Added

- 真实 GitHub / npm / OSV 数据采集，data 分支历史快照与 GitHub Pages 部署。
- 人气、维护健康度、风险、数据完整度四组可解释指标，排行榜、四象限、对比、详情与方法页。
- GitHub Actions 定时更新、CI、生产构建、Playwright 验收、Token 形态扫描。

### Fixed (MVP acceptance pass)

- 修复 Issue/PR 90 天分页共享 500 条预算的问题：Issue 与 PR 各自最多 20 页，截断时 UI 标注“下限样本”。
- 修复 `commits30d` 把 merge commit 计入的问题：只统计非合并提交；分页上限按已取得的下限计分，不再整项剔除活跃仓库。
- 修复“长期开放 Issue”在最年轻插件生态中恒为 100 的问题：积压分改为 `openNow / opened90d`，并新增开放 Issue 绝对量/比例风险规则。
- 修复四象限谓词未检查 `downloads30d` 的问题：npm 下载缺失时不再进入象限。
- 修复 npm 7 日/周变化使用数组下标和平台性 0 值日的问题：按日期对齐窗口，缺日或平台性缺数日时输出“不可用”，不再制造假趋势。
- 修复 `.panel` 未建立定位上下文导致的移动端整页横向溢出（390px 四象限、768px 首页）。
- 修复数据请求无超时、刷新失败丢弃旧快照、单条坏记录导致全站 ErrorBoundary 的问题。
- 修复详情页截断百分比未提示、`plugin.warnings` 未展示、GitHub 来源时间使用全局时间的问题。
- Release 只取稳定版，排除 draft/prerelease。
- OSV 响应缺少 `results`/`vulns` 类型错误时按失败处理，不再当成“已检查、无漏洞”；过滤 withdrawn 记录。
- 增加 45% / 55% 浮点阈值容差；维护分缺失项写入 `missing`。
- 历史趋势按方法版本隔离，避免跨口径比较。
- `vite.config.ts` 支持 `.env` 的 `VITE_BASE`；favicon 使用 base 感知路径；构建产物移除未使用的 snapshots。
- deploy 与 update-data 的构建增加 typecheck/unit 门禁；data persist 在 build 成功后才提交。

### Changed

- 评分方法版本升至 `1.1.0`。
- 维护分“开放 Issue 积压”分项与风险规则更新；文档、方法页和 README 同步。

### Known limitations

- GitHub Search/Issues 分页仍有上限；极端活跃仓库可能显示“下限样本”。
- OSV 详情最多读取 20 条；严重度优先使用 OSV 的 database/ecosystem severity，缺少时标为 unknown。
- GitHub Pages 对 SPA 深链返回 HTTP 404（内容由 404.html 正常渲染）。
- 6 小时 schedule 为 GitHub 最佳努力调度，尚未通过长期运行验证。
- 生产依赖 echarts 5.6.0 / react-router 6.x 存在已披露 moderate 公告，当前代码路径不可达；升级另开 PR。
