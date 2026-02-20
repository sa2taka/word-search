interface ErrorRecoveryProps {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorRecovery({ message, onRetry, onReset }: ErrorRecoveryProps) {
  return (
    <div className="error-recovery" role="alert">
      <p className="error-recovery__message">{message}</p>
      <div className="error-recovery__actions">
        <button
          className="error-recovery__btn error-recovery__btn--retry"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
        <button
          className="error-recovery__btn error-recovery__btn--reset"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
