import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  DataBundle,
  HistoryFile,
  LatestData,
  PluginRecord,
  StatusFile,
} from '../lib/types';
import { HISTORY_SCHEMA_VERSION, STATUS_SCHEMA_VERSION } from '../lib/types';
import { parseLatest, parseHistory, parseStatus } from '../lib/contracts';
import { isDataStale } from '../lib/format';

interface DataContextValue {
  data: DataBundle | null;
  loading: boolean;
  error: string | null;
  warnings: string[];
  stale: boolean;
  refresh: () => void;
  refreshedAt: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

const DATA_BASE = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}data/`;
const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${DATA_BASE}${file}`, {
    signal,
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${file} 请求失败（HTTP ${response.status}）`);
  }
  return (await response.json()) as T;
}

function fallbackStatus(latest: LatestData): StatusFile {
  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    runId: latest.runId,
    lastAttemptAt: latest.lastAttemptAt,
    lastSuccessAt: latest.lastSuccessAt,
    outcome: 'partial',
    sources: latest.sources,
    errorCount: 0,
    messages: ['status.json 不可用，状态由 latest.json 推导。'],
    nextRunHint: 'GitHub Actions 每 6 小时更新',
  };
}

export function DataProvider({ children }: { children: ReactNode }): JSX.Element {
  const [data, setData] = useState<DataBundle | null>(null);
  const previousData = useRef<DataBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [requestVersion, setRequestVersion] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    setLoading(true);
    setError(null);


    async function load(): Promise<void> {
      const nextWarnings: string[] = [];
      try {
        const loaded = await fetchJson<unknown>('latest.json', controller.signal);
        const latestResult = parseLatest(loaded, previousData.current?.latest);
        nextWarnings.push(...latestResult.warnings);
        const rawLatest = latestResult.data;

        let history: HistoryFile;
        try {
          const rawHistory = await fetchJson<unknown>('history.json', controller.signal);
          const historyResult = parseHistory(rawHistory);
          nextWarnings.push(...historyResult.warnings);
          history = historyResult.data;
        } catch (historyError) {
          if (controller.signal.aborted) throw historyError;
          nextWarnings.push(
            `趋势历史暂不可用：${historyError instanceof Error ? historyError.message : String(historyError)}`,
          );
          history = previousData.current?.history ?? {
            schemaVersion: HISTORY_SCHEMA_VERSION,
            updatedAt: rawLatest.generatedAt,
            retentionDays: 90,
            plugins: {},
          };
        }

        let status: StatusFile;
        try {
          const rawStatus = await fetchJson<unknown>('status.json', controller.signal);
          status = parseStatus(rawStatus);
        } catch (statusError) {
          if (controller.signal.aborted) throw statusError;
          nextWarnings.push(
            `运行状态暂不可用：${statusError instanceof Error ? statusError.message : String(statusError)}`,
          );
          status = fallbackStatus(rawLatest);
        }

        if (controller.signal.aborted) return;
        previousData.current = { latest: rawLatest, history, status };
        setData(previousData.current);
        setWarnings(nextWarnings);
        setRefreshedAt(new Date().toISOString());
      } catch (loadError) {
        if (controller.signal.aborted && !timedOut) return;
        setError(
          timedOut
            ? `请求超时（${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒），请检查网络后重试。`
            : loadError instanceof Error
              ? loadError.message
              : String(loadError),
        );
      } finally {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }

    void load();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [requestVersion]);

  const stale = useMemo(() => {
    if (!data) return false;
    return data.status.outcome === 'failed' || isDataStale(data.latest.lastSuccessAt);
  }, [data]);

  return (
    <DataContext.Provider
      value={{ data, loading, error, warnings, stale, refresh, refreshedAt }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside DataProvider');
  return context;
}

export function usePluginIndex(plugins: PluginRecord[] | undefined): Map<string, PluginRecord> {
  return useMemo(() => new Map((plugins ?? []).map((plugin) => [plugin.id, plugin])), [plugins]);
}

/** Only valid under DataReady: throws in development if a route forgot the guard. */
export function useLoadedData(): DataBundle {
  const { data } = useData();
  if (!data) throw new Error('useLoadedData called before data is available');
  return data;
}
