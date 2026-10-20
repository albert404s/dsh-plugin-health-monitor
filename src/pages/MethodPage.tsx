import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  Calculator,
  Database,
  GitBranch,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { SCORE_METHOD_VERSION } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { ExternalTextLink, InlineNotice, SectionHeading } from '../components/ui';

const TOC = [
  { href: '#principles', label: '读数原则' },
  { href: '#sources', label: '数据来源' },
  { href: '#popularity', label: '人气指数' },
  { href: '#maintenance', label: '维护健康度' },
  { href: '#risk', label: '风险提示' },
  { href: '#completeness', label: '数据完整度' },
  { href: '#pipeline', label: '更新与存储' },
  { href: '#limits', label: '局限与边界' },
];

export function MethodPage(): JSX.Element {
  const { data } = useData();

  return (
    <div className="page-enter mx-auto max-w-shell px-4 pb-14 pt-8 md:px-6 md:pt-10">
      <div className="max-w-3xl">
        <p className="eyebrow">Methodology / v{SCORE_METHOD_VERSION}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-100 md:text-4xl">
          指标不是判决书
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink-300">
          DSH Plugin Health Monitor 用公开数据帮助阅读 DeepSeek Harness 插件生态。
          我们不输出“软件质量总分”，而是把
          <span className="text-ink-200">人气、维护活动、风险信号、数据完整度</span>
          拆成可解释、可追溯、可质疑的维度。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] text-ink-500">
          <span className="rounded border border-ink-700 px-2 py-1 font-mono">方法 v{SCORE_METHOD_VERSION}</span>
          <span className="rounded border border-ink-700 px-2 py-1 font-mono">数据 schema v1</span>
          {data ? (
            <span className="rounded border border-ink-700 px-2 py-1">
              当前快照 {formatDateTime(data.latest.lastSuccessAt)}
            </span>
          ) : null}
          <span className="rounded border border-ink-700 px-2 py-1">计划每 6 小时采集</span>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1" aria-label="方法页目录">
            <p className="mb-3 px-2 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">On this page</p>
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded px-2 py-1.5 text-[11px] text-ink-400 transition hover:bg-ink-800/60 hover:text-ink-100"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          <section id="principles" className="scroll-mt-24">
            <SectionHeading
              eyebrow="01 / Principles"
              title="四条读数原则"
              description="这些原则优先于任何具体权重。"
            />
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-ink-700/70 bg-ink-700/60 sm:grid-cols-2">
              {[
                {
                  title: '相对评价，不是绝对标准',
                  text: '指数在本次收录的插件样本内计算。样本变化会改变排名，因此所有分数都显示数据快照时间与置信度。',
                },
                {
                  title: '缺失不是 0',
                  text: '没有可靠下载、Issue 样本或 OSV 匹配时，该项从权重中剔除或显示“信息不足”，不补 0，也不补造历史点。',
                },
                {
                  title: '活跃不等于质量',
                  text: '提交频率、Issue 关闭率与 PR 合并率只描述公开维护活动，不评价代码架构、文档、用户体验或隐藏缺陷。',
                },
                {
                  title: '风险提示不是审计',
                  text: '归档、长期 Issue 与 OSV 公开记录都是需要阅读的信号；没有记录不等于安全，未检查会明确显示“未完成”。',
                },
              ].map((principle) => (
                <div key={principle.title} className="bg-ink-850/80 p-4">
                  <h3 className="text-xs font-medium text-ink-100">{principle.title}</h3>
                  <p className="mt-2 text-[11px] leading-6 text-ink-400">{principle.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="sources" className="scroll-mt-24">
            <SectionHeading
              eyebrow="02 / Sources"
              title="数据从哪里来"
              description="只使用公开、可追溯的数据。项目不安装、不执行、不加载被检测插件的代码。"
            />
            <div className="mt-5 overflow-x-auto rounded-lg border border-ink-700/70">
              <table className="w-full min-w-[680px] text-left">
                <thead>
                  <tr className="border-b border-ink-700/60 bg-ink-900/50">
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">来源</th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">字段与窗口</th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">准确性边界</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40 text-[11px] leading-5">
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink-200">GitHub REST API</td>
                    <td className="px-4 py-3 text-ink-300">
                      Stars、Forks、归档状态、最近非合并提交、近 30 天非合并提交、近 90 天 Issue/PR、长期开放 Issue、Release。
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      使用分页与重试；分页上限触发时标记为下限。Issue 列表会过滤 PR；不使用 updated_at 代替最近代码提交。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink-200">npm Download API</td>
                    <td className="px-4 py-3 text-ink-300">
                      近 30 天下载、近 7 天 / 前 7 天对比、日下载序列、latest 版本、engines、DSH peer range。
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      只有 npm registry 的 repository 字段与 GitHub 仓库一致时才采信。Star、Fork、Release Asset 下载量不会冒充 npm 下载量。
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink-200">OSV API</td>
                    <td className="px-4 py-3 text-ink-300">
                      以 npm 包名 + latest 精确版本查询 querybatch，并读取公开漏洞详情。
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      只覆盖 OSV 已收录的公开记录。无法精确匹配或请求失败时显示“未完成漏洞检查”，不会显示“安全”或“零风险”。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-ink-500">
              <ExternalTextLink href="https://docs.github.com/rest">GitHub REST 文档</ExternalTextLink>
              <ExternalTextLink href="https://github.com/npm/registry/blob/main/docs/download-counts.md">
                npm 下载统计口径
              </ExternalTextLink>
              <ExternalTextLink href="https://google.github.io/osv-scanner/">OSV 文档</ExternalTextLink>
            </div>
          </section>

          <section id="popularity" className="scroll-mt-24">
            <SectionHeading
              eyebrow="03 / Popularity"
              title="人气指数"
              description="回答“有多少人在关注或使用”，不回答“好不好”。"
            />
            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="rounded-lg border border-ink-700/70 bg-ink-850/70 p-4">
                <div className="flex items-center gap-2">
                  <Calculator size={14} className="text-signal" />
                  <h3 className="text-xs font-medium text-ink-100">计算</h3>
                </div>
                <div className="mt-3 space-y-3 text-[11px] leading-6 text-ink-300">
                  <p>
                    对每个有效值先做 <code className="rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-ink-100">log10(1 + x)</code>，
                    再在本次样本内做 min-max 归一化到 0–100。这样可以压缩几个数量级间的差异，避免下载量直接淹没 Star。
                  </p>
                  <p>
                    同时有两种数据时：Stars 权重 <b className="text-ink-100">45%</b>，经核验的近 30 天下载量权重{' '}
                    <b className="text-ink-100">55%</b>。
                  </p>
                  <p>
                    缺少可靠下载量时，仅使用 Stars 的归一化位置，权重归一为 100%，证据覆盖降为 45%，置信度降为“中”。
                    该插件仍可在详情页查看，但不会进入四象限定位。
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-ink-700/70 bg-ink-900/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500">为什么不用绝对分</p>
                <p className="mt-2 text-[11px] leading-6 text-ink-400">
                  当前 DSH 插件生态仍在快速变化。Star 与下载量受传播、发布节奏、镜像和统计口径影响，
                  用固定行业阈值会制造虚假精确感。因此本指数表达“在这批插件中的相对位置”，并随收录样本变化。
                </p>
                <p className="mt-3 border-t border-ink-700/60 pt-3 text-[10px] leading-5 text-amber/80">
                  缺少下载量时不会简单计 0；星级高但下载缺失的插件也不会被强行放入“高人气”象限。
                </p>
              </div>
            </div>
          </section>

          <section id="maintenance" className="scroll-mt-24">
            <SectionHeading
              eyebrow="04 / Maintenance"
              title="维护健康度"
              description="最近有多少可观察的公开维护证据，而不是代码质量分。"
            />
            <div className="mt-5 overflow-x-auto rounded-lg border border-ink-700/70">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-ink-700/60 bg-ink-900/50">
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">分项</th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">设计权重</th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">算法</th>
                    <th className="px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.1em] text-ink-500">缺失/小样本处理</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/40 text-[11px] leading-5">
                  {[
                    ['最近代码提交', '30%', '距最近非合并提交：≤7d 100；≤14d 92；≤30d 82；≤60d 68；≤90d 55；≤180d 38；≤365d 20；更久 6。', '无提交日期时整项剔除。'],
                    ['近 30 天非合并提交频率', '15%', '0 次=12，1=38，2–3=55，4–7=72，8–11=88，≥12=100。', '分页达到上限时按已取得的提交数作下限计分。'],
                    ['近期 Issue 关闭率', '20%', '近 90 天创建的非 PR Issue 中当前已关闭比例 × 100。', '少于 5 条按 n/5 折减权重；0 条新 Issue 不参与，不扣分。'],
                    ['开放 Issue 积压', '10%', '若当前有开放 Issue：100 − (开放 Issue 数 / 近 90 天新开 Issue 数) × 100。', '按近 90 天新开样本缩放权重；无开放 Issue 时不参与。'],
                    ['近期 PR 合并率', '15%', '近 90 天创建 PR 中已合并比例 × 100。', '少于 3 条按 n/3 折减；PR 功能不可用时剔除，不记 0。'],
                    ['最近版本发布', '10%', '≤30d 100；≤60d 92；≤90d 80；≤180d 62；≤365d 40；更久 18。', '没有稳定 Release 时不参与评分，不直接惩罚。'],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="px-4 py-3 font-medium text-ink-200">{row[0]}</td>
                      <td className="px-4 py-3 font-mono text-ink-300">{row[1]}</td>
                      <td className="px-4 py-3 text-ink-400">{row[2]}</td>
                      <td className="px-4 py-3 text-ink-400">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded border border-ink-700/60 bg-ink-900/30 p-3 text-[10px] leading-5 text-ink-400">
                <b className="text-ink-200">证据覆盖 &lt; 45%</b> → 不输出维护分，显示“信息不足”。
              </div>
              <div className="rounded border border-ink-700/60 bg-ink-900/30 p-3 text-[10px] leading-5 text-ink-400">
                <b className="text-ink-200">覆盖 ≥ 80% / 55%</b> → 高 / 中置信，剩余为低置信。
              </div>
              <div className="rounded border border-ink-700/60 bg-ink-900/30 p-3 text-[10px] leading-5 text-ink-400">
                <b className="text-ink-200">提交多 ≠ 质量高</b>。维护分只描述公开活动，不进入“代码质量”判断。
              </div>
            </div>
          </section>

          <section id="risk" className="scroll-mt-24">
            <SectionHeading
              eyebrow="05 / Risk"
              title="风险提示"
              description="按信号分级展示，不做风险总分，也不把“无记录”写成“安全”。"
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-ink-700/70 bg-ink-850/70 p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="text-amber" />
                  <h3 className="text-xs font-medium text-ink-100">触发规则</h3>
                </div>
                <ul className="mt-3 space-y-2 text-[11px] leading-5 text-ink-400">
                  <li>· 仓库 archived → 高风险信号。</li>
                  <li>· 长期开放 Issue ≥ 20 高风险；≥ 5 需关注。</li>
                  <li>· 开放 Issue ≥ 100 或开放/近 90 天新开 ≥ 75% → 高风险；≥ 50 或 ≥ 50% → 需关注。</li>
                  <li>· OSV 返回 high/critical → 高风险信号；其他公开记录 → 需关注。</li>
                  <li>· 未完成漏洞检查、无可靠 npm 数据、数据超过 2 天未更新 → 信息缺口。</li>
                  <li>· 若 OSV 未完成且无其他高风险信号 → 等级为“风险信息不完整”，不是“低风险”。</li>
                </ul>
              </div>
              <div className="rounded-lg border border-ink-700/70 bg-ink-900/40 p-4">
                <div className="flex items-center gap-2">
                  <GitBranch size={14} className="text-ink-300" />
                  <h3 className="text-xs font-medium text-ink-100">兼容性证据</h3>
                </div>
                <p className="mt-3 text-[11px] leading-6 text-ink-400">
                  详情页展示 npm 包声明的 Node engines、DSH peer range 与版本链接。
                  本项目不安装插件、不执行安装脚本、不做运行时兼容性测试。没有声明不等于不兼容，
                  已声明也不等于已验证。
                </p>
                <p className="mt-3 border-t border-ink-700/60 pt-3 text-[10px] leading-5 text-ink-500">
                  Issue 与 PR 的统计窗口固定为 90 天，分母分别是窗口内创建的非 PR Issue 数和 PR 数。
                </p>
              </div>
            </div>
          </section>

          <section id="completeness" className="scroll-mt-24">
            <SectionHeading
              eyebrow="06 / Completeness"
              title="数据完整度"
              description="七个数据域，分别记录“是否真的取得”，避免把零值和缺失混在一起。"
            />
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                '仓库基础信息',
                '提交活动',
                'Issue 处理',
                'PR 处理',
                '版本发布',
                'npm 下载',
                'OSV 漏洞检查',
              ].map((domain, index) => (
                <div key={domain} className="rounded border border-ink-700/60 bg-ink-900/30 px-3 py-2.5">
                  <span className="font-mono text-[9px] text-ink-500">0{index + 1}</span>
                  <p className="mt-1 text-[11px] text-ink-200">{domain}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-6 text-ink-400">
              完整度 = 可用数据域 / 7。它衡量的是“这份画像有多少证据”，不是插件质量。
              没有 Release、没有 Issue 或没有 npm 包是项目的真实状态，但仍会降低画像覆盖，因为对应维度无法形成证据。
            </p>
          </section>

          <section id="pipeline" className="scroll-mt-24">
            <SectionHeading
              eyebrow="07 / Pipeline"
              title="更新、历史与部署"
              description="静态 JSON、独立 data 分支、GitHub Actions 与 Pages。"
            />
            <div className="mt-5 grid gap-px overflow-hidden rounded-lg border border-ink-700/70 bg-ink-700/60 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: <Database size={14} />, title: '采集', text: 'Node/TypeScript 采集 GitHub、npm、OSV，带超时、重试、分页与请求级缓存。' },
                { icon: <Calculator size={14} />, title: '计算', text: '统一评分模块生成快照、历史点与状态文件。历史点只在成功写入时追加。' },
                { icon: <GitBranch size={14} />, title: '存储', text: '源码在 main，数据在 data 分支。失败采集只更新 status，不覆盖最后成功快照。' },
                { icon: <RefreshCw size={14} />, title: '部署', text: 'GitHub Actions 构建并部署 Pages；前端只读取静态 JSON，不含任何 Token。' },
              ].map((step, index) => (
                <div key={step.title} className="bg-ink-850/80 p-4">
                  <div className="flex items-center justify-between text-ink-400">
                    <span className="text-signal-strong">{step.icon}</span>
                    <span className="font-mono text-[9px] text-ink-600">0{index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-xs font-medium text-ink-100">{step.title}</h3>
                  <p className="mt-1.5 text-[10px] leading-5 text-ink-400">{step.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-ink-700/60 bg-ink-900/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500">保留策略</p>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-ink-400">
                  <li>· 每 6 小时尝试更新 GitHub 数据；npm 与 OSV 随同刷新。</li>
                  <li>· 历史保留 90 天，单插件最多保留 400 个点；完整快照最多保留 120 份。</li>
                  <li>· 连续执行两次更新不会清空历史；失败采集不生成新的 latest 快照。</li>
                  <li>· data 分支提交不会触发 main 的部署，避免工作流循环。</li>
                </ul>
              </div>
              <div className="rounded border border-ink-700/60 bg-ink-900/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500">安全边界</p>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-ink-400">
                  <li>· GitHub Token 只存在于采集进程环境，不进入 Vite 前端构建。</li>
                  <li>· 构建后扫描产物中的 token 形态，CI 失败即阻止交付。</li>
                  <li>· 不安装、不执行第三方插件，不把 README/Issue 文本当指令。</li>
                  <li>· 页面只展示静态 JSON，没有服务端运行时和用户凭据。</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="limits" className="scroll-mt-24">
            <SectionHeading
              eyebrow="08 / Limits"
              title="明确知道它不知道什么"
              description="这些限制不是免责声明，而是读分时必须带入的条件。"
            />
            <div className="mt-5 space-y-3">
              {[
                {
                  title: '不是软件质量评估',
                  text: '没有代码审查、架构分析、测试覆盖率、用户体验或长期缺陷数据。维护活动不能替代质量判断。',
                },
                {
                  title: '相对指数会随样本变化',
                  text: '新增或移除一个插件可能改变其他人气分。分数适合做同快照内比较，不适合跨时间、跨榜单直接对比。',
                },
                {
                  title: 'npm 不等于 DSH 实际使用量',
                  text: '下载可能来自 CI、镜像、重复安装或依赖解析；非 npm 分发的插件没有下载指标，数据完整度会下降。',
                },
                {
                  title: 'GitHub 的窗口与样本偏差',
                  text: 'Issue 关闭不等于解决，PR 合并不等于高质量，提交次数受合并策略影响；样本小、分页上限和仓库权限都会影响结果。',
                },
                {
                  title: 'OSV 不是完整安全审计',
                  text: 'OSV 只覆盖已公开记录，精确版本匹配依赖 npm 与版本。没有记录不代表没有漏洞。',
                },
                {
                  title: '兼容性未验证',
                  text: '只展示项目声明。真实兼容性需要安装、运行、版本矩阵与宿主环境测试；本项目明确不做这些执行。',
                },
              ].map((limit) => (
                <div key={limit.title} className="rounded border border-ink-700/60 bg-ink-900/30 px-4 py-3">
                  <h3 className="text-[11px] font-medium text-ink-200">{limit.title}</h3>
                  <p className="mt-1 text-[10px] leading-5 text-ink-400">{limit.text}</p>
                </div>
              ))}
            </div>
            <InlineNotice tone="neutral" className="mt-4">
              发现口径问题、数据错误或有新的 DSH 插件要加入？请通过项目 GitHub 仓库提交 Issue 或 PR。
              配置文件位于 <code className="rounded bg-ink-900 px-1 py-0.5 font-mono text-[10px]">config/plugins.json</code>。
            </InlineNotice>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/60 pt-5">
            <p className="text-[10px] text-ink-500">
              <BookOpen size={11} className="mr-1 inline" />
              文档随代码版本迭代；当前方法版本 {SCORE_METHOD_VERSION}。
            </p>
            <div className="flex items-center gap-3 text-[10px] text-ink-400">
              <Link to="/" className="hover:text-ink-100">
                返回排行榜
              </Link>
              <a
                href="https://github.com/albert404s/dsh-plugin-health-monitor"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-ink-100"
              >
                源码 <ArrowUpRight size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
