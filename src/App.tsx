import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { DataNotices } from './components/layout/DataNotices';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorState, LoadingState } from './components/ui';
import { useData } from './hooks/useData';
import { HomePage } from './pages/HomePage';
import { PluginLibraryPage } from './pages/PluginLibraryPage';
import { QuadrantPage } from './pages/QuadrantPage';
import { PluginDetailPage } from './pages/PluginDetailPage';
import { ComparePage } from './pages/ComparePage';
import { MethodPage } from './pages/MethodPage';
import { NotFoundPage } from './pages/NotFoundPage';

function DataReady(): JSX.Element {
  const { data, loading, error, refresh } = useData();
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (loading && !data || !data) return <div className="orbit-page"><LoadingState /></div>;
  return <Outlet />;
}
function HomeEntry(): JSX.Element {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const legacy = ['q', 'category', 'maintenance', 'risk', 'data', 'downloads', 'sort', 'page'].some(key => params.has(key));
  return legacy || hash === '#all-plugins' ? <Navigate replace to={'/plugins' + search} /> : <HomePage />;
}
function LegacyQuadrant(): JSX.Element {
  const { search, hash } = useLocation();
  return <Navigate replace to={'/ecosystem' + search + hash} />;
}
export default function App(): JSX.Element {
  return <ErrorBoundary><ScrollToTop /><a href="#main-content" className="sr-only-focusable fixed left-4 top-4 z-[90] rounded-control border border-brand-line bg-surface px-3 py-2 text-sm text-content-primary">跳至主要内容</a><Header /><div className="orbit-workspace"><DataNotices /><main id="main-content" tabIndex={-1}><Routes><Route path="/method" element={<MethodPage />} /><Route path="/quadrant" element={<LegacyQuadrant />} /><Route element={<DataReady />}><Route path="/" element={<HomeEntry />} /><Route path="/plugins" element={<PluginLibraryPage />} /><Route path="/ecosystem" element={<QuadrantPage />} /><Route path="/plugins/:pluginId" element={<PluginDetailPage />} /><Route path="/compare" element={<ComparePage />} /></Route><Route path="*" element={<NotFoundPage />} /></Routes></main><Footer /></div></ErrorBoundary>;
}
