import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { NuevoSujetoForm } from './NuevoSujetoForm';
import { SujetoActions } from './SujetoActions';

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
