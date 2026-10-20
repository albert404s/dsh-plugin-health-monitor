import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto flex min-h-[62vh] max-w-xl flex-col justify-center px-4 py-20">
      <span className="flex h-12 w-12 items-center justify-center rounded-control border border-line bg-surface-subtle text-content-secondary">
        <Compass size={22} strokeWidth={1.6} />
      </span>
      <p className="mt-5 font-mono text-2xs text-content-muted">404 / 页面不存在</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-display text-content-primary">这条路径没有数据</h1>
      <p className="mt-3 text-base leading-6 text-content-secondary">
        页面可能已被移动。总览、四象限、插件详情和对比页都在主导航中。
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink to="/">
          <ArrowLeft size={14} /> 返回总览
        </ButtonLink>
        <Link to="/method" className="text-sm text-content-secondary hover:text-accent">
          查看方法
        </Link>
      </div>
    </div>
  );
}
