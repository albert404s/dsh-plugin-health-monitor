# 数据采集控制

网站是静态站，采集由 GitHub Actions 完成。页面上的按钮进入仓库的 **Update plugin data** 工作流；仓库有运行权限的成员选择 action 后点击 Run workflow。Token 仅在 Actions 中使用，不放进网页。普通访客仍可浏览上次发布的数据。

| action | 作用 | 是否重新请求 GitHub / npm / OSV 数据 |
| --- | --- | --- |
| refresh（默认） | 立即采集一次，并发布结果；不改变自动更新开关 | 是 |
| pause | 暂停后续每 6 小时的自动采集，发布开关状态 | 否 |
| resume | 恢复后续每 6 小时的自动采集，发布开关状态 | 否 |

暂停后，手动 refresh 仍可执行。暂停不会取消已经在运行的任务；所有更新和 Pages 部署共用 pages 并发组，避免同时写入；GitHub 不保证先后顺序，同组等待任务可能被更新的任务替换。提交操作后以 Actions 的成功结果为准。GitHub 的定时触发也可能延迟，不保证精确在整点更新。

## 文件与流程

data 分支的 collection-control.json 保存共享开关：

```json
{
  "version": 1,
  "automaticPaused": true,
  "updatedAt": "2026-10-22T04:00:00.000Z",
  "updatedBy": "albert404s"
}
```

updatedAt 为 UTC，updatedBy 为执行操作的 GitHub 用户。旧 data 分支没有此文件时兼容为自动开启，更新时间和操作人为 null；有文件但内容损坏则操作失败，不能默认为恢复。修复此文件后可重试。

工作流先用只读 gate 读取开关。该步骤直接使用 Node 24 执行共用的校验逻辑，不安装 npm 依赖。暂停的定时触发会跳过 collect、build、persist、deploy，完全不执行数据采集。pause / resume 只修改控制文件，构建使用原来的 latest.json、history.json、status.json 和 snapshots，persist 也只提交控制文件。只有单独的 persist job 有 contents:write；采集任务保持 contents:read。

构建与数据 artifact 都携带控制文件，站点在 /data/collection-control.json 读取它。采集日期仍指原快照的时间，不会因为改变开关就变成“刚更新”。如果构建失败，控制更改不会提交或生效；如果提交成功但部署失败，Actions 和 data 分支为准，站点可能暂时显示旧状态，可重跑失败的部署。

## 请求量与后续扩展

暂停只是减少不需要的请求，并不绕过平台规则。现有采集保留重试和限流退避。手动采集不应连续点击；先查看运行中的任务和上次更新时间。

以后若加入“按维度发现前 N 个插件”，应把发现与全量指标采集分开：先检索候选，展示预估数量和请求开销，再确认采集上限。只扩大本地列表不会自动突破平台额度。GitHub 搜索和普通 API 有各自的限额，npm 和 OSV 也可能限制请求；实际额度以各平台返回的响应头和官方规则为准。


## 采集范围与预算

新增 configure 操作只保存设置，不调用数据源，也不改变自动开关。到 GitHub 时选择 action=configure，并填写 max_plugins、max_requests、github_reserve，空白沿用已保存值。设置在 data 分支 collection-settings.json，默认每轮最多100个已核验插件、600次请求、GitHub余量预留100。每轮优先未采集/最久未更新的项目，因此小范围会轮换覆盖；未纳入本轮的已有插件保留旧日期并标记，不制造新历史。这不是全 GitHub 搜索功能。

每次真实 HTTP 请求都算入总预算，包括分页、重试、POST 与304验证；内存命中不计请求。总预算和平台剩余额度是两个不同概念。触及总上限、GitHub预留边界或其限流信号时停止后续网络，并保留整份上次 latest/history/snapshots，单独发布状态和 collection-report.json 用量记录。没有旧快照时停止并失败，不用半轮数据冒充完整结果。

只有 GitHub 已确认公共的仓库 GET 使用跨轮条件缓存；npm/OSV仍调用各自API并共享总预算。缓存默认保存30天，下一轮携带ETag/Last-Modified验证，304复用旧body但保留body原始获取时间，不能将其解释为刚发生变化。没有验证器的端点默认仍请求网络；本轮没有开启直接TTL复用。GitHub轮换令牌使用明确workflow公共作用域，否则按认证身份隔离。Authorization、Token和不在白名单内的响应头不写缓存。

Actions 使用固定版本官方cache保存 .data-cache/http；缓存不进入data分支或站点artifact，也不作为权威数据。缓存文件损坏降级为未命中，保存失败只记录提示，不覆盖有效快照。GitHub Actions缓存可能被清理，命中不作保证；请求预算仍独立生效。
