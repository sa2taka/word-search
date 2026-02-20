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

const STATUS_MESSAGES: Record<string, string> = {
  idle: 'Dictionary not downloaded. Initializing...',
  downloading: 'Downloading dictionary...',
  ready: 'Ready',
  updatable: 'Update available',
  error: 'An error occurred',
};

export function App() {
  const worker = useSearchWorker();
  const [page, setPage] = useState<Page>('search');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('contains');
  const [lang, setLang] = useState<Lang>('ja');
  const [offset, setOffset] = useState(0);

  const { init, search, resetDb, dbStatus, version, progress, items, totalApprox, error } = worker;

  useEffect(() => {
    init(META_URL);
  }, [init]);

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

  const handleRetry = useCallback(() => {
    init(META_URL);
  }, [init]);

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
          onRetry={handleRetry}
          onReset={handleReset}
        />
      )}
      {showStatus && !showError && (
        <StatusDisplay
          status={dbStatus}
          message={STATUS_MESSAGES[dbStatus] ?? ''}
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
