import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, Pause, Play, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { useData } from '../hooks/useData';
import { formatDateTime } from '../lib/format';
import { defaultCollectionSettings, parseCollectionControl, parseCollectionSettings, type CollectionControl } from '../lib/collection-control';
import { parseCollectionReport, type CollectionReport } from '../lib/collection-report';

const WORKFLOW_URL = 'https://github.com/albert404s/dsh-plugin-health-monitor/actions/workflows/update-data.yml';
const actions = [
  { value: 'refresh', label: '重新采集一次', description: '重新获取 GitHub、npm 和公开漏洞数据。', icon: RefreshCw },
  { value: 'pause', label: '暂停自动采集', description: '跳过后续定时采集，仍可手动更新。', icon: Pause },
  { value: 'resume', label: '恢复自动采集', description: '恢复每 6 小时一次的采集。', icon: Play },
] as const;
type Action = typeof actions[number]['value'] | 'configure';
const defaults = defaultCollectionSettings();
function CollectionDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const { data, loading, refresh, refreshedAt } = useData();
  const [action, setAction] = useState<Action>('refresh');
  const [control, setControl] = useState<CollectionControl | null>(null);
  const [report, setReport] = useState<CollectionReport | null>(null);
  const [controlError, setControlError] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [controlLoading, setControlLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState({maxPlugins:String(defaults.maxPlugins),maxRequests:String(defaults.maxRequests),githubReserve:String(defaults.githubReserve)});
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
        setDraft({maxPlugins:String(next.maxPlugins),maxRequests:String(next.maxRequests),githubReserve:String(next.githubReserve)});
      } catch { setSettingsError(true); }
      setReport(results[2].status==='fulfilled' ? parseCollectionReport(results[2].value) : null);
      window.clearTimeout(timeout); setControlLoading(false);
    }
    void load();
    return () => { disposed=true;window.clearTimeout(timeout);controller.abort(); };
  }, [reload,refreshedAt]);
  const state = controlLoading ? '正在确认状态' : controlError || !control ? '自动采集状态待确认' : control.automaticPaused ? '自动采集已暂停' : '自动采集 · 每 6 小时';
  let validation = '';
  try { parseCollectionSettings({...defaults,...draft}); } catch (error) { validation = error instanceof Error ? error.message : '请检查采集设置'; }
  const disabled = action === 'configure' && Boolean(validation);
  return createPortal(<dialog ref={dialog} className="orbit-collection-dialog" aria-labelledby="collection-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="orbit-collection-heading"><div><p className="eyebrow">DATA CONTROL</p><h2 id="collection-title">数据更新</h2></div><button type="button" className="orbit-icon-button" onClick={onClose} aria-label="关闭数据更新"><X size={18}/></button></div>
    <div className="orbit-collection-content">
      <div className="orbit-collection-state"><span role="status">{state}</span><span>上次采集 {formatDateTime(data?.latest.lastSuccessAt)}</span></div>
      <fieldset className="orbit-collection-options"><legend className="sr-only">选择维护操作</legend>
        {actions.map(({value,label,description,icon:Icon})=><label key={value} className={action===value?'is-selected':''}><input type="radio" name="collection-action" value={value} checked={action===value} onChange={()=>setAction(value)}/><Icon size={17} aria-hidden="true"/><span><b>{label}</b><small>{description}</small></span></label>)}
      </fieldset>
      <details className="orbit-collection-settings"><summary>采集范围与预算</summary>
        <p>当前已收录 {data?.latest.plugins.length ?? '—'} 个插件。按最久未更新优先，分轮采集。</p>
        {settingsError && <p className="text-warning">未取得已保存的设置，以下为建议值。</p>}
        <div className="orbit-collection-fields">
          {([{key:'maxPlugins',label:'每轮最多采集',min:1,max:1000},{key:'maxRequests',label:'每轮请求上限',min:1,max:10000},{key:'githubReserve',label:'GitHub 预留额度',min:0,max:1000}] as const).map(field=><label key={field.key}>{field.label}<input type="number" inputMode="numeric" min={field.min} max={field.max} step="1" value={draft[field.key]} onChange={event=>setDraft(previous=>({...previous,[field.key]:event.target.value}))}/></label>)}
        </div>
        <p>请求数包含分页和重试；达到上限或预留边界后保留整份旧数据。与榜单展示数量无关。</p>
        <button type="button" className="orbit-prepare-settings" aria-pressed={action==='configure'} onClick={()=>setAction('configure')}>准备保存采集设置 <ArrowUpRight size={13}/></button>
        {action==='configure' && validation && <p role="alert" className="text-warning">{validation}</p>}
      </details>
      {report && <details className="orbit-collection-settings"><summary>上次采集记录 · {report.requestsMade} 次请求</summary>
        <dl className="orbit-collection-report">
          <div><dt>请求数 / 上限</dt><dd>{report.requestsMade} / {report.maxRequests}</dd></div>
          <div><dt>304 复用 / 内存命中</dt><dd>{report.revalidatedCacheHits} / {report.memoryCacheHits}</dd></div>
          <div><dt>已完成 / 本轮范围</dt><dd>{report.completedPlugins} / {report.selectedPlugins}</dd></div>
          <div><dt>GitHub 主额度剩余</dt><dd>{report.githubRemaining ?? '未取得'}</dd></div>
          <div><dt>记录时间</dt><dd>{formatDateTime(report.completedAt)}</dd></div>
        </dl>
        {report.stopped && <p className="text-warning">本轮触及预算或平台限制，已保留上次有效快照。</p>}
      </details>}
      <div className="orbit-collection-instructions">
        <p>维护者登录 GitHub 后确认执行：</p>
        <ol><li>点 <b>Run workflow</b>，分支选择 <b>main</b>。</li><li>操作选择 <code>{action}</code>{action==='configure'?'，填入下方数值':''}，再点绿色 <b>Run workflow</b>。</li></ol>
        {action==='configure' && <dl className="orbit-collection-report"><div><dt>max_plugins</dt><dd>{draft.maxPlugins}</dd></div><div><dt>max_requests</dt><dd>{draft.maxRequests}</dd></div><div><dt>github_reserve</dt><dd>{draft.githubReserve}</dd></div></dl>}
        <a className="btn-primary" href={disabled?undefined:WORKFLOW_URL} aria-disabled={disabled||undefined} tabIndex={disabled?-1:undefined} target="_blank" rel="noreferrer noopener">到 GitHub{action==='refresh'?'重新采集':action==='pause'?'暂停自动采集':action==='resume'?'恢复自动采集':'保存采集设置'} <ArrowUpRight size={15} aria-hidden="true"/></a>
        <p className="text-content-muted">{action==='refresh'?'完成后会自动发布新数据，通常需要几分钟。':action==='configure'?'仅保存后续采集设置，不立即采集或改变自动开关。':'只更改后续定时计划，不取消正在运行的采集。'}</p>
      </div>
      <div className="orbit-collection-footer"><span>已在 GitHub 完成操作？</span><button type="button" onClick={()=>{refresh();setReload(value=>value+1);}} disabled={loading||controlLoading}><RefreshCw size={14} aria-hidden="true"/>刷新已发布数据</button></div>
      <p className="orbit-collection-note">普通访客可查看数据；重新采集和更改设置需要仓库写入权限。仅选择操作不会提交更改。</p>
    </div>
  </dialog>,document.body);
}
export function CollectionControls(): JSX.Element {
  const [open,setOpen]=useState(false);
  const location=useLocation();
  useEffect(()=>{if(location.hash==='#collection-controls')setOpen(true);},[location.hash]);
  return <><button type="button" id="collection-controls" className="orbit-icon-button orbit-collection-trigger" title="数据更新与自动采集" aria-label="数据更新" aria-haspopup="dialog" onClick={()=>setOpen(true)}><SlidersHorizontal size={17} aria-hidden="true"/><span>数据更新</span></button>{open&&<CollectionDialog onClose={()=>setOpen(false)}/>}</>;
}
