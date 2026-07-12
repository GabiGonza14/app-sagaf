import Link from 'next/link';
import { FileDown, FileJson } from 'lucide-react';

interface Props {
  paqueteId: string;
  /** Versión compacta para tablas */
  compact?: boolean;
}

export function PaqueteDownloadLinks({ paqueteId, compact = false }: Props) {
  const btnStyle = compact
    ? { fontSize: 12, padding: '6px 11px', minHeight: 32, gap: 6 }
    : undefined;
  const iconSize = compact ? 14 : 16;

  return (
    <div
      className="paquete-download-actions"
      style={{
        display: 'flex',
        gap: compact ? 6 : 10,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <Link
        href={`/api/supervision/paquetes/${paqueteId}/reporte`}
        className="btn primary"
        style={btnStyle}
      >
        <FileDown size={iconSize} aria-hidden />
        {compact ? 'PDF' : 'Descargar informe PDF'}
      </Link>
      <Link
        href={`/api/supervision/paquetes/${paqueteId}/descargar`}
        className="btn ghost"
        style={btnStyle}
      >
        <FileJson size={iconSize} aria-hidden />
        {compact ? 'JSON' : 'Manifiesto JSON'}
      </Link>
    </div>
  );
}
