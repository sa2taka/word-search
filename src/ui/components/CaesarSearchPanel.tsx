import type { CaesarMatch, Lang } from '../../shared/types';

interface CaesarSearchPanelProps {
  lang: Lang;
  query: string;
  matches: CaesarMatch[];
  searching: boolean;
  onQueryChange: (query: string) => void;
  onLangChange: (lang: Lang) => void;
  onSearch: () => void;
}

function formatShift(shift: number): string {
  return shift > 0 ? `+${shift}` : `${shift}`;
}

export function CaesarSearchPanel({
  lang,
  query,
  matches,
  searching,
  onQueryChange,
  onLangChange,
  onSearch,
}: CaesarSearchPanelProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="caesar-search-panel">
      <div className="caesar-search-panel__header">
        <p className="caesar-search-panel__description">
          五十音順に n 文字ずらすと別の単語になる組み合わせを検索します。
          例: <code>けいゆ</code> → <strong>+3</strong> → <strong>しおり</strong>
        </p>
        <p className="caesar-search-panel__note">
          ＋は後ろ、−は前にずらします。末尾までずらすと先頭へ循環し、濁点・半濁点は無視します。
        </p>
      </div>
      <div className="caesar-search-panel__controls">
        <input
          type="search"
          className="caesar-search-panel__input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="けいゆ"
          aria-label="Caesar search query"
        />
        <div className="caesar-search-panel__actions">
          <div className="caesar-search-panel__control-group">
            <label className="caesar-search-panel__label" htmlFor="caesar-search-lang">
              Lang
            </label>
            <select
              id="caesar-search-lang"
              className="caesar-search-panel__select"
              value={lang}
              onChange={(e) => onLangChange(e.target.value as Lang)}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            className="caesar-search-panel__btn"
            onClick={onSearch}
            disabled={searching || query.trim() === ''}
            aria-label="Search caesar shift"
          >
            検索
          </button>
        </div>
      </div>
      <div className={`caesar-search-panel__results${searching ? ' caesar-search-panel__results--searching' : ''}`}>
        {!searching && matches.length === 0 && query.trim() !== '' && (
          <p className="caesar-search-panel__empty">No results</p>
        )}
        {matches.length > 0 && (
          <ul className="caesar-search-panel__list">
            {matches.map(({ shift, entry }) => (
              <li key={`${shift}:${entry.id}`} className="caesar-search-panel__item">
                <span className="caesar-search-panel__shift">{formatShift(shift)}</span>
                <span className="caesar-search-panel__arrow">→</span>
                <span className="caesar-search-panel__word">{entry.word}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
