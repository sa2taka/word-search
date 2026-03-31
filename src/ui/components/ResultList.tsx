import type { EntryRow } from '../../shared/types';

interface ResultListProps {
  items: EntryRow[];
  offset: number;
  totalApprox: number;
  pageSize: number;
  onPageChange: (offset: number) => void;
}

export function ResultList({
  items,
  offset,
  totalApprox,
  pageSize,
  onPageChange,
}: ResultListProps) {
  if (items.length === 0) {
    return (
      <div className="result-list">
        <p className="result-list__empty">No results</p>
      </div>
    );
  }

  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < totalApprox;

  return (
    <div className="result-list">
      <ul className="result-list__items">
        {items.map((entry) => (
          <li key={entry.id} className="result-list__item">
            <span className="result-list__word">{entry.word}</span>
            {entry.pos && (
              <span className="result-list__pos">{entry.pos}</span>
            )}
          </li>
        ))}
      </ul>
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
    </div>
  );
}
