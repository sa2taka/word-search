import { useCallback, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { SearchPanel } from './components/SearchPanel';
import { ResultList } from './components/ResultList';
import { StatusDisplay } from './components/StatusDisplay';
import { ErrorRecovery } from './components/ErrorRecovery';
import { LicensePage } from './components/LicensePage';
import { Footer } from './components/Footer';
import { WordSplitPanel } from './components/WordSplitPanel';
import { CrossSearchPanel } from './components/CrossSearchPanel';
import { useSearchWorker } from './hooks/useSearchWorker';
import { META_URL, DEFAULT_PAGE_SIZE } from '../shared/constants';
import type { SearchMode, Lang } from '../shared/types';

type Page = 'search' | 'word-split' | 'cross-search' | 'license';

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
  const [mode, setMode] = useState<SearchMode>('wildcard');
  const [lang, setLang] = useState<Lang>('ja');
  const [offset, setOffset] = useState(0);
  const [wordSplitQuery, setWordSplitQuery] = useState('');
  const [wordSplitLang, setWordSplitLang] = useState<Lang>('ja');
  const [crossQuery1, setCrossQuery1] = useState('');
  const [crossQuery2, setCrossQuery2] = useState('');
  const [crossLang, setCrossLang] = useState<Lang>('ja');

  const { search, resetDb, retry, dbStatus, version, progress, sources, items, totalApprox, error, searching, wordSplitPairs, wordSplit, crossSearchPairs, crossSearch } = worker;

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
    setQuery('');
    setOffset(0);
  }, []);

  const handleLangChange = useCallback((value: Lang) => {
    setLang(value);
    setOffset(0);
  }, []);

  const handleReset = useCallback(() => {
    resetDb();
  }, [resetDb]);

  const handleWordSplitSearch = useCallback(() => {
    if (dbStatus !== 'ready' || wordSplitQuery.trim() === '') return;
    wordSplit({ lang: wordSplitLang, query: wordSplitQuery.trim(), limit: DEFAULT_PAGE_SIZE });
  }, [dbStatus, wordSplitQuery, wordSplitLang, wordSplit]);

  const handleWordSplitQueryChange = useCallback((value: string) => {
    setWordSplitQuery(value);
  }, []);

  const handleCrossSearch = useCallback(() => {
    if (dbStatus !== 'ready' || crossQuery1.trim() === '' || crossQuery2.trim() === '') return;
    crossSearch({ lang: crossLang, query1: crossQuery1.trim(), query2: crossQuery2.trim(), limit: DEFAULT_PAGE_SIZE });
  }, [dbStatus, crossQuery1, crossQuery2, crossLang, crossSearch]);

  if (page === 'license') {
    return (
      <>
        <Header dbStatus={dbStatus} version={version} />
        <LicensePage sources={sources} onBack={() => setPage('search')} />
        <Footer onNavigateToLicense={() => setPage('license')} onResetStorage={handleReset} />
      </>
    );
  }

  const showStatus = dbStatus !== 'ready';
  const showError = dbStatus === 'error' && error != null;

  return (
    <>
      <Header dbStatus={dbStatus} version={version} />
      <nav className="app-tabs">
        <button
          className={`app-tabs__btn${page === 'search' ? ' app-tabs__btn--active' : ''}`}
          onClick={() => setPage('search')}
        >
          検索
        </button>
        <button
          className={`app-tabs__btn${page === 'word-split' ? ' app-tabs__btn--active' : ''}`}
          onClick={() => setPage('word-split')}
          data-testid="tab-word-split"
        >
          単語分割
        </button>
        <button
          className={`app-tabs__btn${page === 'cross-search' ? ' app-tabs__btn--active' : ''}`}
          onClick={() => setPage('cross-search')}
          data-testid="tab-cross-search"
        >
          クロス検索
        </button>
      </nav>
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
      {page === 'search' && (
        <>
          <SearchPanel
            query={query}
            mode={mode}
            lang={lang}
            onQueryChange={handleQueryChange}
            onModeChange={handleModeChange}
            onLangChange={handleLangChange}
          />
          <ResultList
            items={items}
            query={query}
            searching={searching}
            offset={offset}
            totalApprox={totalApprox}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setOffset}
          />
        </>
      )}
      {page === 'word-split' && (
        <WordSplitPanel
          lang={wordSplitLang}
          query={wordSplitQuery}
          pairs={wordSplitPairs}
          searching={searching}
          onQueryChange={handleWordSplitQueryChange}
          onLangChange={setWordSplitLang}
          onSearch={handleWordSplitSearch}
        />
      )}
      {page === 'cross-search' && (
        <CrossSearchPanel
          lang={crossLang}
          query1={crossQuery1}
          query2={crossQuery2}
          pairs={crossSearchPairs}
          searching={searching}
          onQuery1Change={setCrossQuery1}
          onQuery2Change={setCrossQuery2}
          onLangChange={setCrossLang}
          onSearch={handleCrossSearch}
        />
      )}
      <Footer onNavigateToLicense={() => setPage('license')} onResetStorage={handleReset} />
    </>
  );
}
