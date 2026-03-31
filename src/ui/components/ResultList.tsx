import type { EntryRow } from '../../shared/types';

interface ResultListProps {
  items: EntryRow[];
  query: string;
  searching: boolean;
  offset: number;
  totalApprox: number;
  pageSize: number;
  onPageChange: (offset: number) => void;
}

export function ResultList({
  items,
  query,
  searching,
  offset,
  totalApprox,
  pageSize,
  onPageChange,
}: ResultListProps) {
  if (query.trim() === '') return null;

  if (items.length === 0 && !searching) {
    return (
      <div className="result-list">
        <p className="result-list__empty">No results</p>
      </div>
    );
  }

  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < totalApprox;

  return (
    <div className={`result-list ${searching ? 'result-list--searching' : ''}`}>
      <ul className="result-list__items">
        {items.map((entry) => (
          <li key={entry.id} className="result-list__item">
            <span className="result-list__word">{entry.word}</span>
          </li>
        ))}
      </ul>
      {totalApprox > 0 && (
        <nav className="result-list__paging" aria-label="Pagination">
          <button
            className="result-list__page-btn"
            disabled={!hasPrev}
            onClick={() => onPageChange(Math.max(0, offset - pageSize))}
            type="button"
          >
            Prev
          </button>
          <span className="result-list__page-info">
            {offset + 1}–{Math.min(offset + pageSize, totalApprox)} / {totalApprox}
          </span>
          <button
            className="result-list__page-btn"
            disabled={!hasNext}
            onClick={() => onPageChange(offset + pageSize)}
            type="button"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
