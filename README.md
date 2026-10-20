# DSH Plugin Health Monitor — data branch

此分支只保存自动生成的公开数据，不包含应用源码。

- `latest.json`：最近一次成功写入的完整快照
- `history.json`：90 天内的紧凑历史点（单插件最多 400 点）
- `status.json`：最近一次采集运行状态（失败时也会更新）
- `snapshots/`：完整快照，保留最近 120 份

源码、文档和 GitHub Actions 工作流位于 `main` 分支。数据由 `update-data.yml` 每 6 小时采集并提交，前端构建时只读取本分支的 JSON。
