import { Badge } from './Badge';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

interface Item {
  label: string;
  value: number; // 0-100
  badge: string;
  tone?: Tone;
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
          <div className="bar">
            <div 
              style={{ width: `${Math.max(0, Math.min(100, it.value))}%` }} 
              className="animate-shimmer"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
