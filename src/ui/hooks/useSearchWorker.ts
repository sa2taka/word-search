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
  items: EntryRow[];
  totalApprox: number;
  error: WorkerError | null;
  init: (metaUrl: string) => void;
  search: (params: SearchParams) => void;
  cancel: () => void;
  checkUpdate: (metaUrl: string) => void;
  updateDb: (metaUrl: string) => void;
  resetDb: () => void;
}

export function useSearchWorker(): UseSearchWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const [dbStatus, setDbStatus] = useState<DbStatus>('idle');
  const [version, setVersion] = useState<string | undefined>();
  const [progress, setProgress] = useState<number | undefined>();
  const [items, setItems] = useState<EntryRow[]>([]);
  const [totalApprox, setTotalApprox] = useState(0);
  const [error, setError] = useState<WorkerError | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../../worker/search-worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data;
      switch (data.type) {
        case 'STATUS':
          setDbStatus(data.status);
          if (data.version != null) setVersion(data.version);
          if (data.progress != null) setProgress(data.progress);
          if (data.status === 'ready') setError(null);
          break;
        case 'SEARCH_RESULT':
          if (data.requestId === requestIdRef.current) {
            setItems(data.items);
            setTotalApprox(data.totalApprox ?? 0);
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

    return () => {
      worker.terminate();
    };
  }, []);

  const post = useCallback((msg: WorkerRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  const init = useCallback(
    (metaUrl: string) => post({ type: 'INIT', metaUrl }),
    [post],
  );

  const search = useCallback(
    (params: SearchParams) => {
      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
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

  return {
    dbStatus,
    version,
    progress,
    items,
    totalApprox,
    error,
    init,
    search,
    cancel,
    checkUpdate,
    updateDb,
    resetDb,
  };
}
