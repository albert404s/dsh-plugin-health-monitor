import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Calculator,
  Database,
  GitBranch,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { SCORE_METHOD_VERSION } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { ExternalTextLink, InlineNotice } from '../components/ui';

const TOC = [
  { href: '#principles', label: '读数原则' },
  { href: '#sources', label: '数据来源' },
  { href: '#popularity', label: '关注度' },
  { href: '#maintenance', label: '维护活跃度' },
  { href: '#risk', label: '风险提示' },
  { href: '#completeness', label: '数据完整度' },
  { href: '#pipeline', label: '更新与存储' },
  { href: '#limits', label: '局限与边界' },
];

const METHOD_SOURCES = [
  {
    name: 'GitHub REST API',
    fields:
      'Stars、Forks、归档状态、最近非合并提交、近 30 天非合并提交、近 90 天 Issue/PR、长期开放 Issue、Release。',
    limits:
      '使用分页与重试；分页上限触发时标记为下限。Issue 列表会过滤 PR；不使用 updated_at 代替最近代码提交。',
  },
  {
    name: 'npm Download API',
    fields: '近 30 天下载、近 7 天 / 前 7 天对比、日下载序列、latest 版本、engines、DSH peer range。',
    limits:
      '只有 npm registry 的 repository 字段与 GitHub 仓库一致时才采信。Star、Fork、Release Asset 下载量不会冒充 npm 下载量。',
  },
  {
    name: 'OSV API',
    fields: '以 npm 包名 + latest 精确版本查询 querybatch，并读取公开漏洞详情。',
    limits:
      '只覆盖 OSV 已收录的公开记录。无法精确匹配或请求失败时显示“未完成漏洞检查”，不会显示“安全”或“零风险”。',
  },
];

const MAINTENANCE_ROWS = [
  ['最近代码提交', '30%', '距最近非合并提交：≤7d 100；≤14d 92；≤30d 82；≤60d 68；≤90d 55；≤180d 38；≤365d 20；更久 6。', '无提交日期时整项剔除。'],
  ['近 30 天非合并提交频率', '15%', '0 次=12，1=38，2–3=55，4–7=72，8–11=88，≥12=100。', '分页达到上限时按已取得的提交数作下限计分。'],
  ['近期 Issue 关闭率', '20%', '近 90 天创建的非 PR Issue 中当前已关闭比例 × 100。', '少于 5 条按 n/5 折减权重；0 条新 Issue 不参与，不扣分。'],
  ['开放 Issue 积压', '10%', '若当前有开放 Issue：100 − (开放 Issue 数 / 近 90 天新开 Issue 数) × 100。', '按近 90 天新开样本缩放权重；无开放 Issue 时不参与。'],
  ['近期 PR 合并率', '15%', '近 90 天创建 PR 中已合并比例 × 100。', '少于 3 条按 n/3 折减；PR 功能不可用时剔除，不记 0。'],
  ['最近版本发布', '10%', '≤30d 100；≤60d 92；≤90d 80；≤180d 62；≤365d 40；更久 18。', '没有稳定 Release 时不参与评分，不直接惩罚。'],
] as const;

function MethodSection({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}): JSX.Element {
  const [sectionNumber, ...sectionLabel] = index.split(' / ');
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-6">
      <p className="flex flex-wrap items-center gap-2">
        <span className="index">{sectionNumber}</span>
        <span className="text-2xs font-medium text-content-muted">{sectionLabel.join(' / ')}</span>
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-8 tracking-title text-content-primary">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-prose text-sm leading-6 text-content-secondary">{description}</p>
      ) : null}
      <div className="mt-5 max-w-prose">{children}</div>
    </section>
  );
}

function ScrollableTable({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="overflow-x-auto rounded-panel border border-line" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <p className="mt-2 text-2xs text-content-muted lg:hidden">表格较宽，可在表格内左右滑动查看。</p>
    </div>
  );
}

