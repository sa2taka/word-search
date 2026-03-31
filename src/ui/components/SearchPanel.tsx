import type { SearchMode, Lang } from '../../shared/types';
import { normalizeWord } from '../../shared/normalize';

interface SearchPanelProps {
  query: string;
  mode: SearchMode;
  lang: Lang;
  onQueryChange: (query: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onLangChange: (lang: Lang) => void;
}

const MODE_HELPERS: Record<SearchMode, string> = {
  wildcard: '? で任意の1文字にマッチ（例: は?い? → はいいろ）',
  contains: '入力した文字列を含む単語を検索',
  prefix: '入力した文字列で始まる単語を検索',
  regex: '正規表現で検索（例: ^.ね.$ → いねか）',
};

export function SearchPanel({
  query,
  mode,
  lang,
  onQueryChange,
  onModeChange,
  onLangChange,
}: SearchPanelProps) {
  const normalized = query.trim() ? normalizeWord(query.trim()) : '';
  const showNormalized = normalized !== '' && normalized !== query.trim();

  return (
    <div className="search-panel">
      <div className="search-panel__input-wrapper">
        <input
          type="search"
          className="search-panel__input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={mode === 'wildcard' ? 'は?い?' : 'Search words...'}
          aria-label="Search"
        />
        {showNormalized && (
          <span className="search-panel__normalized">{normalized}</span>
        )}
      </div>
      <div className="search-panel__controls">
        <div className="search-panel__control-group">
          <label className="search-panel__label" htmlFor="search-mode">
            Mode
          </label>
          <select
            id="search-mode"
            className="search-panel__select"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as SearchMode)}
          >
            <option value="wildcard">Wildcard</option>
            <option value="regex">Regex</option>
            <option value="contains">Contains</option>
            <option value="prefix">Prefix</option>
          </select>
        </div>
        <div className="search-panel__control-group">
          <label className="search-panel__label" htmlFor="search-lang">
            Lang
          </label>
          <select
            id="search-lang"
            className="search-panel__select"
            value={lang}
            onChange={(e) => onLangChange(e.target.value as Lang)}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <p className="search-panel__helper">{MODE_HELPERS[mode]}</p>
    </div>
  );
}
