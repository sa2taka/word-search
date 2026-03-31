import type { DictSource } from '../../shared/types';

interface FooterProps {
  sources: DictSource[];
  onNavigateToLicense: () => void;
}

export function Footer({ sources, onNavigateToLicense }: FooterProps) {
  return (
    <footer className="footer">
      {sources.length > 0 && (
        <div className="footer__sources">
          {sources.map((source) => (
            <span key={source.name} className="footer__source">
              {source.name} ({source.license})
            </span>
          ))}
        </div>
      )}
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
