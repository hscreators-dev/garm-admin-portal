import Icon from './Icon';

export type AudienceFilter = 'ALL' | 'B2C' | 'B2B';

// Individuals / Organizations segmented switch — the same control on every
// menu, so the whole portal can be viewed per customer type consistently.
export default function AudienceTabs({ value, onChange, counts, showAll }: {
  value: AudienceFilter;
  onChange: (v: AudienceFilter) => void;
  counts?: { b2c: number; b2b: number };
  showAll?: boolean;
}) {
  return (
    <div className="seg-tabs">
      {showAll && (
        <button className={`seg-tab ${value === 'ALL' ? 'active' : ''}`} onClick={() => onChange('ALL')}>
          All
        </button>
      )}
      <button className={`seg-tab ${value === 'B2C' ? 'active' : ''}`} onClick={() => onChange('B2C')}>
        <Icon name="user" /> Individuals {counts && <span className="seg-count">{counts.b2c}</span>}
      </button>
      <button className={`seg-tab ${value === 'B2B' ? 'active' : ''}`} onClick={() => onChange('B2B')}>
        <Icon name="factory" /> Organizations {counts && <span className="seg-count">{counts.b2b}</span>}
      </button>
    </div>
  );
}
