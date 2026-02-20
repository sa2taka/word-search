import type { DbStatus } from '../../shared/types';

interface StatusDisplayProps {
  status: DbStatus;
  message: string;
  progress?: number;
}

export function StatusDisplay({ status, message, progress }: StatusDisplayProps) {
  return (
    <div
      className={`status-display status-display--${status}`}
      data-testid="status-display"
      role="status"
    >
      <p className="status-display__message">{message}</p>
      {progress != null && (
        <div
          className="status-display__progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="status-display__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
