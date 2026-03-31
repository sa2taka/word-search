import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SearchPanel } from './components/SearchPanel';
import { ResultList } from './components/ResultList';
import { StatusDisplay } from './components/StatusDisplay';
import { ErrorRecovery } from './components/ErrorRecovery';
import { LicensePage } from './components/LicensePage';
import { Footer } from './components/Footer';
import { useSearchWorker } from './hooks/useSearchWorker';
import { META_URL, DEFAULT_PAGE_SIZE } from '../shared/constants';
import type { SearchMode, Lang } from '../shared/types';

type Page = 'search' | 'license';

function statusMessage(status: string, progress?: number, errorMessage?: string): string {
  switch (status) {
    case 'idle':
      return 'Initializing...';
    case 'downloading':
      return progress != null ? `Downloading dictionary... ${progress}%` : 'Downloading dictionary...';
    case 'ready':
      return 'Ready';
    case 'updatable':
      return 'Update available';
    case 'error':
      return errorMessage ? `Error: ${errorMessage}` : 'An error occurred';
    default:
      return '';
  }
}

export function App() {
  const worker = useSearchWorker(META_URL);
  const [page, setPage] = useState<Page>('search');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('contains');
  const [lang, setLang] = useState<Lang>('ja');
  const [offset, setOffset] = useState(0);

  const { search, resetDb, retry, dbStatus, version, progress, items, totalApprox, error } = worker;

  useEffect(() => {
    if (dbStatus !== 'ready' || query.trim() === '') return;
    search({ mode, lang, query: query.trim(), limit: DEFAULT_PAGE_SIZE, offset });
  }, [query, mode, lang, offset, dbStatus, search]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setOffset(0);
  }, []);

  const handleModeChange = useCallback((value: SearchMode) => {
    setMode(value);
    setOffset(0);
  }, []);

  const handleLangChange = useCallback((value: Lang) => {
    setLang(value);
    setOffset(0);
  }, []);

  const handleReset = useCallback(() => {
    resetDb();
  }, [resetDb]);

  if (page === 'license') {
    return (
      <>
        <Header dbStatus={dbStatus} version={version} />
        <LicensePage sources={[]} onBack={() => setPage('search')} />
        <Footer onNavigateToLicense={() => setPage('license')} />
      </>
    );
  }

  const showStatus = dbStatus !== 'ready';
  const showError = dbStatus === 'error' && error != null;

  return (
    <>
      <Header dbStatus={dbStatus} version={version} />
      <SearchPanel
        query={query}
        mode={mode}
        lang={lang}
        onQueryChange={handleQueryChange}
        onModeChange={handleModeChange}
        onLangChange={handleLangChange}
      />
      {showError && error && (
        <ErrorRecovery
          message={error.message}
          onRetry={retry}
          onReset={handleReset}
        />
      )}
      {showStatus && !showError && (
        <StatusDisplay
          status={dbStatus}
          message={statusMessage(dbStatus, progress, error?.message)}
          progress={progress}
        />
      )}
      <ResultList
        items={items}
        offset={offset}
        totalApprox={totalApprox}
        pageSize={DEFAULT_PAGE_SIZE}
        onPageChange={setOffset}
      />
      <Footer onNavigateToLicense={() => setPage('license')} />
    </>
  );
}
