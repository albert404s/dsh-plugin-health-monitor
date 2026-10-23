import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowUpRight, ChevronDown } from 'lucide-react';
import { useData } from '../hooks/useData';
import { SCORE_METHOD_VERSION } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { QuietHint } from '../components/quiet-hint';
import { ExternalTextLink } from '../components/ui';

const TOC = [
  { href: '#principles', label: '怎么选排序' },
  { href: '#sources', label: '数据从哪来' },
  { href: '#popularity', label: '关注度怎么算' },
  { href: '#maintenance', label: '维护活跃度怎么看' },
  { href: '#risk', label: '关注事项怎么看' },
  { href: '#completeness', label: '数据完整度' },
  { href: '#pipeline', label: '更新与暂停' },
  { href: '#limits', label: '使用边界' },
];

const SORT_OPTIONS = [
  ['Stars', '想看被更多人收藏的项目。按 GitHub Stars 从多到少排列。'],
  ['npm 下载', '想看近期下载较多的插件。按近 30 天下载量排列；下载次数不等于用户人数。'],
  ['维护活跃度', '想先看近期维护活动较多的项目。综合提交、Issue、PR 和版本发布。'],
  ['关注度', '想综合看收藏和下载。表示在已收录插件中的相对位置。'],
  ['最近更新', '想看最近改过代码的项目。按最近一次非合并代码提交的时间排列。'],
  ['数据完整度', '想先看资料更齐全的插件。资料多不代表插件更好。'],
  ['近 30 天提交', '想看最近代码改动频繁的项目。提交次数多不代表质量高。'],
  ['名称', '按插件名称排列，方便找到已知项目。'],
] as const;

const MAINTENANCE_ROWS = [
  ['最近代码提交', '约33.3%', '距最近非合并提交 ≤7 / 14 / 30 / 60 / 90 / 180 / 365 天，分别为 100 / 92 / 82 / 68 / 55 / 38 / 20 分；更久为 6 分。无日期时不参与。'],
  ['近 30 天提交', '约16.7%', '0 / 1 / 2–3 / 4–7 / 8–11 / ≥12 次，分别为 12 / 38 / 55 / 72 / 88 / 100 分。分页截断时，仅已取得 ≥12 次才可参与。'],
  ['Issue 关闭率', '约22.2%', '近 90 天创建的非 PR Issue 中，当前已关闭的比例 × 100。少于 5 条时，权重乘以样本数 / 5；没有新 Issue 时不参与。'],
  ['PR 合并率', '约16.7%', '近 90 天创建 PR 中已合并的比例 × 100。少于 3 条时，权重乘以样本数 / 3；没有新 PR 或功能不可用时不参与。'],
  ['最近版本发布', '约11.1%', '距最近 Release ≤30 / 60 / 90 / 180 / 365 天，分别为 100 / 92 / 80 / 62 / 40 分；更久为 18 分。无 Release 时不参与。'],
] as const;

function MethodSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-6">
      <span className="index">{index}</span>
      <h2 className="mt-2 text-xl font-semibold leading-8 tracking-title text-content-primary">{title}</h2>
      <div className="mt-4 text-sm leading-7 text-content-secondary">{children}</div>
    </section>
  );
}

function MoreDetails({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <details className="group mt-4 rounded-panel border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-content-primary">
        {title}
        <ChevronDown size={15} className="shrink-0 text-content-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-line-hairline px-4 py-4 text-sm leading-7 text-content-secondary">{children}</div>
    </details>
  );
}

