import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { useData } from '../hooks/useData';
import { formatDateTime } from '../lib/format';
import { defaultCollectionSettings, parseCollectionControl, parseCollectionSettings, type CollectionControl } from '../lib/collection-control';
import { parseCollectionReport, type CollectionReport } from '../lib/collection-report';

const WORKFLOW_URL = 'https://github.com/albert404s/dsh-plugin-health-monitor/actions/workflows/update-data.yml';
const actions = [
  { value: 'refresh', label: '重新采集一次', description: '由维护者手动获取 GitHub、npm 和公开漏洞数据。', icon: RefreshCw },
] as const;
type Action = typeof actions[number]['value'] | 'configure';
const defaults = defaultCollectionSettings();
const settingsFields = [
  { key: 'targetPlugins', label: '收录目标', min: 1, max: 1000, workflow: 'target_plugins' },
  { key: 'maxPlugins', label: '每轮最多采集', min: 1, max: 1000, workflow: 'max_plugins' },
  { key: 'maxRequests', label: '每轮请求上限', min: 1, max: 10000, workflow: 'max_requests' },
  { key: 'githubReserve', label: 'GitHub 预留额度', min: 0, max: 1000, workflow: 'github_reserve' },
] as const;
type SettingsDraft = Record<typeof settingsFields[number]['key'], string>;
function settingsDraft(settings: typeof defaults): SettingsDraft {
  return { targetPlugins: String(settings.targetPlugins), maxPlugins: String(settings.maxPlugins), maxRequests: String(settings.maxRequests), githubReserve: String(settings.githubReserve) };
}
function CollectionDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const dirtyDraft = useRef(false);
  const { data, loading, refresh, refreshedAt } = useData();
  const [action, setAction] = useState<Action>('refresh');
  const [control, setControl] = useState<CollectionControl | null>(null);
  const [report, setReport] = useState<CollectionReport | null>(null);
  const [controlError, setControlError] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [controlLoading, setControlLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(defaults));
  const updateDraft = (key: keyof SettingsDraft, value: string): void => {
    dirtyDraft.current = true;
    setDraft(previous => ({ ...previous, [key]: value }));
  };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => { dialog.current?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setControlLoading(true); setControlError(false); setSettingsError(false);
    async function load(): Promise<void> {
      const base = import.meta.env.BASE_URL.replace(/\/?$/, '/') + 'data/';
      const fetchFile = async (file: string): Promise<unknown> => {
        const response = await fetch(base+file, { signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'} });
        if (!response.ok) throw new Error('Published state unavailable');
        return response.json();
      };
      const results = await Promise.allSettled([fetchFile('collection-control.json'),fetchFile('collection-settings.json'),fetchFile('collection-report.json')]);
      if (disposed) return;
      try {
        if (results[0].status!=='fulfilled') throw new Error('Missing control');
        setControl(parseCollectionControl(results[0].value));
      } catch { setControlError(true); }
      try {
        if (results[1].status!=='fulfilled') throw new Error('Missing settings');
        const next = parseCollectionSettings(results[1].value);
        if (!dirtyDraft.current) setDraft(settingsDraft(next));
      } catch { setSettingsError(true); }
      setReport(results[2].status==='fulfilled' ? parseCollectionReport(results[2].value) : null);
      window.clearTimeout(timeout); setControlLoading(false);
    }
    void load();
    return () => { disposed=true;window.clearTimeout(timeout);controller.abort(); };
  }, [reload,refreshedAt]);
  const state = controlLoading ? '正在确认状态' : controlError || !control ? '仅手动采集 · 配置状态待确认' : '仅手动采集';
  let validation = '';
  try { parseCollectionSettings({...defaults,...draft}); } catch (error) { validation = error instanceof Error ? error.message : '请检查采集设置'; }
  const disabled = controlLoading || Boolean(validation);
  const collectedCount = data?.latest.plugins.length;
  const targetCount = /^\d+$/.test(draft.targetPlugins) ? Number(draft.targetPlugins) : null;
  return createPortal(<dialog ref={dialog} className="orbit-collection-dialog" aria-labelledby="collection-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="orbit-collection-heading"><div><p className="eyebrow">DATA CONTROL</p><h2 id="collection-title">数据更新</h2></div><button type="button" className="orbit-icon-button" onClick={onClose} aria-label="关闭数据更新"><X size={18}/></button></div>
    <div className="orbit-collection-content">
      <div className="orbit-collection-state"><span role="status">{state}</span><span>上次采集 {formatDateTime(data?.latest.lastSuccessAt)}</span></div>
      <fieldset className="orbit-collection-options"><legend className="sr-only">选择维护操作</legend>
        {actions.map(({value,label,description,icon:Icon})=><label key={value} className={action===value?'is-selected':''}><input type="radio" name="collection-action" value={value} checked={action===value} onChange={()=>setAction(value)}/><Icon size={17} aria-hidden="true"/><span><b>{label}</b><small>{description}</small></span></label>)}
      </fieldset>
      <div className="orbit-collection-target">
        <label>收录目标<input type="number" inputMode="numeric" min="1" max="1000" step="1" value={draft.targetPlugins} onChange={event=>updateDraft('targetPlugins', event.target.value)}/><span>个插件</span></label>
        <p>当前实际收录 <b>{collectedCount ?? '—'}</b> 个。{targetCount !== null && collectedCount !== undefined && targetCount > collectedCount
          ? `本次目标 ${targetCount} 个，将查找并核验更多 DSH 插件；不足目标时显示实际数量和原因。`
          : '修改目标后，需执行下方 GitHub 更新操作才会生效。'}</p>
        {targetCount !== null && collectedCount !== undefined && targetCount < collectedCount && <p>目标小于已有数量时保留已收录插件；如只想少看一些，请使用插件库的“展示数量”。</p>}
      </div>
      <details className="orbit-collection-settings"><summary>采集范围与预算</summary>
        <p>每轮上限控制本次采集多少个；收录目标控制插件库希望扩充到多少个。按最久未更新优先，分轮采集。</p>
        {settingsError && <p className="text-warning">未取得已保存的设置，以下为建议值。</p>}
        <div className="orbit-collection-fields">
          {settingsFields.filter(field=>field.key!=='targetPlugins').map(field=><label key={field.key}>{field.label}<input type="number" inputMode="numeric" min={field.min} max={field.max} step="1" value={draft[field.key]} onChange={event=>updateDraft(field.key, event.target.value)}/></label>)}
        </div>
        <p>请求数包含分页和重试；达到上限或预留边界后保留整份旧数据。与榜单展示数量无关。</p>
        <button type="button" className="orbit-prepare-settings" aria-pressed={action==='configure'} onClick={()=>setAction('configure')}>准备保存采集设置 <ArrowUpRight size={13}/></button>
      </details>
      {validation && <p role="alert" className="orbit-collection-validation text-warning">{validation}</p>}
      {report && <details className="orbit-collection-settings"><summary>上次采集记录 · {report.requestsMade} 次请求</summary>
        <dl className="orbit-collection-report">
          <div><dt>请求数 / 上限</dt><dd>{report.requestsMade} / {report.maxRequests}</dd></div>
          <div><dt>304 复用 / 内存命中</dt><dd>{report.revalidatedCacheHits} / {report.memoryCacheHits}</dd></div>
          <div><dt>已完成 / 本轮范围</dt><dd>{report.completedPlugins} / {report.selectedPlugins}</dd></div>
          <div><dt>GitHub 主额度剩余</dt><dd>{report.githubRemaining ?? '未取得'}</dd></div>
          <div><dt>记录时间</dt><dd>{formatDateTime(report.completedAt)}</dd></div>
          {report.discovery && <div><dt>核验收录 / 目标</dt><dd>{report.discovery.verified} / {report.discovery.target}</dd></div>}
          {report.discovery && <div><dt>本次新增 / 检查候选</dt><dd>{report.discovery.added} / {report.discovery.candidatesChecked}</dd></div>}
        </dl>
        {report.stopped && <p className="text-warning">本轮触及预算或平台限制，已保留上次有效快照。</p>}
        {report.discovery && report.discovery.verified < report.discovery.target && <p>未达到收录目标：已核验 {report.discovery.verified} 个，目标 {report.discovery.target} 个。{report.discovery.reason ?? '尚未找到足够的已核验 DSH 插件。'}</p>}
      </details>}
      <div className="orbit-collection-instructions">
        <p>在 GitHub 确认执行（需要仓库写入权限）：</p>
        <ol><li>点下方按钮，登录后点 <b>Run workflow</b>，分支选 <b>main</b>。</li><li>操作选 <code>{action}</code>，照下表填入参数，再点绿色 <b>Run workflow</b>。</li><li>等任务和发布完成，回到这里点“刷新已发布数据”。</li></ol>
        <dl className="orbit-collection-report" aria-label="本次 GitHub 工作流参数">{settingsFields.map(field=><div key={field.key}><dt>{field.workflow}</dt><dd>{draft[field.key] || '未填写'}</dd></div>)}</dl>
        <a className="btn-primary" href={disabled?undefined:WORKFLOW_URL} aria-disabled={disabled||undefined} tabIndex={disabled?-1:undefined} target="_blank" rel="noreferrer noopener">到 GitHub{action==='refresh'?'更新数据':'保存采集设置'} <ArrowUpRight size={15} aria-hidden="true"/></a>
        <p className="text-content-muted">{action==='refresh'?'保存本次设置并开始采集，完成后自动发布。填入目标不会立即改变已收录数量。':'仅保存设置，不立即采集；下次更新仍需手动执行。'}</p>
      </div>
      <div className="orbit-collection-footer"><span>已在 GitHub 完成操作？</span><button type="button" onClick={()=>{refresh();setReload(value=>value+1);}} disabled={loading||controlLoading}><RefreshCw size={14} aria-hidden="true"/>刷新已发布数据</button></div>
      <p className="orbit-collection-note">采集只由维护者手动触发。普通访客可查看数据；重新采集和更改设置需要仓库写入权限。仅选择操作不会提交更改。</p>
    </div>
  </dialog>,document.body);
}
export function CollectionControls(): JSX.Element {
  const [open,setOpen]=useState(false);
  const location=useLocation();
  useEffect(()=>{if(location.hash==='#collection-controls')setOpen(true);},[location.hash]);
  return <><button type="button" id="collection-controls" className="orbit-icon-button orbit-collection-trigger" title="手动更新数据" aria-label="数据更新" aria-haspopup="dialog" onClick={()=>setOpen(true)}><SlidersHorizontal size={17} aria-hidden="true"/><span>数据更新</span></button>{open&&<CollectionDialog onClose={()=>setOpen(false)}/>}</>;
}
