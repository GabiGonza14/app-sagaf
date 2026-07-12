import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { FEATURES } from '@/lib/features';
import { labelTipoComunicacion, ORGANISMOS_SUPERVISION } from '@/lib/supervision/constants';
import { parseFromTextoOcrJson, fechasEfectivasComunicacion } from '@/lib/supervision/parse-oficio';
import { PaqueteDownloadLinks } from '../PaqueteDownloadLinks';
import { DocumentoViewer } from '@/components/supervision/DocumentoViewer';
import { PaqueteReporteViewer } from '@/components/supervision/PaqueteReporteViewer';

export const revalidate = 0;

interface Props { params: Promise<{ id: string }> }

function labelOrganismo(id: string) {
  return ORGANISMOS_SUPERVISION.find((o) => o.id === id)?.label ?? id;
}

export default async function ComunicacionDetailPage({ params }: Props) {
  if (!FEATURES.SUPERVISION_SO) redirect('/portal');

  const session = await getSession();
  const soId = session!.user.sujetoObligadoId!;
  const { id } = await params;

  const row = db.prepare(
    `SELECT id, organismo, tipo_comunicacion, numero_oficio, asunto, estado,
            fecha_oficio, fecha_limite_respuesta, texto_ocr, fecha_registro, archivo_path
       FROM comunicacion_supervision
      WHERE id = ? AND sujeto_obligado_id = ?`,
  ).get(id, soId) as {
    id: string;
    organismo: string;
    tipo_comunicacion: string;
    numero_oficio: string | null;
    asunto: string | null;
    estado: string;
    fecha_oficio: string | null;
    fecha_limite_respuesta: string | null;
    texto_ocr: string | null;
    fecha_registro: string;
    archivo_path: string;
  } | undefined;

  if (!row) notFound();

  let ocr: {
    texto_extraido?: string | null;
    fuente_ocr?: string;
    nombre_archivo?: string;
  } = {};
  try {
    ocr = row.texto_ocr ? JSON.parse(row.texto_ocr) : {};
  } catch {
    ocr = {};
  }

  const parse = parseFromTextoOcrJson(row.texto_ocr);
  const fechas = fechasEfectivasComunicacion(row, parse);

  function fmtFecha(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  const paquetes = db.prepare(
    `SELECT s.numero_solicitud, s.estado, p.id AS paquete_id
       FROM solicitud_paquete s
       LEFT JOIN paquete_generado p ON p.solicitud_id = s.id
      WHERE s.comunicacion_id = ?
      ORDER BY s.fecha_creacion DESC`,
  ).all(id) as Array<{ numero_solicitud: string; estado: string; paquete_id: string | null }>;

  const docUrl = `/api/supervision/comunicaciones/${row.id}/documento`;
  const paqueteConReporte = paquetes.find((p) => p.paquete_id);

  return (
    <>
      <TopBar
        eyebrow="Comunicación de supervisión"
        title={row.numero_oficio ?? 'Oficio sin número'}
        description={row.asunto ?? labelTipoComunicacion(row.tipo_comunicacion)}
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Badge tone="amber">{row.estado}</Badge>
          <span className="small">{labelOrganismo(row.organismo)}</span>
          <span className="small">{labelTipoComunicacion(row.tipo_comunicacion)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <div><span className="small">Fecha oficio</span><div>{fmtFecha(fechas.fecha_oficio)}</div></div>
          <div><span className="small">Plazo respuesta</span><div>{fmtFecha(fechas.fecha_limite_respuesta)}</div></div>
          <div><span className="small">Registrado</span><div>{row.fecha_registro?.slice(0, 16)}</div></div>
          <div><span className="small">Archivo</span><div>{ocr.nombre_archivo ?? 'Documento adjunto'}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Documento recibido</h3>
        <p className="small" style={{ marginBottom: 12 }}>
          Revise el PDF o imagen original del oficio. Use la pestaña de texto extraído para contrastar con el OCR.
        </p>
        <DocumentoViewer
          src={docUrl}
          title={row.numero_oficio ?? 'Oficio de supervisión'}
          ocrText={ocr.texto_extraido?.slice(0, 8000) ?? null}
          ocrFuente={ocr.fuente_ocr}
          downloadHref={docUrl}
        />
      </div>

      {paquetes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Paquetes de respuesta</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {paquetes.map((p) => (
              <li key={p.numero_solicitud} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--line, #e4e9f2)' }}>
                <div style={{ marginBottom: 10 }}>
                  <strong>{p.numero_solicitud}</strong>
                  <span className="small" style={{ marginLeft: 8 }}>{p.estado}</span>
                </div>
                {p.paquete_id && (
                  <>
                    <PaqueteDownloadLinks paqueteId={p.paquete_id} compact />
                    <div style={{ marginTop: 14 }}>
                      <p className="small" style={{ margin: '0 0 8px', fontWeight: 700 }}>Vista previa del informe PDF</p>
                      <PaqueteReporteViewer paqueteId={p.paquete_id} numeroSolicitud={p.numero_solicitud} />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`/portal/supervision?comunicacion=${row.id}#generar-paquete`} className="btn primary">
          {paqueteConReporte ? 'Armar otro paquete' : 'Generar paquete de respuesta'}
        </Link>
        <Link href="/portal/supervision" className="btn ghost">← Volver</Link>
      </div>
    </>
  );
}
