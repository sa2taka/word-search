import type { EntryPair, Lang } from '../../shared/types';

interface WordSplitPanelProps {
  lang: Lang;
  query: string;
  pairs: EntryPair[];
  searching: boolean;
  onQueryChange: (query: string) => void;
  onLangChange: (lang: Lang) => void;
  onSearch: () => void;
}

export function WordSplitPanel({
  lang,
  query,
  pairs,
  searching,
  onQueryChange,
  onLangChange,
  onSearch,
}: WordSplitPanelProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="word-split-panel">
      <div className="word-split-panel__header">
        <p className="word-split-panel__description">
          入力した文字列を使う2つの単語の組み合わせを検索します。
          例: <code>ごんじじさ</code> → <strong>ごじ</strong> + <strong>さんじ</strong>
        </p>
      </div>
      <div className="word-split-panel__controls">
        <input
          type="search"
          className="word-split-panel__input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="ごんじじさ"
          aria-label="Word split query"
          maxLength={10}
        />
        <div className="word-split-panel__actions">
          <div className="word-split-panel__control-group">
            <label className="word-split-panel__label" htmlFor="word-split-lang">
              Lang
            </label>
            <select
              id="word-split-lang"
              className="word-split-panel__select"
              value={lang}
              onChange={(e) => onLangChange(e.target.value as Lang)}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            className="word-split-panel__btn"
            onClick={onSearch}
            disabled={searching || query.trim() === ''}
            aria-label="Search word split"
          >
            検索
          </button>
        </div>
      </div>
      <div className={`word-split-panel__results${searching ? ' word-split-panel__results--searching' : ''}`}>
        {!searching && pairs.length === 0 && query.trim() !== '' && (
          <p className="word-split-panel__empty">No results</p>
        )}
        {pairs.length > 0 && (
          <ul className="word-split-panel__list">
            {pairs.map(([a, b], i) => (
              <li key={i} className="word-split-panel__item">
                <span className="word-split-panel__word">{a.word}</span>
                <span className="word-split-panel__plus">+</span>
                <span className="word-split-panel__word">{b.word}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
