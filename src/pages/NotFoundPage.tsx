import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui';

export function NotFoundPage(): JSX.Element {
  return (
    <div className="page-enter mx-auto max-w-shell px-4 py-10 md:px-6 md:py-16">
      <div className="grid gap-8 border-t border-content-primary pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-12">
        <div className="min-w-0">
          <p className="stamp">ERROR / 404</p>
          <p className="dot-matrix mt-4 text-[2rem] leading-none md:text-[2.5rem]" aria-hidden="true">
            SIGNAL LOST
          </p>
          <p className="readout mt-5 text-[4rem] leading-none text-content-primary md:text-[6rem]">404</p>
          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.15] tracking-tightest text-content-primary md:text-[2.5rem]">
            这条路径没有数据
          </h1>
          <p className="mt-3 max-w-[34em] text-base leading-7 text-content-secondary">
            页面可能已被移动。总览、四象限、插件详情和对比页都在主导航中。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ButtonLink to="/">
              <ArrowLeft size={14} aria-hidden="true" /> 返回总览
            </ButtonLink>
            <Link
              to="/method"
              className="inline-flex min-h-10 items-center text-sm text-content-secondary underline-offset-4 hover:text-brand-text hover:underline"
            >
              查看方法
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center border border-dashed border-line-strong bg-surface-subtle py-16">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-chip border border-line-control bg-surface text-content-secondary">
              <Compass size={22} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <p className="mt-4 font-mono text-micro uppercase tracking-stamp text-content-muted">
              ROUTE NOT FOUND
            </p>
            <div className="tick-ruler mx-auto mt-3 w-40" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
