import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight, BookOpen, Boxes, ChevronRight, Github, LayoutDashboard, Menu, Orbit, RefreshCw, Search, X } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDateTime, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';

const navigation = [
  { to: '/', label: '概览', icon: LayoutDashboard, caption: '观察整个生态' },
  { to: '/plugins', label: '插件库', icon: Boxes, caption: '找到你的下一块拼图' },
  { to: '/ecosystem', label: '生态分布', icon: Orbit, caption: '发现不同的维护轨迹' },
  { to: '/compare', label: '插件对比', icon: ArrowLeftRight, caption: '把证据放在一起' },
  { to: '/method', label: '数据与方法', icon: BookOpen, caption: '每个结论都有来处' },
];
export function OrbitMark({ size = 34 }: { size?: number }): JSX.Element {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="7" fill="currentColor" fillOpacity=".12" stroke="currentColor" /><ellipse cx="20" cy="20" rx="18" ry="9" transform="rotate(-35 20 20)" stroke="currentColor" strokeWidth="1.2" /><path d="M12 4a18 18 0 0 1 20 28" stroke="currentColor" strokeOpacity=".35" /><circle cx="32" cy="10" r="2.7" fill="currentColor" /><circle cx="20" cy="20" r="2" fill="currentColor" /></svg>;
}
export function Header(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const drawer = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { data, loading, refresh, stale, error } = useData();
  const title = navigation.find(item => item.to === location.pathname)?.label ?? (location.pathname.startsWith('/plugins/') ? '插件详情' : '页面不存在');
  const degraded = stale || Boolean(error) || data?.status.outcome !== 'success';
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const items = drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!items?.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); menuButton.current?.focus({ preventScroll: true }); };
  }, [open]);
  function search(event: FormEvent): void {
    event.preventDefault();
    navigate('/plugins' + (query.trim() ? '?q=' + encodeURIComponent(query.trim()) : ''));
    setQuery('');
  }
  const links = <>{navigation.map(({ to, label, icon: Icon, caption }, index) =>
    <NavLink key={to} to={to} end={to === '/'} title={label} className={({ isActive }) => cn('orbit-nav-link', index === 4 && 'orbit-nav-help', isActive && 'is-active')}>
      <Icon size={19} strokeWidth={1.65} aria-hidden="true" /><span className="orbit-nav-copy"><span>{label}</span><small>{caption}</small></span><ChevronRight size={13} className="orbit-nav-arrow" aria-hidden="true" />
    </NavLink>)}</>;
  return <>
    <aside className="orbit-sidebar" aria-label="工作台侧栏">
      <Link to="/" className="orbit-brand" aria-label="ORBIT · DSH 插件观测站首页"><OrbitMark /><span className="orbit-brand-copy"><b>ORBIT<span className="orbit-brand-dot">.</span></b><small>DSH 插件观测站</small></span></Link>
      <div className="orbit-sidebar-label">你的生态观测台</div><nav aria-label="主导航" className="orbit-nav">{links}</nav>
      <div className="orbit-sidebar-bottom"><div className="orbit-orbit-mini" aria-hidden="true"><OrbitMark size={70} /></div><p>从公开数据<br />看见维护的轨迹。</p><span>独立观察 · 真实证据</span><a href="https://github.com/albert404s/dsh-plugin-health-monitor" target="_blank" rel="noreferrer noopener"><Github size={14} /> GitHub 项目 <ArrowUpRight size={13} /></a></div>
    </aside>
    <header className="orbit-topbar">
      <button ref={menuButton} className="orbit-icon-button orbit-menu-button" aria-label="打开导航菜单" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(true)}><Menu size={19} /></button>
      <div className="orbit-breadcrumb"><span>工作台</span><ChevronRight size={13} /><strong>{title}</strong></div>
      <form onSubmit={search} role="search" className="orbit-top-search"><Search size={15} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="全站搜索插件" placeholder="搜索名称、功能或仓库…" /><span>↵</span></form>
      <div className="orbit-top-actions"><details className="orbit-source-status"><summary title="查看采集状态"><span className={cn('orbit-live-dot', degraded && 'is-warning')} /><span>{loading ? '正在加载' : data ? formatRelative(data.latest.lastSuccessAt) + '更新' : '数据未加载'}</span></summary><div className="orbit-status-popover"><b>数据快照</b><p>{formatDateTime(data?.latest.lastSuccessAt)}</p>{data ? Object.entries(data.status.sources).map(([source, status]) => <p key={source}><span>{source === 'github' ? 'GitHub' : source.toUpperCase()}</span><span>{status.status === 'ok' ? '正常' : '需核查'}</span></p>) : <p>正在获取公开快照</p>}<Link to="/method">了解数据更新 <ArrowUpRight size={13} /></Link></div></details><button onClick={refresh} disabled={loading} aria-label="重新加载数据快照" title="重新加载数据快照" className="orbit-icon-button"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></div>
    </header>
    {open && <div className="orbit-drawer-backdrop" onClick={() => setOpen(false)}><div ref={drawer} className="orbit-drawer" role="dialog" aria-modal="true" aria-label="导航菜单" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between p-5"><span className="flex items-center gap-3 text-brand"><OrbitMark /><b className="text-xl tracking-widest">ORBIT</b></span><button className="orbit-icon-button" aria-label="关闭导航菜单" onClick={() => setOpen(false)}><X size={18} /></button></div><nav id="mobile-nav" aria-label="移动端导航" className="orbit-nav">{links}</nav></div></div>}
  </>;
}
