import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

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
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-rose/20 bg-rose/5 text-rose">
              <AlertOctagon size={20} />
            </span>
            <h1 className="mt-5 text-lg font-semibold text-ink-100">页面渲染出现异常</h1>
            <p className="mt-2 text-sm leading-6 text-ink-300">
              数据可能不完整或页面状态异常。已保留错误边界，没有向外部发送任何内容。
            </p>
            <pre className="mt-4 overflow-x-auto rounded border border-ink-700 bg-ink-900 p-3 font-mono text-[11px] text-ink-300">
              {this.state.message}
            </pre>
            <button
              type="button"
              className="mt-5 rounded-md bg-signal px-3.5 py-2 text-xs font-medium text-white hover:bg-signal-strong"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
