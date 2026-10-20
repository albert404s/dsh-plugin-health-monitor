# 数据来源、字段与采集口径

本文档描述 `latest.json`、`history.json`、`status.json` 中的数据从哪里来、统计窗口是什么，以及哪些情况属于缺失而不是零。

## 1. 插件清单与发现

- 人工维护清单：`config/plugins.json`（20 个经核验的 DSH 插件仓库）。
- 发现途径：DeepSeek Harness 生态仓库、`dsh-plugin` / `deepseek-harness-plugin` GitHub topic、公开插件目录与项目 README。
- 不会仅凭仓库名包含 `DSH` 自动判定为插件。收录项必须能对应到 DSH Web profile 的插件安装方式，或能通过官方 profile 机制加载。
- npm 映射只有在满足以下条件时才采信：`registry.npmjs.org/<package>` 的 `repository` 字段与 GitHub 仓库一致（允许 `git+https`、`git@github.com:` 等常见写法）。
- 没有可靠 npm 映射的插件仍可展示 GitHub 数据，但会明确显示“暂无可靠下载数据”和“未完成漏洞检查”。

## 2. GitHub REST API

### 仓库字段

| 字段 | API 来源 | 说明 |
|---|---|---|
| `stars` / `forks` | `GET /repos/{owner}/{repo}` | 当前值 |
| `archived` | 同上 | 归档状态 |
| `createdAt` / `pushedAt` | 同上 | `pushedAt` 仅作辅助，**不**用于代替最近代码提交 |
| `license` / `language` / `topics` | 同上 | 缺失时显示 `—` |
| `defaultBranch` | 同上 | 用于构造 GitHub 提交链接 |

### 活动字段

| 字段 | API | 口径 |
|---|---|---|
| `lastCommitAt` | `GET /repos/{owner}/{repo}/commits?per_page=10` | 取最近一条非合并提交的 `commit.committer.date`；找不到非合并提交时取最新一条 |
| `commits30d` | `GET /repos/{owner}/{repo}/commits?since=...&per_page=100` | 近 30 天当前默认分支提交数；分页上限 5 页，达到上限时标记 `commits30dTruncated` |
| `issues.opened90d` | `GET /repos/{owner}/{repo}/issues?state=all&sort=created&direction=desc` | 近 90 天创建、且不是 Pull Request 的 Issue |
| `issues.closed90d` | 同上 | 上述 Issue 中当前状态为 closed 的数量 |
| `issues.closureRate` | 派生 | `closed90d / opened90d`；分母为 0 时为 `null` |
| `issues.lowSample` | 派生 | 分母 < 5 |
| `issues.longOpen` | `GET /repos/{owner}/{repo}/issues?state=open&sort=created&direction=asc` | 当前开放、创建超过 90 天且非 PR 的 Issue；分页上限 3 页 |
| `issues.openNow` | 仓库 `open_issues_count` − 开放 PR 数 | `open_issues_count` 包含 PR，因此先扣除开放 PR |
| `pullRequests.opened90d` | `GET /repos/{owner}/{repo}/pulls?state=all&sort=created&direction=desc` | 近 90 天创建的 PR |
| `pullRequests.merged90d` | 同上 | 上述 PR 中 `merged_at != null` 的数量 |
| `pullRequests.available` | 派生 | 仓库禁用 PR 时 API 返回 404；此时为 `false`，不把 PR 数量记为 0 |
| `latestRelease` | `GET /repos/{owner}/{repo}/releases?per_page=100` | 最新非 draft Release；没有时是 `null`，并记录 API 是否成功 |
| `releases90d` | 同上 | 近 90 天发布的 Release 数 |

**Issue 与 PR 区分**：GitHub 的 Issues API 会同时返回 PR 条目，代码通过 `pull_request` 字段排除。

**窗口与分母**：Issue 关闭率和 PR 合并率均固定使用 90 天窗口。页面会同时展示分母和样本量；分母过小时降低权重并提示。

**分页完整性**：分页达到上限、开放 Issue 列表被截断或 PR 功能不可用时，记录对应域为不完整，并在不影响其他域的情况下降级。

## 3. npm Download API

| 字段 | API | 口径 |
|---|---|---|
| `downloads30d` | `downloads/point/last-month/{package}` | npm 最近一个完整月的点数（官方口径，不是本项目截取的 30 个自然日） |
| `downloads7d` / `previous7d` | `downloads/range/last-month/{package}` | 基于日下载序列的最后 7 天和前 7 天 |
| `weeklyChangePct` | 派生 | 前 7 天为 0 时无法计算，返回 `null` |
| `daily` | 同上 | 日下载序列，用于详情页柱状图 |
| `latestVersion` | `registry.npmjs.org/{package}` 的 `dist-tags.latest` | 用于 OSV 精确版本查询 |
| `enginesNode` | registry 版本元数据 | 展示 Node 声明 |
| `dshPeerRange` | registry 版本元数据 | 读取 `peerDependencies["@deepseek-ai/dsh"]` 或 `@deepseek-ai/dsh-web-app` |

**不允许的替代**：Star、Fork、Clone、Release Asset 下载量不会被填充为 npm 下载量。

## 4. OSV API

- 请求：`POST https://api.osv.dev/v1/querybatch`，`package.ecosystem = "npm"`，`package.name = <npm 包>`，`version = <latest 精确版本>`。
- 详情：`GET https://api.osv.dev/v1/vulns/{id}`。
- 严重度优先读取 OSV 记录的 `database_specific.severity` / `ecosystem_specific.severity`；缺失时标为 `unknown`。
- 查询成功且结果为空时，页面显示“OSV 未返回公开漏洞记录”，不显示“安全”或“零风险”。
- 没有精确 npm 包/版本、映射未通过或 API 失败时，显示“未完成漏洞检查”。

## 5. 错误、缓存与快照

- HTTP 超时 20 秒（npm registry 25 秒、OSV 30 秒）；GET 请求在进程内按 URL 缓存，避免同一次采集中重复请求。
- 429/5xx/超时最多重试 3 次，指数退避并遵守 `Retry-After`；404 不重试。403 限额且恢复时间过远时抛出错误，等待下一轮。
- 单个 GitHub 仓库失败时沿用该插件上次成功记录；所有 GitHub 仓库都失败时，不写新的 `latest.json` / `history.json`，只更新 `status.json`。
- npm 失败时沿用上次成功 npm 字段；OSV 失败时只有在包名和版本一致时才沿用上次精确匹配结果。
- `status.json` 每次运行都更新，包括失败运行。
- `history.json` 只在成功写入新快照时追加。历史保留 90 天，单插件最多 400 个点。
- 完整快照保存在 `snapshots/`，最多保留 120 份。

## 6. 数据新鲜度

- GitHub、npm、OSV 各自有 `fetchedAt` 与状态。
- 页面在最近成功更新超过 8 小时，或 `status.outcome = failed` 时显示数据过期/失败提示。
- 最近一次成功时间来自 `latest.lastSuccessAt`，不是浏览器加载时间。
