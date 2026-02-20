import type { DictSource } from '../../shared/types';

interface LicensePageProps {
  sources: DictSource[];
  onBack: () => void;
}

export function LicensePage({ sources, onBack }: LicensePageProps) {
  return (
    <div className="license-page">
      <button
        className="license-page__back-link"
        onClick={onBack}
        type="button"
      >
        Back
      </button>
      <h2 className="license-page__title">Licenses</h2>
      {sources.map((source) => (
        <div key={source.name} className="license-page__source">
          <h3 className="license-page__source-name">{source.name}</h3>
          <p className="license-page__source-detail">License: {source.license}</p>
          {source.version && (
            <p className="license-page__source-detail">Version: {source.version}</p>
          )}
          {source.attribution && (
            <p className="license-page__source-detail">Attribution: {source.attribution}</p>
          )}
          {source.notice_url && (
            <p className="license-page__source-detail">
              <a href={source.notice_url} target="_blank" rel="noopener noreferrer">
                Notice
              </a>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
