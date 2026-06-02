import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { NuevoSujetoForm } from './NuevoSujetoForm';
import { SujetoActions } from './SujetoActions';
import { formatPanama } from '@/lib/date';

interface AuditRow {
  fecha_hora_servidor: string;
  usuario_correo: string | null;
  accion: string;
  detalle: string | null;
  resultado: string;
}

const ACCION_LABEL: Record<string, string> = {
  crear_sujeto_obligado:      'Crear',
  actualizar_sujeto_obligado: 'Modificar',
};

function parsearEntidad(detalle: string | null): string {
  if (!detalle) return '—';
  try { return JSON.parse(detalle).nombre ?? '—'; } catch { return '—'; }
}

function parsearCambios(detalle: string | null): string {
  if (!detalle) return '';
  try {
    const d = JSON.parse(detalle);
    if (!d.cambios) return '';
    return Object.entries(d.cambios).map(([k, v]) => `${k}: ${v}`).join(', ');
  } catch { return ''; }
}

export const revalidate = 0;

interface Row {
  id: string;
  nombre: string;
  ruc: string | null;
  tipo: string;
  sector: string;
  organismo_supervisor: string | null;
  estado: string;
  responsable_cumpl: string | null;
  plantillas: number;
}

interface PlantillaAsig {
  sujeto_obligado_id: string;
  plantilla_id: string;
}

export default async function SujetosAdmin() {
  const session = await auth();

  const rows = db.prepare<[], Row>(
    `
    SELECT so.id, so.nombre, so.ruc, so.tipo, so.sector, so.organismo_supervisor,
           so.estado, so.responsable_cumpl,
           (SELECT COUNT(*) FROM sujeto_obligado_plantilla sop WHERE sop.sujeto_obligado_id = so.id) AS plantillas
      FROM sujeto_obligado so
     ORDER BY so.nombre
    `,
  ).all();

  const plantillas = db.prepare<[], { id: string; nombre: string; tipo_sujeto_obligado: string }>(
    `SELECT id, nombre, tipo_sujeto_obligado FROM plantilla_ros WHERE activa = 1 ORDER BY nombre`,
  ).all();

  // RE-02: tipos disponibles cargados dinámicamente desde la DB (no hardcodeados)
  const tiposDisponibles = db.prepare<[], { tipo: string }>(
    `SELECT DISTINCT tipo_sujeto_obligado AS tipo FROM plantilla_ros WHERE activa = 1 ORDER BY tipo`,
  ).all().map((r) => r.tipo);

  // Cargar todas las asociaciones para pasarlas al componente de edición
  const asignaciones = db.prepare<[], PlantillaAsig>(
    `SELECT sujeto_obligado_id, plantilla_id FROM sujeto_obligado_plantilla`,
  ).all();

  const plantillasPorSujeto: Record<string, string[]> = {};
  for (const a of asignaciones) {
    if (!plantillasPorSujeto[a.sujeto_obligado_id]) plantillasPorSujeto[a.sujeto_obligado_id] = [];
    plantillasPorSujeto[a.sujeto_obligado_id].push(a.plantilla_id);
  }

  // RE-03: últimas acciones sobre sujetos obligados para vista rápida
  const ultimasAcciones = db.prepare<[], AuditRow>(`
    SELECT fecha_hora_servidor, usuario_correo, accion, detalle, resultado
      FROM evento_auditoria
     WHERE modulo = 'admin' AND accion IN ('crear_sujeto_obligado', 'actualizar_sujeto_obligado')
     ORDER BY fecha_hora_servidor DESC
     LIMIT 10
  `).all();

  return (
    <>
      <TopBar
        eyebrow="Gestión de sujetos obligados"
        title="Sujetos obligados"
        description="Registra, clasifica y administra sujetos obligados. Cada uno debe tener tipo, sector, estado y plantilla ROS asociada (RE-01). Todo cambio queda auditado (RE-03)."
      />

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>RUC</th>
              <th>Tipo</th>
              <th>Sector</th>
              <th>Organismo supervisor</th>
              <th>Responsable cumplimiento</th>
              <th>Plantillas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.nombre}</strong></td>
                <td className="small">{r.ruc ?? '—'}</td>
                <td>{r.tipo}</td>
                <td>{r.sector}</td>
                <td className="small">{r.organismo_supervisor ?? '—'}</td>
                <td>{r.responsable_cumpl ?? '—'}</td>
                <td><Badge tone={r.plantillas > 0 ? 'green' : 'amber'}>{r.plantillas}</Badge></td>
                <td><Badge tone={r.estado === 'activo' ? 'green' : 'red'}>{r.estado}</Badge></td>
                <td>
                  <SujetoActions
                    sujeto={{
                      id: r.id,
                      nombre: r.nombre,
                      ruc: r.ruc,
                      tipo: r.tipo,
                      sector: r.sector,
                      organismo_supervisor: r.organismo_supervisor,
                      responsable_cumpl: r.responsable_cumpl,
                      estado: r.estado,
                      plantillasAsignadas: plantillasPorSujeto[r.id] ?? [],
                    }}
                    todasPlantillas={plantillas}
                    tiposDisponibles={tiposDisponibles}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RE-03 — Historial de cambios en sujetos obligados */}
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Últimas acciones (RE-03)</h3>
            <p className="small" style={{ margin: '2px 0 0' }}>Registro de creaciones, modificaciones y desactivaciones</p>
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
              <tr>
                <th>Fecha y hora</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Cambios</th>
                <th>Usuario</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {ultimasAcciones.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatPanama(a.fecha_hora_servidor)}</td>
                  <td><Badge tone={a.accion === 'crear_sujeto_obligado' ? 'green' : 'blue'}>{ACCION_LABEL[a.accion] ?? a.accion}</Badge></td>
                  <td><strong style={{ fontSize: 13 }}>{parsearEntidad(a.detalle)}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{parsearCambios(a.detalle) || '—'}</td>
                  <td style={{ fontSize: 12 }}>{a.usuario_correo ?? '—'}</td>
                  <td><Badge tone={a.resultado === 'exito' ? 'green' : 'red'}>{a.resultado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Registrar nuevo sujeto obligado</h3>
        <p className="small" style={{ marginBottom: 14 }}>
          Campos obligatorios: nombre, tipo, sector, estado y al menos una plantilla ROS (RE-01).
        </p>
        <NuevoSujetoForm plantillas={plantillas} tiposDisponibles={tiposDisponibles} />
      </div>
    </>
  );
}
