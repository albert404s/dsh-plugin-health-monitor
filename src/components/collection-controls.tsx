import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ArrowUpRight, Pause, Play, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { useData } from '../hooks/useData';
import { formatDateTime } from '../lib/format';
import { parseCollectionControl, type CollectionControl } from '../lib/collection-control';

const WORKFLOW_URL = 'https://github.com/albert404s/dsh-plugin-health-monitor/actions/workflows/update-data.yml';
const actions = [
  { value: 'refresh', label: '重新采集一次', description: '重新获取 GitHub、npm 和公开漏洞数据。', icon: RefreshCw },
  { value: 'pause', label: '暂停自动采集', description: '跳过后续定时采集，仍可手动更新。', icon: Pause },
  { value: 'resume', label: '恢复自动采集', description: '恢复每 6 小时一次的采集。', icon: Play },
] as const;
type Action = typeof actions[number]['value'];

function CollectionDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const { data, loading, refresh, refreshedAt } = useData();
  const [action, setAction] = useState<Action>('refresh');
  const [control, setControl] = useState<CollectionControl | null>(null);
  const [controlError, setControlError] = useState(false);
  const [controlLoading, setControlLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setControlLoading(true);
    setControlError(false);
    async function loadControl(): Promise<void> {
      try {
        const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
        const response = await fetch(base + 'data/collection-control.json', { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Control state unavailable');
        const next = parseCollectionControl(await response.json());
        if (!controller.signal.aborted) setControl(next);
      } catch {
        if (!disposed) setControlError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setControlLoading(false);
      }
    }
    void loadControl();
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [reload, refreshedAt]);
  const state = controlLoading ? '正在确认状态' : controlError || !control ? '自动采集状态待确认' : control.automaticPaused ? '自动采集已暂停' : '自动采集 · 每 6 小时';
  return createPortal(
    <dialog ref={dialog} className="orbit-collection-dialog" aria-labelledby="collection-title" onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="orbit-collection-heading">
        <div><p className="eyebrow">DATA CONTROL</p><h2 id="collection-title">数据更新</h2></div>
        <button type="button" className="orbit-icon-button" onClick={onClose} aria-label="关闭数据更新"><X size={18} /></button>
      </div>
      <div className="orbit-collection-content">
        <div className="orbit-collection-state">
          <span role="status">{state}</span>
          <span>上次采集 {formatDateTime(data?.latest.lastSuccessAt)}</span>
        </div>
        <fieldset className="orbit-collection-options">
          <legend className="sr-only">选择维护操作</legend>
          {actions.map(({ value, label, description, icon: Icon }) => <label key={value} className={action === value ? 'is-selected' : ''}>
            <input type="radio" name="collection-action" value={value} checked={action === value} onChange={() => setAction(value)} />
            <Icon size={17} aria-hidden="true" /><span><b>{label}</b><small>{description}</small></span>
          </label>)}
        </fieldset>
        <div className="orbit-collection-instructions">
          <p>维护者登录 GitHub 后确认执行：</p>
          <ol><li>点 <b>Run workflow</b>，分支选择 <b>main</b>。</li><li>操作选择 <code>{action}</code>，再点绿色 <b>Run workflow</b>。</li></ol>
          <a className="btn-primary" href={WORKFLOW_URL} target="_blank" rel="noreferrer noopener">到 GitHub{action === 'refresh' ? '重新采集' : action === 'pause' ? '暂停自动采集' : '恢复自动采集'} <ArrowUpRight size={15} aria-hidden="true" /></a>
          <p className="text-content-muted">{action === 'refresh' ? '完成后会自动发布新数据，通常需要几分钟。' : '只更改后续定时计划，不取消正在运行的采集。'}</p>
        </div>
        <div className="orbit-collection-footer">
          <span>已在 GitHub 完成操作？</span>
          <button type="button" onClick={() => { refresh(); setReload(value => value + 1); }} disabled={loading || controlLoading}><RefreshCw size={14} aria-hidden="true" />刷新已发布数据</button>
        </div>
        <p className="orbit-collection-note">普通访客可查看数据；重新采集和更改计划需要仓库写入权限。仅选择操作不会提交更改。</p>
      </div>
    </dialog>, document.body);
}

export function CollectionControls(): JSX.Element {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { if (location.hash === '#collection-controls') setOpen(true); }, [location.hash]);
  return <>
    <button type="button" id="collection-controls" className="orbit-icon-button orbit-collection-trigger" title="数据更新与自动采集" aria-label="数据更新" aria-haspopup="dialog" onClick={() => setOpen(true)}><SlidersHorizontal size={17} aria-hidden="true" /><span>数据更新</span></button>
    {open && <CollectionDialog onClose={() => setOpen(false)} />}
  </>;
}
