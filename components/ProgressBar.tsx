import { Badge } from './Badge';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

interface Item {
  label: string;
  value: number; // 0-100
  badge: string;
  tone?: Tone;
  detail?: Array<{ label: string; value: string; tone?: Tone }>;
}

export function ProgressList({ items }: { items: Item[] }) {
  return (
    <div className="progress-row">
      {items.map((it, i) => (
        <div key={i} className="progress-item">
          <div className="progress-head">
            <strong>{it.label}</strong>
            <Badge tone={it.tone ?? 'blue'}>{it.badge}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="bar" style={{ flex: 1 }}>
              <div
                style={{ width: `${Math.max(0, Math.min(100, it.value))}%` }}
                className="animate-shimmer"
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 34, textAlign: 'right', color: 'var(--muted)', flexShrink: 0 }}>
              {Math.max(0, Math.min(100, it.value))}%
            </span>
          </div>
          {it.detail && it.detail.length > 0 && (
            <div className="progress-detail">
              {it.detail.map((d) => (
                <span key={d.label} className={`progress-chip ${d.tone ?? 'gray'}`}>
                  <strong>{d.value}</strong>
                  {d.label}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
