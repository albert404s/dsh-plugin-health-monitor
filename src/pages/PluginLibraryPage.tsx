import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, Boxes, X } from 'lucide-react';
import { PluginExplorer } from '../components/PluginExplorer';
import { useLoadedData } from '../hooks/useData';
import { buttonClasses } from '../components/ui';
import { QuietHint } from '../components/quiet-hint';

export function PluginLibraryPage(): JSX.Element {
  const { latest } = useLoadedData();
  const [selected, setSelected] = useState<string[]>([]);
  const compared = latest.plugins.filter((plugin) => selected.includes(plugin.id));
  function toggle(id: string): void {
    setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : previous.length < 2 ? [...previous, id] : previous);
  }
  return (
    <div className="orbit-page page-enter">
      <div className="orbit-page-head">
        <div><div className="orbit-kicker">LIBRARY</div><h1 className="mt-3"><QuietHint text="搜索与筛选插件，勾选两个候选即可对比。">插件库</QuietHint></h1></div>
        <span className="orbit-chip"><Boxes size={14} aria-hidden="true" />{latest.plugins.length} 个已核验插件</span>
      </div>
      <PluginExplorer plugins={latest.plugins} lastSuccessAt={latest.lastSuccessAt} comparedIds={selected} onToggleCompare={toggle} />
      {compared.length > 0 && (
        <aside className="orbit-compare-dock" aria-label="对比选择">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><ArrowLeftRight size={18} className="text-brand-text" aria-hidden="true" /><span className="text-xs text-content-secondary" role="status">已选 {compared.length}/2</span>
            {compared.map((plugin) => <button className="orbit-chip max-w-[240px] hover:border-brand-line" key={plugin.id} onClick={() => toggle(plugin.id)} aria-label={'移除对比 ' + plugin.name}><span className="truncate">{plugin.name}</span><X size={13} className="shrink-0" aria-hidden="true" /></button>)}
          </div>
          <div className="flex items-center gap-3"><button type="button" className="min-h-10 text-xs text-content-secondary hover:text-content-primary" onClick={() => setSelected([])}>清空</button>{compared.length === 2 ? <Link to={'/compare?a=' + encodeURIComponent(selected[0]) + '&b=' + encodeURIComponent(selected[1])} className={buttonClasses('primary')}>开始对比 <ArrowRight size={14} aria-hidden="true" /></Link> : <span className="text-xs text-content-secondary">再选一个插件</span>}</div>
        </aside>
      )}
    </div>
  );
}
