# DSH Plugin Health Monitor · DSH 插件生命体征

> 用真实 GitHub、npm 与 OSV 数据观察 DeepSeek Harness 插件的人气、维护健康度、风险与数据完整度。

这是一个面向 DSH 插件使用者、程序员与计算机专业学生的独立 Web 数据分析站。它不是 DSH 宿主插件，而是对插件生态进行公开数据采集、信息检索、指标计算与可视化的项目。

**当前状态：** MVP 开发中（`v0.1.0` 目标）。完整使用方法、指标口径与部署说明将在 MVP 完成后补齐。

## 技术栈

- React + TypeScript + Vite + Tailwind CSS
- Apache ECharts + Lucide Icons
- Node.js + TypeScript 采集脚本
- GitHub REST API / npm Download API / OSV API
- GitHub Actions + GitHub Pages
- 结构化 JSON 快照；源码与数据历史分属 `main` 与 `data` 分支

## 本地开发

```bash
npm install
npm run data:pull
npm run dev
```

如果远端还没有数据快照，请配置 GitHub Token 后运行：

```bash
# 方式一：环境变量
export GITHUB_TOKEN=...
npm run collect

# 方式二：本地 gh CLI 已登录时，采集脚本会自动读取 gh auth token
npm run collect
```

采集结果默认写入 `public/data`，并在 `.gitignore` 中排除。页面默认展示真实数据；数据缺失、过期或采集失败时会明确提示。

## 许可

待补充。
