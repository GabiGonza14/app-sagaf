'use client';

import { DocumentoViewer } from './DocumentoViewer';

interface Props {
  paqueteId: string;
  numeroSolicitud: string;
}

export function PaqueteReporteViewer({ paqueteId, numeroSolicitud }: Props) {
  const src = `/api/supervision/paquetes/${paqueteId}/reporte`;
  return (
    <DocumentoViewer
      src={src}
      mime="application/pdf"
      title={`Informe ${numeroSolicitud}`}
      downloadHref={src}
      height={560}
    />
  );
}
