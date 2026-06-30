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
    case 'en_revision_vinculo': return 'purple';
    case 'revision_documental': return 'amber';
    case 'subsanacion':         return 'teal';
    case 'riesgo_clasificado':  return 'green';
    case 'cerrado':             return 'green';
    default:                    return 'gray';
  }
}

export type EstadoContexto = 'portal' | 'uaf';

export function estadoLabel(estado: string, contexto?: EstadoContexto): string {
  // Desde el portal del Sujeto Obligado, "recibido" → "Enviado"
  if (estado === 'recibido' && contexto === 'portal') return 'Enviado';
  return estado.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
