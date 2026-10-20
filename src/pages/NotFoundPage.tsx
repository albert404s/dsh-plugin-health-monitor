import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto flex min-h-[62vh] max-w-xl flex-col justify-center px-4 py-20">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/60 text-ink-300">
        <Compass size={22} strokeWidth={1.6} />
      </span>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">404 / Route not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink-100">这条路径没有数据</h1>
      <p className="mt-3 text-sm leading-6 text-ink-300">
        页面可能已被移动。排行榜、四象限、插件详情和对比页都在主导航中。
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ButtonLink to="/">
          <ArrowLeft size={12} /> 返回排行榜
        </ButtonLink>
        <Link to="/method" className="px-2 text-xs text-ink-400 hover:text-ink-100">
          查看方法
        </Link>
      </div>
    </div>
  );
}
