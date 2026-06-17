import clsx from 'clsx';

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal' | 'gray';

interface Props {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export function Badge({ children, tone = 'blue', className }: Props) {
  return <span className={clsx('badge', tone, className)} style={{ fontWeight: 800 }}>{children}</span>;
}

export function riskTone(nivel: string): Tone {
  if (nivel === 'alto') return 'red';
  if (nivel === 'medio') return 'amber';
  if (nivel === 'bajo') return 'green';
  return 'gray';
}

export function estadoTone(estado: string): Tone {
  switch (estado) {
    case 'borrador':            return 'gray';
    case 'recibido':            return 'blue';
    case 'en_analisis':         return 'blue';
    case 'revision_documental': return 'amber';
    case 'subsanacion':         return 'amber';
    case 'escalado':            return 'red';
    case 'vinculado':           return 'purple';
    case 'cerrado':             return 'green';
    default:                    return 'gray';
  }
}

export function estadoLabel(estado: string): string {
  return estado.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
