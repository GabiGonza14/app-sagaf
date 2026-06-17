type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

interface Props {
  label: string;
  value: number | string;
  badge?: string;
  tone?: Tone;
}

export function KpiCard({ label, value, badge, tone = 'blue' }: Props) {
  return (
    <div className="card kpi">
      <span>{label}</span>
      <strong style={tone !== 'gray' ? {
        background: `linear-gradient(135deg, var(--${tone}), var(--${tone}-dark, var(--${tone})))`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      } : undefined}>{value}</strong>
      {badge && <div className={`badge ${tone}`}>{badge}</div>}
    </div>
  );
}
