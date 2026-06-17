import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  right?: ReactNode;
}

export function TopBar({ eyebrow, title, description, right }: Props) {
  return (
    <div className="topbar">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 style={{
          background: 'linear-gradient(135deg, var(--ink) 0%, var(--muted) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>{title}</h2>
        <div style={{
          height: '3px',
          width: '40px',
          background: 'linear-gradient(90deg, var(--primary), var(--teal))',
          borderRadius: '99px',
          marginBottom: '12px'
        }} />
        {description && <p className="lead">{description}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{right}</div>}
    </div>
  );
}
