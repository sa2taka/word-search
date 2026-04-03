import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DbStatus,
  EntryRow,
  ErrorCode,
  Lang,
  SearchMode,
  WorkerRequest,
  WorkerResponse,
} from '../../shared/types';
import SearchWorker from '../../worker/search-worker?worker';

interface SearchParams {
  mode: SearchMode;
  lang: Lang;
  query: string;
  limit: number;
  offset: number;
}

interface WorkerError {
  code: ErrorCode;
  message: string;
}

interface UseSearchWorkerReturn {
  dbStatus: DbStatus;
  version?: string;
  progress?: number;
  sources: import('../../shared/types').DictSource[];
  items: EntryRow[];
  totalApprox: number;
  error: WorkerError | null;
  searching: boolean;
  retry: () => void;
  search: (params: SearchParams) => void;
  cancel: () => void;
  checkUpdate: (metaUrl: string) => void;
  updateDb: (metaUrl: string) => void;
  resetDb: () => void;
}

export function useSearchWorker(metaUrl: string): UseSearchWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [dbStatus, setDbStatus] = useState<DbStatus>('idle');
  const [version, setVersion] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | undefined>();
  const [sources, setSources] = useState<import('../../shared/types').DictSource[]>([]);
  const [items, setItems] = useState<EntryRow[]>([]);
  const [totalApprox, setTotalApprox] = useState(0);
  const [error, setError] = useState<WorkerError | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let disposed = false;
    let gotMessage = false;

    const worker = new SearchWorker();
    workerRef.current = worker;

    const timeout = setTimeout(() => {
      if (!disposed && !gotMessage) {
        setError({ code: 'DB_OPEN_FAILED', message: 'Worker did not respond within 10s' });
        setDbStatus('error');
      }
    }, 10_000);

    worker.onerror = (e) => {
      if (disposed) return;
      const detail = e instanceof ErrorEvent
        ? `${e.message} (${e.filename}:${e.lineno})`
        : 'Worker failed to start';
      setError({ code: 'DB_OPEN_FAILED', message: detail });
      setDbStatus('error');
    };

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (disposed) return;
      gotMessage = true;
      clearTimeout(timeout);
      const data = e.data;
      switch (data.type) {
        case 'STATUS':
          setDbStatus(data.status);
          if (data.version != null) setVersion(data.version);
          if (data.progress != null) setProgress(data.progress);
          if (data.sources != null) setSources(data.sources);
          if (data.status === 'ready') setError(null);
          break;
        case 'SEARCH_RESULT':
          if (data.requestId === requestIdRef.current) {
            setItems(data.items);
            if (data.totalApprox != null) setTotalApprox(data.totalApprox);
            setSearching(false);
          }
          break;
        case 'ERROR':
          setError({ code: data.code, message: data.message });
          if (!data.requestId) {
            setDbStatus('error');
          }
          break;
      }
    };

    // Worker 作成と INIT 送信を同一 useEffect 内で行う
    // StrictMode で cleanup → 再実行されても、新しい Worker に確実に INIT が届く
    worker.postMessage({ type: 'INIT', metaUrl } satisfies WorkerRequest);

    return () => {
      disposed = true;
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [metaUrl, retryKey]);

  const post = useCallback((msg: WorkerRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const search = useCallback(
    (params: SearchParams) => {
      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      setSearching(true);
      post({ type: 'SEARCH', ...params, requestId });
    },
    [post],
  );

  const cancel = useCallback(() => {
    if (requestIdRef.current) {
      post({ type: 'CANCEL', requestId: requestIdRef.current });
      requestIdRef.current = null;
    }
  }, [post]);

  const checkUpdate = useCallback(
    (metaUrl: string) => post({ type: 'CHECK_UPDATE', metaUrl }),
    [post],
  );

  const updateDb = useCallback(
    (metaUrl: string) => post({ type: 'UPDATE_DB', metaUrl }),
    [post],
  );

  const resetDb = useCallback(() => post({ type: 'RESET_DB' }), [post]);

  const retry = useCallback(() => {
    setDbStatus('idle');
    setError(null);
    setRetryKey((k) => k + 1);
  }, []);

  return {
    dbStatus,
    version,
    progress,
    items,
    totalApprox,
    sources,
    error,
    searching,
    retry,
    search,
    cancel,
    checkUpdate,
    updateDb,
    resetDb,
  };
}
