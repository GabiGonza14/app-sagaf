import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { FEATURES } from '@/lib/features';
import { labelTipoComunicacion, ORGANISMOS_SUPERVISION } from '@/lib/supervision/constants';

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
            fecha_oficio, fecha_limite_respuesta, texto_ocr, fecha_registro
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
  } | undefined;

  if (!row) notFound();

  let ocr: {
    texto_extraido?: string | null;
    fuente_ocr?: string;
    sugerencias?: { numero_oficio?: string; asunto?: string };
    nota?: string;
  } = {};
  try {
    ocr = row.texto_ocr ? JSON.parse(row.texto_ocr) : {};
  } catch {
    ocr = {};
  }

  const paquetes = db.prepare(
    `SELECT s.numero_solicitud, s.estado, p.id AS paquete_id
       FROM solicitud_paquete s
       LEFT JOIN paquete_generado p ON p.solicitud_id = s.id
      WHERE s.comunicacion_id = ?
      ORDER BY s.fecha_creacion DESC`,
  ).all(id) as Array<{ numero_solicitud: string; estado: string; paquete_id: string | null }>;

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
          <div><span className="small">Fecha oficio</span><div>{row.fecha_oficio ?? '—'}</div></div>
          <div><span className="small">Plazo respuesta</span><div>{row.fecha_limite_respuesta ?? '—'}</div></div>
          <div><span className="small">Registrado</span><div>{row.fecha_registro?.slice(0, 16)}</div></div>
          <div><span className="small">Fuente texto</span><div>{ocr.fuente_ocr ?? '—'}</div></div>
        </div>
      </div>

      {ocr.texto_extraido && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Texto extraído (OCR / capa PDF)</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 280, overflow: 'auto' }}>
            {ocr.texto_extraido.slice(0, 4000)}
          </pre>
        </div>
      )}

      {paquetes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Paquetes vinculados</h3>
          <ul>
            {paquetes.map((p) => (
              <li key={p.numero_solicitud}>
                {p.numero_solicitud} — {p.estado}
                {p.paquete_id && (
                  <>
                    {' · '}
                    <Link href={`/api/supervision/paquetes/${p.paquete_id}/descargar`}>Descargar</Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`/portal/supervision?comunicacion=${row.id}#generar-paquete`} className="btn primary">
          Generar paquete para este oficio
        </Link>
        <Link href="/portal/supervision" className="btn ghost">← Volver</Link>
      </div>
    </>
  );
}
