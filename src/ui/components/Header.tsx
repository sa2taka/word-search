import type { DbStatus } from '../../shared/types';

interface HeaderProps {
  dbStatus: DbStatus;
  version?: string;
}

const STATUS_DOT_CLASS: Record<string, string> = {
  idle: 'header__status-dot--idle',
  ready: 'header__status-dot--ready',
  error: 'header__status-dot--error',
  downloading: 'header__status-dot--downloading',
  updatable: 'header__status-dot--updatable',
};

export function Header({ dbStatus, version }: HeaderProps) {
  const classes = ['header__status-dot', STATUS_DOT_CLASS[dbStatus]].filter(Boolean).join(' ');

  return (
    <header className="header">
      <h1 className="header__title">Word Search</h1>
      <div className="header__meta">
        {version && <span>v{version}</span>}
        <span
          className={classes}
          data-testid="status-dot"
          aria-label={`DB status: ${dbStatus}`}
        />
      </div>
    </header>
  );
}
