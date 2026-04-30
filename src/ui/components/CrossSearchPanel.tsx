import type { EntryPair, Lang } from '../../shared/types';

interface CrossSearchPanelProps {
  lang: Lang;
  query1: string;
  query2: string;
  pairs: EntryPair[];
  searching: boolean;
  onQuery1Change: (query: string) => void;
  onQuery2Change: (query: string) => void;
  onLangChange: (lang: Lang) => void;
  onSearch: () => void;
}

export function CrossSearchPanel({
  lang,
  query1,
  query2,
  pairs,
  searching,
  onQuery1Change,
  onQuery2Change,
  onLangChange,
  onSearch,
}: CrossSearchPanelProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  const isDisabled = searching || query1.trim() === '' || query2.trim() === '';

  return (
    <div className="cross-search-panel">
      <div className="cross-search-panel__header">
        <p className="cross-search-panel__description">
          2つのパターンで数字変数を共有する単語ペアを検索します。
          例: <code>は112</code> ＋ <code>12がみ</code> → <strong>はいいろ</strong> + <strong>いろがみ</strong>
        </p>
      </div>
      <div className="cross-search-panel__controls">
        <div className="cross-search-panel__inputs">
          <input
            type="search"
            className="cross-search-panel__input"
            value={query1}
            onChange={(e) => onQuery1Change(e.target.value)}
            onKeyDown={handleKey}
            placeholder="は112"
            aria-label="Cross search pattern 1"
          />
          <span className="cross-search-panel__separator">＋</span>
          <input
            type="search"
            className="cross-search-panel__input"
            value={query2}
            onChange={(e) => onQuery2Change(e.target.value)}
            onKeyDown={handleKey}
            placeholder="12がみ"
            aria-label="Cross search pattern 2"
          />
        </div>
        <div className="cross-search-panel__actions">
          <div className="cross-search-panel__control-group">
            <label className="cross-search-panel__label" htmlFor="cross-search-lang">
              Lang
            </label>
            <select
              id="cross-search-lang"
              className="cross-search-panel__select"
              value={lang}
              onChange={(e) => onLangChange(e.target.value as Lang)}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            className="cross-search-panel__btn"
            onClick={onSearch}
            disabled={isDisabled}
            aria-label="Search cross pattern"
          >
            検索
          </button>
        </div>
      </div>
      <div className={`cross-search-panel__results${searching ? ' cross-search-panel__results--searching' : ''}`}>
        {!searching && pairs.length === 0 && (query1.trim() !== '' || query2.trim() !== '') && (
          <p className="cross-search-panel__empty">No results</p>
        )}
        {pairs.length > 0 && (
          <ul className="cross-search-panel__list">
            {pairs.map(([a, b], i) => (
              <li key={i} className="cross-search-panel__item">
                <span className="cross-search-panel__word">{a.word}</span>
                <span className="cross-search-panel__plus">+</span>
                <span className="cross-search-panel__word">{b.word}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
