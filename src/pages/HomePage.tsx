import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { useLoadedData } from '../hooks/useData';
import { QuadrantChart } from '../components/charts/QuadrantChart';
import { StatsStrip } from '../components/StatsStrip';
import { RankList } from '../components/RankList';
import { AttentionPanel, ChangesPanel } from '../components/Insights';
import { OrbitScene } from '../components/OrbitScene';
import { hasQuadrantData } from '../lib/scoring';

export function HomePage(): JSX.Element {
  const { latest, history } = useLoadedData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const positioned = latest.plugins.filter(hasQuadrantData).length;
  function search(event: FormEvent): void {
    event.preventDefault();
    navigate('/plugins' + (query.trim() ? '?q=' + encodeURIComponent(query.trim()) : ''));
  }
  return (
    <div className="orbit-page page-enter">
      <section className="orbit-hero" aria-labelledby="home-title">
        <div className="orbit-hero-copy">
          <p className="orbit-kicker"><span className="orbit-status-dot" /> OPEN SOURCE, IN ORBIT</p>
          <h1 id="home-title">发现好插件。<br />看清它的<span>运行轨迹。</span></h1>
          <p className="orbit-hero-intro">从关注度到维护活动，让散落的公开数据成为选择的依据。探索 {latest.plugins.length} 个 DSH 插件，找到你的下一块拼图。</p>
          <form className="orbit-hero-search" onSubmit={search} role="search" aria-label="搜索插件">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="hero-search">搜索插件名称、功能或仓库</label>
            <input id="hero-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="试试「工作流」或插件名称" autoComplete="off" />
            <button type="submit" aria-label="查找插件"><ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <div className="orbit-hero-links">
            <Link to="/plugins">探索插件库 <ArrowUpRight size={14} aria-hidden="true" /></Link>
            <Link to="/method">了解数据与方法 <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <OrbitScene />
        </div>
        <section className="panel orbit-hero-chart" aria-labelledby="home-map-title">
          <div className="orbit-chart-heading">
            <div><p className="orbit-kicker">ECOSYSTEM RADAR</p><h2 id="home-map-title">每一颗星，都有自己的轨迹</h2><p>关注度 × 维护活跃度</p></div>
            <span className="orbit-chart-count"><b>{positioned}</b> / {latest.plugins.length}<small>已定位插件</small></span>
          </div>
          <QuadrantChart plugins={latest.plugins} height={326} showLabels={false} showLegend={false} showUnpositioned={false} />
          <div className="orbit-chart-footer"><span>气泡大小表示 Stars · 点击查看插件</span><Link to="/ecosystem">探索生态分布 <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        </section>
      </section>
      <StatsStrip data={latest} />
      <section className="mt-9" aria-labelledby="featured-title">
        <div className="orbit-section-heading"><div><p className="orbit-kicker">SIGNALS WORTH EXPLORING</p><h2 id="featured-title" className="orbit-section-title">从线索出发，而不是只看分数</h2></div><Link to="/plugins">全部插件 <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        <div className="orbit-rank-grid mt-4">
          <div className="panel p-5"><RankList eyebrow="POPULARITY" title="社区关注" description="Stars 与经核验的 npm 下载量" plugins={latest.plugins} metric="popularity" limit={4} /></div>
          <div className="panel p-5"><RankList eyebrow="MAINTENANCE" title="持续维护" description="提交、Issue、PR 与版本发布的公开证据" plugins={latest.plugins} metric="maintenance" limit={4} /></div>
        </div>
      </section>
      <section className="orbit-signal-grid mt-5" aria-label="关注事项与近期变化">
        <div className="panel p-5"><AttentionPanel plugins={latest.plugins} /></div>
        <div className="panel p-5"><ChangesPanel plugins={latest.plugins} history={history} /></div>
      </section>
      <div className="orbit-method-note mt-6"><Sparkles size={16} aria-hidden="true" /><p>保持好奇，也保留判断。维护活跃度反映公开活动；软件质量、兼容性和实际安全性仍需结合使用场景核实。</p><Link to="/method">如何理解这些数据 <ArrowRight size={14} aria-hidden="true" /></Link></div>
    </div>
  );
}
