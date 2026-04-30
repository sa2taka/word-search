import type { SearchMode, Lang } from '../../shared/types';
import { normalizeWord } from '../../shared/normalize';
import { toVowelPattern } from '../../shared/vowel-search';

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
  initial: '子音のイニシャルからかな行を展開（例: NT → な行+た行 = なつ）',
  'number-pattern': '同じ数字=同じ文字（例: は112 → はいいろ、112323 → ききかいかい）',
  vowel: '同じ母音パターンの単語を検索（例: なまあし → aaai → わたがし）',
};

export function SearchPanel({
  query,
  mode,
  lang,
  onQueryChange,
  onModeChange,
  onLangChange,
}: SearchPanelProps) {
  const trimmed = query.trim();
  const hint =
    mode === 'vowel'
      ? (trimmed ? toVowelPattern(trimmed) : '')
      : (trimmed ? normalizeWord(trimmed) : '');
  const showHint = hint !== '' && hint !== trimmed;

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
        {showHint && (
          <span className="search-panel__normalized">{hint}</span>
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
            <option value="initial">イニシャルトーク</option>
            <option value="number-pattern">数字パターン</option>
            <option value="vowel">母音検索</option>
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
