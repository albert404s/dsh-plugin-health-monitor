import { Boxes } from 'lucide-react';
import { PluginExplorer } from '../components/PluginExplorer';
import { useLoadedData } from '../hooks/useData';
export function PluginLibraryPage(): JSX.Element {
  const { latest } = useLoadedData();
  return <div className="orbit-page page-enter"><div className="orbit-page-head"><div><div className="orbit-kicker">发现合适的下一块拼图</div><h1 className="mt-3">插件库</h1><p>搜索功能、筛选维护状态，把值得了解的插件放在一起比较。</p></div><span className="orbit-chip"><Boxes size={14} />{latest.plugins.length} 个已核验插件</span></div><PluginExplorer plugins={latest.plugins} lastSuccessAt={latest.lastSuccessAt} /></div>;
}
