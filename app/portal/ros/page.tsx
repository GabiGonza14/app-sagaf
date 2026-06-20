import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { estadoLabel } from '@/components/Badge';
import { RosListClient } from './RosListClient';

export const revalidate = 0;

interface SujetoRow { id: string; nombre: string; tipo: string }

interface RosResumen {
  id: string;
  numero_ros: string;
  estado: string;
  fecha_recepcion: string;
  monto: number;
  nivel_riesgo: string | null;
  doc_total: number;
  doc_cargados: number;
  doc_obl_total: number;
  doc_obl_cargados: number;
  doc_cond_total: number;
  doc_cond_cargados: number;
  doc_opt_total: number;
  doc_opt_cargados: number;
  pendientes_subsanacion: number;
}

const ESTADOS_FILTRO = [
  { valor: '',                  label: 'Todos' },
  { valor: 'borrador',          label: 'Borradores' },
  { valor: 'recibido',          label: 'Enviado' },
  { valor: 'en_analisis',       label: 'En análisis' },
  { valor: 'revision_documental', label: 'Revisión documental' },
  { valor: 'subsanacion',       label: 'Subsanación' },
  { valor: 'escalado',          label: 'Escalado' },
  { valor: 'vinculado',         label: 'Vinculado' },
  { valor: 'cerrado',           label: 'Cerrado' },
];

export default async function MisROS({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await auth();
  const soId = session!.user.sujetoObligadoId!;
  const { estado: filtroEstado = '' } = await searchParams;

  const so = db
    .prepare<[string], SujetoRow>('SELECT id, nombre, tipo FROM sujeto_obligado WHERE id = ?')
    .get(soId);

  const todos = db
    .prepare<[string], RosResumen>(
      `SELECT r.id, r.numero_ros, r.estado, r.fecha_recepcion,
              COALESCE((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id), 0) AS monto,
              (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id
                ORDER BY fecha_clasificacion DESC LIMIT 1) AS nivel_riesgo,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id) AS doc_total,
              (SELECT COUNT(*) FROM documento_adjunto WHERE ros_id = r.id AND documento_requerido_id IS NOT NULL) AS doc_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'requerido') AS doc_obl_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'requerido') AS doc_obl_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'condicional') AS doc_cond_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'condicional') AS doc_cond_cargados,
              (SELECT COUNT(*) FROM documento_requerido WHERE plantilla_id = r.plantilla_id AND tipo_requerimiento = 'opcional') AS doc_opt_total,
              (SELECT COUNT(*) FROM documento_adjunto da JOIN documento_requerido dr ON dr.id = da.documento_requerido_id WHERE da.ros_id = r.id AND dr.tipo_requerimiento = 'opcional') AS doc_opt_cargados,
              (SELECT COUNT(*) FROM solicitud_subsanacion s
                WHERE s.ros_id = r.id AND s.estado = 'pendiente') AS pendientes_subsanacion
         FROM ros r
        WHERE r.sujeto_obligado_id = ?
        ORDER BY r.fecha_recepcion DESC`,
    )
    .all(soId);

  const ros = filtroEstado ? todos.filter((r) => r.estado === filtroEstado) : todos;

  // Contadores por estado para los tabs
  const contadores: Record<string, number> = { '': todos.length };
  for (const r of todos) {
    contadores[r.estado] = (contadores[r.estado] ?? 0) + 1;
  }

  return (
    <>
      <TopBar
        eyebrow="Portal del Sujeto Obligado"
        title="Mis Reportes de Operaciones Sospechosas"
        description={`Historial completo de reportes enviados por ${so?.nombre ?? 'tu entidad'}. Solo son visibles los ROS de tu organización.`}
      />

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Reportes registrados</h3>
            <p>
              {filtroEstado
                ? `${ros.length} reporte${ros.length !== 1 ? 's' : ''} con estado "${estadoLabel(filtroEstado, 'portal')}" — de ${todos.length} en total`
                : `${todos.length} reporte${todos.length !== 1 ? 's' : ''} en total`}
            </p>
          </div>
          <Link href="/portal/ros/nuevo" className="btn primary">
            + Registrar nuevo ROS
          </Link>
        </div>

        {/* Filtros por estado */}
        <div className="tabs" style={{ marginBottom: 16 }}>
          {ESTADOS_FILTRO.filter(({ valor }) => valor === '' || (contadores[valor] ?? 0) > 0).map(({ valor, label }) => {
            const activo = filtroEstado === valor;
            const href = valor ? `/portal/ros?estado=${valor}` : '/portal/ros';
            const count = contadores[valor] ?? 0;
            return (
              <Link
                key={valor}
                href={href}
                className={`tab${activo ? ' active' : ''}`}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    marginLeft: 6,
                    background: activo ? 'rgba(255,255,255,.28)' : 'var(--primary-soft)',
                    color: activo ? 'white' : 'var(--primary)',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: 11,
                    fontWeight: 900,
                  }}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <RosListClient ros={ros} filtroEstado={filtroEstado} />
      </div>
    </>
  );
}
