interface FooterProps {
  onNavigateToLicense: () => void;
}

export function Footer({ onNavigateToLicense }: FooterProps) {
  return (
    <footer className="footer">
      <button
        className="footer__link"
        onClick={onNavigateToLicense}
        type="button"
      >
        License
      </button>
    </footer>
  );
}
