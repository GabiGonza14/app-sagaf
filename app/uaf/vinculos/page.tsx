import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { maskDescriptionText } from '@/lib/masking';
import { formatPanama } from '@/lib/date';
import { VinculoActions } from './VinculoActions';

export const revalidate = 0;

interface Row {
  id: string;
  ros_origen_id: string;
  ros_destino_id: string;
  numero_origen: string;
  numero_destino: string;
  tipo_vinculo: string;
  descripcion: string | null;
  confirmado: number;
  decidido_por: string | null;
  fecha_deteccion: string;
  alto_riesgo: number | null;
}

export default async function VinculosPage() {
  const session = await auth();
  const filas = db.prepare<[], Row>(
    `
    SELECT v.id, v.ros_origen_id, v.ros_destino_id, v.tipo_vinculo, v.descripcion, v.confirmado, v.decidido_por, v.fecha_deteccion,
           r1.numero_ros AS numero_origen, r2.numero_ros AS numero_destino,
           (SELECT 1 FROM riesgo_caso rc
             WHERE rc.ros_id IN (v.ros_origen_id, v.ros_destino_id)
               AND rc.nivel = 'alto'
               AND rc.fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)
             LIMIT 1) AS alto_riesgo
      FROM vinculo_intersectorial v
      JOIN ros r1 ON r1.id = v.ros_origen_id
      JOIN ros r2 ON r2.id = v.ros_destino_id
     ORDER BY v.fecha_deteccion DESC
    `,
  ).all();

  return (
    <>
      <TopBar
        eyebrow="Vinculación intersectorial"
        title="Vínculos detectados entre ROS"
        description="Coincidencias entre ROS de distintos sujetos obligados (personas, beneficiarios, sociedades, cuentas, inmuebles…). Requieren validación por un analista antes de consolidarse."
      />

      <div className="card">
        {filas.length === 0 ? (
          <div className="notice">Sin vínculos detectados por el momento.</div>
        ) : (
          <div className="report-list">
            {filas.map((v) => {
              const descartado = !v.confirmado && v.decidido_por !== null;
              let badgeTone: 'green' | 'gray' | 'amber';
              let badgeLabel: string;
              if (v.confirmado) { badgeTone = 'green'; badgeLabel = 'Confirmado'; }
              else if (descartado) { badgeTone = 'gray'; badgeLabel = 'Descartado'; }
              else { badgeTone = 'amber'; badgeLabel = 'Por validar'; }
              return (
                <div key={v.id} className="report-item" style={{ cursor: 'default' }}>
                  <div className="report-top">
                    <strong>{v.numero_origen} ↔ {v.numero_destino}</strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {v.alto_riesgo === 1 && <Badge tone="red">Alto riesgo</Badge>}
                      <Badge tone={badgeTone}>{badgeLabel}</Badge>
                    </div>
                  </div>
                  <div className="report-meta">
                    <span><strong>Tipo:</strong> {v.tipo_vinculo}</span>
                    {v.descripcion && <span>{maskDescriptionText(v.descripcion)}</span>}
                    <span>Detectado: {formatPanama(v.fecha_deteccion)}</span>
                  </div>
                  {!v.confirmado && !descartado && <VinculoActions vincId={v.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
