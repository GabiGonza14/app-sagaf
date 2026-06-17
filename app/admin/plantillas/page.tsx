import Link from 'next/link';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { KpiCard } from '@/components/KpiCard';
import { NuevaPlantillaForm } from './NuevaPlantillaForm';
import { formatPanama } from '@/lib/date';

export const revalidate = 0;

const TIPO_LABEL: Record<string, string> = {
  bank: 'Banco',
  realestate: 'Inmobiliaria',
  casino: 'Casino',
  notarios: 'Notaría',
};

interface Row {
  id: string;
  nombre: string;
  version: string;
  tipo_sujeto_obligado: string;
  sector: string | null;
  activa: number;
  campos: number;
  documentos: number;
  sujetos: number;
}

interface AuditRow {
  id: string;
  fecha_hora_servidor: string;
  usuario_correo: string | null;
  accion: string;
  detalle: string | null;
}

const ACCION_LABEL: Record<string, string> = {
  crear_plantilla_ros: 'Crear plantilla',
  actualizar_plantilla_ros: 'Modificar plantilla',
  activar_plantilla_ros: 'Activar',
  desactivar_plantilla_ros: 'Desactivar',
  eliminar_plantilla_ros: 'Eliminar plantilla',
  agregar_campo_plantilla: 'Agregar campo',
  eliminar_campo_plantilla: 'Eliminar campo',
  agregar_documento_requerido: 'Agregar documento',
  eliminar_documento_requerido: 'Eliminar documento',
};

function accionTone(accion: string): 'green' | 'blue' | 'red' {
  if (accion.startsWith('crear') || accion.startsWith('agregar') || accion === 'activar_plantilla_ros') return 'green';
  if (accion.startsWith('eliminar') || accion === 'desactivar_plantilla_ros') return 'red';
  return 'blue';
}

function parseDetalle(detalle: string | null): string {
  if (!detalle) return '—';
  try {
    const d = JSON.parse(detalle);
    return d.campo ?? d.documento ?? d.nombre ?? d.plantilla ?? '—';
  } catch { return '—'; }
}

export default async function PlantillasAdmin() {
  const rows = db.prepare<[], Row>(`
    SELECT p.id, p.nombre, p.version, p.tipo_sujeto_obligado, p.sector, p.activa,
           (SELECT COUNT(*) FROM campo_plantilla cp       WHERE cp.plantilla_id = p.id) AS campos,
           (SELECT COUNT(*) FROM documento_requerido dr   WHERE dr.plantilla_id = p.id) AS documentos,
           (SELECT COUNT(*) FROM sujeto_obligado_plantilla sop WHERE sop.plantilla_id = p.id) AS sujetos
      FROM plantilla_ros p
     ORDER BY p.tipo_sujeto_obligado, p.nombre
  `).all();

  const ultimasAcciones = db.prepare<[], AuditRow>(`
    SELECT id, fecha_hora_servidor, usuario_correo, accion, detalle
      FROM evento_auditoria
     WHERE modulo = 'admin' AND accion LIKE '%plantilla%'
     ORDER BY fecha_hora_servidor DESC
     LIMIT 10
  `).all();

  return (
    <>
      <TopBar
        eyebrow="Gestión de plantillas ROS"
        title="Plantillas dinámicas"
        description="Define las plantillas por sector con sus campos y documentos requeridos. Permite habilitar nuevos sectores sin reprogramar (CU-06, RE-02). Cada cambio queda auditado."
      />

      <div className="kpis">
        <KpiCard label="Plantillas totales" value={rows.length} badge="Total" tone="blue" />
        <KpiCard label="Activas" value={rows.filter((r) => r.activa === 1).length} badge="En uso" tone="green" />
        <KpiCard label="Sectores cubiertos" value={new Set(rows.map((r) => r.tipo_sujeto_obligado)).size} badge="RE-02" tone="purple" />
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Plantillas registradas</h3>
          <span className="small" style={{ color: 'var(--muted)' }}>{rows.length} plantilla(s)</span>
        </div>
        {rows.length === 0 ? (
          <div className="notice">Aún no hay plantillas. Crea la primera con el formulario de abajo.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Sector</th>
                <th>Versión</th>
                <th>Campos</th>
                <th>Documentos</th>
                <th>Sujetos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong></td>
                  <td>{TIPO_LABEL[r.tipo_sujeto_obligado] ?? r.tipo_sujeto_obligado}</td>
                  <td className="small">{r.sector ?? '—'}</td>
                  <td className="small">v{r.version}</td>
                  <td><Badge tone={r.campos > 0 ? 'blue' : 'amber'}>{r.campos}</Badge></td>
                  <td><Badge tone={r.documentos > 0 ? 'green' : 'amber'}>{r.documentos}</Badge></td>
                  <td><Badge tone={r.sujetos > 0 ? 'green' : 'amber'}>{r.sujetos}</Badge></td>
                  <td><Badge tone={r.activa === 1 ? 'green' : 'red'}>{r.activa === 1 ? 'activa' : 'inactiva'}</Badge></td>
                  <td>
                    <Link href={`/admin/plantillas/${r.id}`} className="btn secondary" style={{ fontSize: 13, padding: '6px 12px' }}>
                      Gestionar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Actividad reciente</h3>
            <p className="small" style={{ margin: '2px 0 0' }}>Cambios sobre plantillas, campos y documentos (RE-03)</p>
          </div>
          <Link href="/admin/auditoria" className="btn ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
            Ver historial completo →
          </Link>
        </div>
        {ultimasAcciones.length === 0 ? (
          <div className="notice">Sin acciones registradas aún.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Fecha y hora</th><th>Acción</th><th>Detalle</th><th>Usuario</th></tr>
            </thead>
            <tbody>
              {ultimasAcciones.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatPanama(a.fecha_hora_servidor)}</td>
                  <td><Badge tone={accionTone(a.accion)}>{ACCION_LABEL[a.accion] ?? a.accion}</Badge></td>
                  <td style={{ fontSize: 13 }}>{parseDetalle(a.detalle)}</td>
                  <td style={{ fontSize: 12 }}>{a.usuario_correo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Crear nueva plantilla</h3>
        <p className="small" style={{ marginBottom: 14 }}>
          Define el nombre, tipo de sujeto obligado y sector. Luego agrégale campos y documentos desde &quot;Gestionar&quot;.
        </p>
        <NuevaPlantillaForm tiposExistentes={Array.from(new Set(rows.map((r) => r.tipo_sujeto_obligado)))} />
      </div>
    </>
  );
}
