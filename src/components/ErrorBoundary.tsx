import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';
import { buttonClasses } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled rendering error', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-2xl items-center px-5">
          <div className="panel w-full p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-control border border-danger-line bg-danger-soft text-danger">
              <AlertOctagon size={20} />
            </span>
            <h1 className="mt-5 text-2xl font-semibold text-content-primary">页面渲染出现异常</h1>
            <p className="mt-2 text-base leading-6 text-content-secondary">
              数据可能不完整或页面状态异常。已保留错误边界，没有向外部发送任何内容。
            </p>
            <pre className="mt-4 overflow-x-auto rounded-control border border-line bg-surface-subtle p-3 font-mono text-xs text-content-secondary">
              {this.state.message}
            </pre>
            <button type="button" className={buttonClasses('primary', 'mt-5')} onClick={() => window.location.reload()}>
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