export function MethodPage(): JSX.Element {
  const { data } = useData();
  const [activeSection, setActiveSection] = useState<string>(TOC[0].href);

  useEffect(() => {
    function syncActiveSection(): void {
      let current = TOC[0].href;
      for (const item of TOC) {
        const section = document.getElementById(item.href.slice(1));
        if (section && section.getBoundingClientRect().top <= 180) current = item.href;
      }
      setActiveSection(current);
    }
    syncActiveSection();
    window.addEventListener('scroll', syncActiveSection, { passive: true });
    window.addEventListener('resize', syncActiveSection);
    return () => {
      window.removeEventListener('scroll', syncActiveSection);
      window.removeEventListener('resize', syncActiveSection);
    };
  }, []);

  return (
    <div id="top" className="page-enter mx-auto max-w-shell px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="lg:mx-auto lg:max-w-[1080px]">
      <div className="max-w-[48rem]">
        <p className="stamp">METHOD / v{SCORE_METHOD_VERSION}</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-[1.15] tracking-tightest text-content-primary md:text-4xl lg:text-[2.5rem]">
          指标不是判决书
        </h1>
        <p className="mt-4 max-w-[34em] text-base leading-7 text-content md:text-lg md:leading-[1.7]">
          DSH Plugin Health Monitor 用公开数据帮助阅读 DeepSeek Harness 插件生态。
          我们不输出“软件质量总分”，而是把<span className="text-content-primary">人气、维护活动、风险信号、数据完整度</span>
          拆成可解释、可追溯、可质疑的维度。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-2xs text-content-muted">
          <span className="rounded-chip border border-line bg-surface px-2 py-1 font-mono">方法 v{SCORE_METHOD_VERSION}</span>
          <span className="rounded-chip border border-line bg-surface px-2 py-1 font-mono">数据 schema v1</span>
          {data ? (
            <span className="rounded-chip border border-line bg-surface px-2 py-1">
              当前快照 {formatDateTime(data.latest.lastSuccessAt)}
            </span>
          ) : null}
          <span className="rounded-chip border border-line bg-surface px-2 py-1">数据来源：GitHub / npm / OSV</span>
        </div>
      </div>

      <details className="mt-6 rounded-panel border border-line bg-surface lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-content-primary">
          本页目录
          <span className="text-2xs text-content-muted">8 节</span>
        </summary>
        <nav className="grid grid-cols-2 gap-x-4 border-t border-line-hairline px-4 py-2" aria-label="方法页移动端目录">
          {TOC.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center text-xs text-content-secondary hover:text-brand-text"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </details>

      <div className="mt-8 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
        <aside className="hidden lg:block">
          <nav className="sticky top-[calc(var(--header-h)+16px)]" aria-label="方法页目录">
            <p className="stamp mb-3">ON THIS PAGE</p>
            <div className="space-y-0.5 border-l border-line pl-2">
              {TOC.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={activeSection === item.href ? 'location' : undefined}
                  className={
                    activeSection === item.href
                      ? '-ml-px block border-l-2 border-brand bg-brand-soft/50 px-2 py-1.5 text-xs font-semibold text-content-primary'
                      : '-ml-px block border-l-2 border-transparent px-2 py-1.5 text-xs text-content-secondary transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-content-primary'
                  }
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          <MethodSection
            id="principles"
            index="01 / 读数原则"
            title="四条读数原则"
            description="这些原则优先于任何具体权重。"
          >
            <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
              {[
                {
                  title: '相对评价，不是绝对标准',
                  text: '指数在本次收录的插件样本内计算。样本变化会改变排名，因此所有分数都显示数据快照时间与评分依据。',
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
                <div key={principle.title} className="bg-surface p-4">
                  <h3 className="text-base font-semibold text-content-primary">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-content-secondary">{principle.text}</p>
                </div>
              ))}
            </div>
          </MethodSection>

          <MethodSection
            id="sources"
            index="02 / 数据来源"
            title="数据从哪里来"
            description="只使用公开、可追溯的数据。项目不安装、不执行、不加载被检测插件的代码。"
          >
            <div className="space-y-3 md:hidden">
              {METHOD_SOURCES.map((source) => (
                <div key={source.name} className="border border-line bg-surface">
                  <h3 className="border-b border-line bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-content-primary">
                    {source.name}
                  </h3>
                  <dl className="divide-y divide-line-hairline">
                    <div className="px-4 py-3">
                      <dt className="text-2xs font-medium text-content-muted">字段与窗口</dt>
                      <dd className="mt-1 text-xs leading-5 text-content-secondary">{source.fields}</dd>
                    </div>
                    <div className="px-4 py-3">
                      <dt className="text-2xs font-medium text-content-muted">准确性边界</dt>
                      <dd className="mt-1 text-xs leading-5 text-content-secondary">{source.limits}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <ScrollableTable label="数据来源与准确性边界">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-line-strong bg-surface-subtle">
                      {['来源', '字段与窗口', '准确性边界'].map((heading) => (
                        <th
                          key={heading}
                          className={
                            heading === '来源'
                              ? 'sticky left-0 bg-surface-subtle px-4 py-2.5 text-2xs font-medium text-content-secondary'
                              : 'px-4 py-2.5 text-2xs font-medium text-content-secondary'
                          }
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-hairline text-xs leading-5">
                    {METHOD_SOURCES.map((source) => (
                      <tr key={source.name}>
                        <td className="sticky left-0 bg-surface px-4 py-3 align-top text-sm font-medium text-content-primary">
                          {source.name}
                        </td>
                        <td className="px-4 py-3 align-top text-content-secondary">{source.fields}</td>
                        <td className="px-4 py-3 align-top text-content-secondary">{source.limits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-content-muted">
              <ExternalTextLink href="https://docs.github.com/rest">GitHub REST 文档</ExternalTextLink>
              <ExternalTextLink href="https://github.com/npm/registry/blob/main/docs/download-counts.md">
                npm 下载统计口径
              </ExternalTextLink>
              <ExternalTextLink href="https://google.github.io/osv-scanner/">OSV 文档</ExternalTextLink>
            </div>
          </MethodSection>

          <MethodSection
            id="popularity"
            index="03 / 关注度"
            title="关注度"
            description="回答“有多少人在关注或使用”，不回答“好不好”。"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-content-primary">
                  <Calculator size={16} className="text-content-secondary" aria-hidden="true" /> 计算
                </h3>
                <div className="mt-3 space-y-3 text-base leading-7 text-content">
                  <p>
                    对每个有效值先做{' '}
                    <code className="rounded-chip border-l-2 border-content-primary bg-surface-subtle px-1.5 py-0.5 font-mono text-sm text-content-primary">
                      log10(1 + x)
                    </code>
                    ，再在本次样本内做 min-max 归一化到 0–100。这样可以压缩几个数量级间的差异，避免下载量直接淹没 Star。
                  </p>
                  <p>
                    同时有两种数据时：Stars 权重 <b className="text-content-primary">45%</b>，经核验的近 30 天下载量权重{' '}
                    <b className="text-content-primary">55%</b>。
                  </p>
                  <p>
                    缺少可靠下载量时，仅使用 Stars 的归一化位置，权重归一为 100%，证据覆盖降为 45%，评分依据降为“中”。
                    该插件仍可在详情页查看，但不会进入生态分布定位。
                  </p>
                </div>
              </div>
              <div className="border-l-2 border-content-primary bg-surface-subtle px-4 py-4">
                <p className="text-2xs font-medium text-content-muted">为什么不用绝对分</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">
                  当前 DSH 插件生态仍在快速变化。Star 与下载量受传播、发布节奏、镜像和统计口径影响，
                  用固定行业阈值会制造虚假精确感。因此本指数表达“在这批插件中的相对位置”，并随收录样本变化。
                </p>
                <p className="mt-3 border-t border-line-hairline pt-3 text-xs leading-5 text-warning">
                  缺少下载量时不会简单计 0；星级高但下载缺失的插件也不会被强行放入“高人气”象限。
                </p>
              </div>
            </div>
          </MethodSection>

          <MethodSection
            id="maintenance"
            index="04 / 维护活跃度"
            title="维护活跃度"
            description="最近有多少可观察的公开维护证据，而不是代码质量分。"
          >
            <div className="space-y-3 md:hidden">
              {MAINTENANCE_ROWS.map((row) => (
                <div key={row[0]} className="border border-line bg-surface">
                  <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-content-primary">{row[0]}</h3>
                    <span className="tnum font-mono text-xs text-content-secondary">{row[1]}</span>
                  </div>
                  <dl className="divide-y divide-line-hairline">
                    <div className="px-4 py-3">
                      <dt className="text-2xs font-medium text-content-muted">算法</dt>
                      <dd className="mt-1 text-xs leading-5 text-content-secondary">{row[2]}</dd>
                    </div>
                    <div className="px-4 py-3">
                      <dt className="text-2xs font-medium text-content-muted">缺失 / 小样本处理</dt>
                      <dd className="mt-1 text-xs leading-5 text-content-secondary">{row[3]}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <ScrollableTable label="维护活跃度分项、权重与算法">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-line-strong bg-surface-subtle">
                      {['分项', '设计权重', '算法', '缺失 / 小样本处理'].map((heading) => (
                        <th
                          key={heading}
                          className={
                            heading === '分项'
                              ? 'sticky left-0 bg-surface-subtle px-4 py-2.5 text-2xs font-medium text-content-secondary'
                              : 'px-4 py-2.5 text-2xs font-medium text-content-secondary'
                          }
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-hairline text-xs leading-5">
                    {MAINTENANCE_ROWS.map((row) => (
                      <tr key={row[0]}>
                        <td className="sticky left-0 bg-surface px-4 py-3 align-top text-sm font-medium text-content-primary">
                          {row[0]}
                        </td>
                        <td className="px-4 py-3 align-top font-mono text-content-secondary">{row[1]}</td>
                        <td className="px-4 py-3 align-top text-content-secondary">{row[2]}</td>
                        <td className="px-4 py-3 align-top text-content-secondary">{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
            <ul className="mt-4 divide-y divide-line-hairline border-y border-line text-sm leading-6 text-content-secondary">
              <li className="py-3">
                <b className="text-content-primary">证据覆盖 &lt; 45%</b> → 不输出维护分，显示“信息不足”。
              </li>
              <li className="py-3">
                <b className="text-content-primary">覆盖 ≥ 80% / 55%</b> → 高 / 依据一般，剩余为依据较少。
              </li>
              <li className="py-3">
                <b className="text-content-primary">提交多 ≠ 质量高</b>。维护分只描述公开活动，不进入“代码质量”判断。
              </li>
            </ul>
          </MethodSection>

          <MethodSection
            id="risk"
            index="05 / 风险提示"
            title="风险提示"
            description="按信号分级展示，不做风险总分，也不把“无记录”写成“安全”。"
          >
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-content-primary">
                  <ShieldAlert size={16} className="text-risk-high" aria-hidden="true" /> 触发规则
                </h3>
                <ul className="mt-3 divide-y divide-line-hairline border-t border-line text-sm leading-6 text-content-secondary">
                  {[
                    '仓库 archived → 高风险信号。',
                    '长期开放 Issue ≥ 20 高风险；≥ 5 需关注。',
                    '开放 Issue ≥ 100 或开放 / 近 90 天新开 ≥ 75% → 高风险；≥ 50 或 ≥ 50% → 需关注。',
                    'OSV 返回 high/critical → 高风险信号；其他公开记录 → 需关注。',
                    '未完成漏洞检查、无可靠 npm 数据、数据超过 2 天未更新 → 信息缺口。',
                    '若 OSV 未完成且无其他高风险信号 → 等级为“风险信息不完整”，不是“低风险”。',
                  ].map((rule) => (
                    <li key={rule} className="py-2.5">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-content-primary">
                  <GitBranch size={16} className="text-content-secondary" aria-hidden="true" /> 兼容性证据
                </h3>
                <p className="mt-3 text-sm leading-6 text-content-secondary">
                  详情页展示 npm 包声明的 Node engines、DSH peer range 与版本链接。
                  本项目不安装插件、不执行安装脚本、不做运行时兼容性测试。没有声明不等于不兼容，已声明也不等于已验证。
                </p>
                <p className="mt-3 border-t border-line-hairline pt-3 text-xs leading-5 text-content-muted">
                  Issue 与 PR 的统计窗口固定为 90 天，分母分别是窗口内创建的非 PR Issue 数和 PR 数。
                </p>
              </div>
            </div>
          </MethodSection>

          <MethodSection
            id="completeness"
            index="06 / 数据完整度"
            title="数据完整度"
            description="七个数据域，分别记录“是否真的取得”，避免把零值和缺失混在一起。"
          >
            <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {[
                '仓库基础信息',
                '提交活动',
                'Issue 处理',
                'PR 处理',
                '版本发布',
                'npm 下载',
                'OSV 漏洞检查',
              ].map((domain, index) => (
                <div key={domain} className="bg-surface px-3 py-3">
                  <span className="font-mono text-2xs text-content-muted">0{index + 1}</span>
                  <p className="mt-1 text-sm text-content-primary">{domain}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-base leading-7 text-content">
              完整度 = 可用数据域 / 7。它衡量的是“这份画像有多少证据”，不是插件质量。
              没有 Release、没有 Issue 或没有 npm 包是项目的真实状态，但仍会降低画像覆盖，因为对应维度无法形成证据。
            </p>
          </MethodSection>

          <MethodSection
            id="pipeline"
            index="07 / 更新与存储"
            title="更新、历史与部署"
            description="静态 JSON、独立 data 分支、GitHub Actions 与 Pages。"
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: <Database size={15} />, title: '采集', text: 'Node/TypeScript 采集 GitHub、npm、OSV，带超时、重试、分页与请求级缓存。' },
                { icon: <Calculator size={15} />, title: '计算', text: '统一评分模块生成快照、历史点与状态文件。历史点只在成功写入时追加。' },
                { icon: <GitBranch size={15} />, title: '存储', text: '源码在 main，数据在 data 分支。失败采集只更新 status，不覆盖最后成功快照。' },
                { icon: <RefreshCw size={15} />, title: '部署', text: 'GitHub Actions 构建并部署 Pages；前端只读取静态 JSON，不含任何 Token。' },
              ].map((step, index) => (
                <div key={step.title} className="border-t-2 border-metal-200 pt-3">
                  <div className="flex items-center justify-between text-content-secondary">
                    <span className="text-content-secondary">{step.icon}</span>
                    <span className="font-mono text-2xs text-content-muted">0{index + 1}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-content-primary">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-content-secondary">{step.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <p className="text-2xs font-medium text-content-muted">保留策略</p>
                <ul className="mt-2 divide-y divide-line-hairline border-t border-line text-sm leading-6 text-content-secondary">
                  <li className="py-2">每 6 小时尝试更新 GitHub 数据；npm 与 OSV 随同刷新。</li>
                  <li className="py-2">历史保留 90 天，单插件最多保留 400 个点；完整快照最多保留 120 份。</li>
                  <li className="py-2">连续执行两次更新不会清空历史；失败采集不生成新的 latest 快照。</li>
                  <li className="py-2">data 分支提交不会触发 main 的部署，避免工作流循环。</li>
                </ul>
              </div>
              <div>
                <p className="text-2xs font-medium text-content-muted">安全边界</p>
                <ul className="mt-2 divide-y divide-line-hairline border-t border-line text-sm leading-6 text-content-secondary">
                  <li className="py-2">GitHub Token 只存在于采集进程环境，不进入 Vite 前端构建。</li>
                  <li className="py-2">构建后扫描产物中的 token 形态，CI 失败即阻止交付。</li>
                  <li className="py-2">不安装、不执行第三方插件，不把 README/Issue 文本当指令。</li>
                  <li className="py-2">页面只展示静态 JSON，没有服务端运行时和用户凭据。</li>
                </ul>
              </div>
            </div>
          </MethodSection>

          <MethodSection
            id="limits"
            index="08 / 局限与边界"
            title="明确知道它不知道什么"
            description="这些限制不是免责声明，而是读分时必须带入的条件。"
          >
            <ol className="divide-y divide-line-hairline border-y border-line">
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
              ].map((limit, index) => (
                <li key={limit.title} className="grid gap-1 py-4 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-4">
                  <span className="font-mono text-2xs text-content-muted">0{index + 1}</span>
                  <div>
                    <h3 className="text-base font-semibold text-content-primary">{limit.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">{limit.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <InlineNotice tone="neutral" className="mt-4">
              发现口径问题、数据错误或有新的 DSH 插件要加入？请通过项目 GitHub 仓库提交 Issue 或 PR。
              配置文件位于 <code className="break-all rounded-chip bg-surface px-1 py-0.5 font-mono text-xs">config/plugins.json</code>。
            </InlineNotice>
          </MethodSection>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs text-content-muted">
              <BookOpen size={13} className="mr-1 inline" aria-hidden="true" />
              文档随代码版本迭代；当前方法版本 {SCORE_METHOD_VERSION}。
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary">
              <a href="#top" className="inline-flex items-center gap-1 hover:text-brand-text">
                <ArrowUp size={13} /> 回到顶部
              </a>
              <Link to="/" className="hover:text-brand-text">
                返回总览
              </Link>
              <a
                href="https://github.com/albert404s/dsh-plugin-health-monitor"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-brand-text"
              >
                源码 <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
