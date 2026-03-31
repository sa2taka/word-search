interface FooterProps {
  onNavigateToLicense: () => void;
  onResetStorage: () => void;
}

export function Footer({ onNavigateToLicense, onResetStorage }: FooterProps) {
  function handleReset() {
    if (window.confirm('Are you sure you want to reset the dictionary cache? The dictionary will be re-downloaded.')) {
      onResetStorage();
    }
  }

  return (
    <footer className="footer">
      <button
        className="footer__link"
        onClick={onNavigateToLicense}
        type="button"
      >
        License
      </button>
      <span className="footer__separator" aria-hidden="true">|</span>
      <button
        className="footer__link"
        onClick={handleReset}
        type="button"
      >
        Reset Storage
      </button>
    </footer>
  );
}
