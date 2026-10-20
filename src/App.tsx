import { Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { DataNotices } from './components/layout/DataNotices';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorState, LoadingState } from './components/ui';
import { useData } from './hooks/useData';
import { HomePage } from './pages/HomePage';
import { QuadrantPage } from './pages/QuadrantPage';
import { PluginDetailPage } from './pages/PluginDetailPage';
import { ComparePage } from './pages/ComparePage';
import { MethodPage } from './pages/MethodPage';
import { NotFoundPage } from './pages/NotFoundPage';

function DataReady(): JSX.Element {
  const { loading, error, refresh } = useData();
  if (loading) {
    return (
      <div className="mx-auto max-w-shell px-4 md:px-6">
        <LoadingState />
      </div>
    );
  }
  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }
  return <Outlet />;
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-4 top-4 z-50 rounded-md border border-signal/40 bg-ink-900 px-3 py-2 text-xs text-ink-100"
      >
        跳至主要内容
      </a>
      <Header />
      <DataNotices />
      <main id="main-content">
        <Routes>
          <Route path="/method" element={<MethodPage />} />
          <Route element={<DataReady />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/quadrant" element={<QuadrantPage />} />
            <Route path="/plugins/:pluginId" element={<PluginDetailPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </ErrorBoundary>
  );
}
