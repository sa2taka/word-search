import type { SearchMode, Lang } from '../../shared/types';

interface SearchPanelProps {
  query: string;
  mode: SearchMode;
  lang: Lang;
  onQueryChange: (query: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onLangChange: (lang: Lang) => void;
}

export function SearchPanel({
  query,
  mode,
  lang,
  onQueryChange,
  onModeChange,
  onLangChange,
}: SearchPanelProps) {
  return (
    <div className="search-panel">
      <div className="search-panel__input-wrapper">
        <input
          type="search"
          className="search-panel__input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search words..."
          aria-label="Search"
        />
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
            <option value="contains">Contains</option>
            <option value="prefix">Prefix</option>
            <option value="regex">Regex</option>
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
    </div>
  );
}