export function MethodPage(): JSX.Element {
  const { data } = useData();
  const snapshotMethods = [...new Set(data?.latest.plugins.map(plugin=>plugin.scores.maintenance.methodVersion) ?? [])];
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
    <div id="top" className="orbit-page orbit-method page-enter">
      <div className="lg:mx-auto lg:max-w-[1080px]">
        <p className="stamp">METHOD / v{SCORE_METHOD_VERSION}</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-[1.15] tracking-tightest text-content-primary md:text-4xl lg:text-[2.5rem]">
          <QuietHint text="帮你读懂排序，找到适合自己的插件。">数据与方法</QuietHint>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-content-muted">
          <QuietHint text="用于比较公开活动，不代表插件质量。">
            <span className="rounded-chip border border-line bg-surface px-2 py-1 font-mono">规则 v{SCORE_METHOD_VERSION}</span>
          </QuietHint>
          {snapshotMethods.some(version=>version!==SCORE_METHOD_VERSION) ? <span>快照评分 {snapshotMethods.join(' / ')} · 新规则在下次采集后应用</span> : null}
          {data ? <span>数据更新于 {formatDateTime(data.latest.lastSuccessAt)}</span> : null}
        </div>

        <section className="panel mt-6 p-5" aria-labelledby="quick-guide-title">
          <h2 id="quick-guide-title" className="text-base font-semibold text-content-primary">快速指南</h2>
          <ol className="mt-4 grid gap-5 md:grid-cols-3">
            {[
              ['01 · 先搜功能', '在插件库搜索用途、名称或关键词。'],
              ['02 · 再看维护和用量', '看最近提交、下载和关注事项，选几个候选。'],
              ['03 · 对比后去仓库确认', '对比原始数据，再查看文档、安装要求和兼容版本。'],
            ].map(([title, text]) => (
              <li key={title}>
                <h3 className="text-sm font-medium text-brand-text">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">{text}</p>
              </li>
            ))}
          </ol>
          <Link to="/plugins" className="mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-text hover:text-content-primary">
            去插件库 <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </section>

        <details className="mt-6 rounded-panel border border-line bg-surface lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-content-primary">
            本页目录 <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <nav className="grid grid-cols-2 gap-x-4 border-t border-line-hairline px-4 py-2" aria-label="方法页移动端目录">
            {TOC.map((item) => <a key={item.href} href={item.href} className="flex min-h-11 items-center text-xs text-content-secondary hover:text-brand-text">{item.label}</a>)}
          </nav>
        </details>

        <div className="mt-8 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[200px_minmax(0,1fr)] xl:gap-12">
          <aside className="hidden lg:block">
            <nav className="sticky top-[calc(var(--header-h)+16px)]" aria-label="方法页目录">
              <p className="stamp mb-3">ON THIS PAGE</p>
              <div className="space-y-0.5 border-l border-line pl-2">
                {TOC.map((item) => (
                  <a key={item.href} href={item.href} aria-current={activeSection === item.href ? 'location' : undefined}
                    className={activeSection === item.href
                      ? '-ml-px block border-l-2 border-brand bg-brand-soft/50 px-2 py-2 text-xs font-semibold text-content-primary'
                      : '-ml-px block border-l-2 border-transparent px-2 py-2 text-xs text-content-secondary transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-content-primary'}>
                    {item.label}
                  </a>
                ))}
              </div>
            </nav>
          </aside>

          <div className="min-w-0 space-y-9">
            <MethodSection id="principles" index="01" title="怎么选排序">
              <dl className="divide-y divide-line-hairline">
                {SORT_OPTIONS.map(([label, text]) => (
                  <div key={label} className="grid gap-1 py-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:gap-4">
                    <dt className="font-medium text-content-primary">{label}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-6 text-content-muted">先筛选、再排序、最后取前 N 项。展示数量只改变当前榜单；不足 N 个时显示实际数量。没有数据的指标不当作 0 分。</p>
            </MethodSection>

            <MethodSection id="sources" index="02" title="数据从哪来">
              <dl className="grid gap-4 sm:grid-cols-3">
                {[
                  ['GitHub', '仓库收藏、代码提交、Issue、PR 和版本发布。'],
                  ['npm', '通过仓库地址核验的包，其近 30 天下载量和版本信息。'],
                  ['OSV', '与 npm 包及具体版本匹配的公开漏洞记录。'],
                ].map(([name, text]) => (
                  <div key={name} className="rounded-panel border border-line bg-surface p-4">
                    <dt className="font-semibold text-content-primary">{name}</dt>
                    <dd className="mt-2 text-sm leading-6">{text}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <ExternalTextLink href="https://docs.github.com/rest">GitHub 文档</ExternalTextLink>
                <ExternalTextLink href="https://github.com/npm/registry/blob/main/docs/download-counts.md">npm 下载统计</ExternalTextLink>
                <ExternalTextLink href="https://google.github.io/osv.dev/api/">OSV 文档</ExternalTextLink>
              </div>
            </MethodSection>

            <MethodSection id="popularity" index="03" title="关注度：综合看收藏和下载">
              <p>Stars 和近 30 天 npm 下载共同计算。它是这批插件中的相对位置，不是质量评分；新增插件后，分数也可能变化。</p>
              <MoreDetails title="查看计算方式">
                <p>有效数据先做 <code className="font-mono text-xs text-content-primary">log10(1 + x)</code>，再在本次收录的有效样本内归一化到 0–100，减小数量级差异。</p>
                <p>Stars 占 45%，经核验的 npm 下载占 55%。缺少可靠下载时，只按 Stars 计算，评分依据覆盖为 45%；不把缺失下载记为 0。</p>
                <p>生态分布只定位满足数据条件的插件。不同方法版本、参与分项或有效权重的分数不直接计算分差。</p>
              </MoreDetails>
            </MethodSection>

            <MethodSection id="maintenance" index="04" title="维护活跃度：近期有没有人在维护">
              <p>综合最近提交、提交次数、Issue 处理、PR 合并和版本发布。稳定的小插件可能很久不用修改，分数低时可以先去仓库了解原因。</p>
              <MoreDetails title="查看分项与权重">
                <div className="space-y-4">
                  {MAINTENANCE_ROWS.map(([label, weight, rule]) => (
                    <div key={label} className="border-b border-line-hairline pb-4 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-medium text-content-primary">{label}</h3>
                        <span className="font-mono text-xs text-content-muted">{weight}</span>
                      </div>
                      <p className="mt-1 text-xs leading-6">{rule}</p>
                    </div>
                  ))}
                </div>
                <p className="border-t border-line pt-3 text-xs leading-6">基础比重为 30:15:20:15:10，合计 90；表内百分比为归一化后的约值。开放 / 新开 Issue 比率只作提醒，不再重复参与评分。有效权重按可用数据和样本数调整后重新归一化。必要数据缺失、Issue / PR 分页不完整时，相应分项不参与。评分依据覆盖低于 45% 时不输出维护分；≥80% 为依据较充分，≥55% 为一般，其余为较少。</p>
                <p className="text-xs leading-6">提交、关闭 Issue 或合并 PR 都只表示活动，不能证明代码质量；Issue 关闭也不一定表示问题已解决。</p>
              </MoreDetails>
            </MethodSection>

            <MethodSection id="risk" index="05" title="关注事项：分开看，方便做决定">
              <dl className="divide-y divide-line-hairline">
                {[
                  ['维护提示', '仓库归档、Issue 长期未处理等。结合项目规模和具体问题判断。'],
                  ['公开漏洞', '查看受影响版本和修复版本。它与维护是否活跃是两件事。'],
                  ['数据缺口', '说明哪些信息没取得或需要更新，不代表插件有问题。'],
                ].map(([label, text]) => (
                  <div key={label} className="grid gap-1 py-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:gap-4">
                    <dt className="font-medium text-content-primary">{label}</dt><dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <MoreDetails title="查看提示规则">
                <ul className="list-disc space-y-2 pl-5 text-xs leading-6">
                  <li>仓库已归档、长期开放 Issue ≥20 条，会优先提示；长期开放 Issue ≥5 条时提示关注。</li>
                  <li>比例提醒需要完整 Issue 数据、近 90 天新开至少 5 条且当前开放至少 5 条，才检查 75% / 50% 等阈值；小样本不因比例升为明显提醒，原始数量照常显示。</li>
                  <li>OSV 高危 / 严重漏洞优先提示，其他公开漏洞也单独列出；按具体 npm 包版本匹配。</li>
                  <li>无可靠 npm 数据、漏洞检查未完成、插件数据超过 2 天未更新，标记为数据缺口。</li>
                </ul>
                <p className="text-xs leading-6">“未发现公开记录”只描述查询结果，不等于经过安全审计。没有安装或执行插件，也没有验证运行时兼容性。</p>
              </MoreDetails>
            </MethodSection>

            <MethodSection id="completeness" index="06" title="数据完整度：资料齐不齐">
              <p>仓库、提交、Issue、PR、版本、npm 和漏洞检查，共 7 类数据。可用的类别越多，完整度越高；它不参与判断插件好坏。</p>
              <MoreDetails title="完整度和评分依据覆盖有什么不同">
                <p><b className="font-medium text-content-primary">数据完整度</b> = 可用数据类别 / 7。真实的 0 和“未取得”分别记录；完整度取决于数据是否可用，不仅取决于有没有活动。</p>
                <p><b className="font-medium text-content-primary">评分依据覆盖</b>表示本次计算用了多少原定权重。缺失分项或 Issue / PR 样本太少时会降低，方便知道分数依据是否充足。</p>
              </MoreDetails>
            </MethodSection>

            <MethodSection id="pipeline" index="07" title="更新与暂停">
              <p>默认每 6 小时采集一次。网站会自动检查已发布的新数据；维护者也能手动采集。</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5">
                <li>打开“数据更新”，填写收录目标，按需调整每轮上限和预算。</li>
                <li>点“到 GitHub 更新数据”，登录有写入权限的账号，选择 main 和 refresh，照页面参数运行。</li>
                <li>等任务和发布完成，回到网站点“刷新已发布数据”。</li>
              </ol>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['展示数量', '这次榜单最多看多少个；不会增加收录。'],
                  ['收录目标', '希望插件库扩充到多少个；会查找并核验候选。'],
                  ['每轮上限', '这轮最多采集多少个；用于分批更新和控制请求。'],
                ].map(([title,text])=><div key={title} className="rounded-panel border border-line bg-surface p-3"><dt className="font-medium text-content-primary">{title}</dt><dd className="mt-1 text-xs leading-6">{text}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs text-content-muted">目标设为 50 不代表已有 50 个。发现不足、核验未通过或预算不足时，显示实际收录数和原因，保留已有数据。</p>
              <p className="mt-3 text-xs text-content-muted">暂停与恢复只影响后续自动采集，不取消正在运行的任务；暂停时仍可手动更新。“只保存设置”会等待下次采集。</p>
              <Link to="/#collection-controls" className="mt-4 inline-flex min-h-11 items-center gap-1 font-medium text-brand-text hover:text-content-primary">
                打开数据更新入口 <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              <MoreDetails title="刷新、调用限制和保存方式">
                <p>右上角的“刷新页面数据”只重读已发布快照，不触发采集。重新请求 GitHub、npm 和 OSV，需要使用“手动采集”。</p>
                <p>API 有调用限制。增加收录数量或频繁采集会增加请求，单个仓库还可能需要多次分页；“20 个插件”不等于“20 次请求”。暂停定时采集可以减少后续请求，但不能绕过平台限额。</p>
                <p>每次真实请求都计数，包括分页、重试和 304 验证；内存复用不计请求。触及总预算、GitHub 预留边界或平台限流时，保留整份上次快照。已有的跨轮 GitHub 公共数据缓存先向平台验证变化，不直接冒充新数据。</p>
                <p>源码保存在 main，数据保存在 data 分支。网页只读取静态 JSON，GitHub Token 不进入前端；历史保留 90 天，单插件最多 400 个点，完整快照最多 120 份。</p>
              </MoreDetails>
            </MethodSection>

            <MethodSection id="limits" index="08" title="使用边界">
              <p>先选功能，再参考数据。安装前请回到项目仓库确认文档、许可证和适用版本。</p>
              <MoreDetails title="还需要知道的几件事">
                <ul className="list-disc space-y-2 pl-5">
                  <li>榜单只比较已核验、已发布的 DSH 插件，不能代表 GitHub 全部插件；搜索结果需经过用途与仓库核验才会收录。</li>
                  <li>npm 下载包含重复安装和自动构建等，不等于真实用户数；没有 npm 包也不代表插件没人使用。</li>
                  <li>不同时间或不同样本的综合分不宜直接比较。想看实际变化，请优先看 Stars、下载和提交等原始记录。</li>
                  <li>项目只展示兼容性声明，不进行代码审查、安装测试或安全审计。</li>
                </ul>
                <p>发现数据有误或想推荐插件，可到 <ExternalTextLink href="https://github.com/albert404s/dsh-plugin-health-monitor/issues">项目 GitHub</ExternalTextLink> 提交反馈。</p>
              </MoreDetails>
            </MethodSection>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-content-muted">
              <span>计算规则 v{SCORE_METHOD_VERSION}</span>
              <div className="flex flex-wrap items-center gap-5">
                <a href="#top" className="inline-flex min-h-11 items-center gap-1 hover:text-brand-text"><ArrowUp size={13} aria-hidden="true" />回到顶部</a>
                <Link to="/" className="inline-flex min-h-11 items-center hover:text-brand-text">返回概览</Link>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
