import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge, estadoTone, estadoLabel, riskTone } from '@/components/Badge';
import { formatPanamaShort } from '@/lib/date';

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
              (SELECT COUNT(*) FROM documento_requerido dr
                JOIN plantilla_ros pl ON pl.id = dr.plantilla_id
               WHERE pl.id = r.plantilla_id) AS doc_total,
              (SELECT COUNT(*) FROM documento_adjunto da
                WHERE da.ros_id = r.id AND da.documento_requerido_id IS NOT NULL) AS doc_cargados,
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

  const tipoLabel = so?.tipo === 'bank' ? 'Banco' : so?.tipo === 'realestate' ? 'Inmobiliaria' : so?.tipo ?? '';

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

        {ros.length === 0 ? (
          <div className="notice">
            {filtroEstado
              ? `No tienes reportes con estado "${estadoLabel(filtroEstado, 'portal')}".`
              : 'Aún no has registrado ningún ROS.'}{' '}
            <Link href="/portal/ros/nuevo" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              Registrar ahora
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Número ROS</th>
                  <th>Fecha recepción</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Riesgo UAF</th>
                  <th>Documentos</th>
                  <th>Subsanación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ros.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: '#0f3e69', fontFamily: 'Consolas, monospace' }}>
                        {r.numero_ros}
                      </strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatPanamaShort(r.fecha_recepcion)}
                    </td>
                    <td><Badge tone={estadoTone(r.estado)}>{estadoLabel(r.estado, 'portal')}</Badge></td>
                    <td style={{ whiteSpace: 'nowrap' }}>USD {r.monto.toLocaleString('en-US')}</td>
                    <td>
                      {r.nivel_riesgo
                        ? <Badge tone={riskTone(r.nivel_riesgo)}>{r.nivel_riesgo}</Badge>
                        : <span className="small">Sin clasificar</span>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: r.doc_cargados === r.doc_total && r.doc_total > 0 ? 'var(--green)' : r.doc_cargados === 0 ? 'var(--muted)' : 'var(--amber)' }}>
                        {r.doc_cargados}
                      </span>
                      <span style={{ color: 'var(--muted)' }}> / {r.doc_total}</span>
                    </td>
                    <td>
                      {r.pendientes_subsanacion > 0
                        ? <Badge tone="amber">{r.pendientes_subsanacion} pendiente{r.pendientes_subsanacion > 1 ? 's' : ''}</Badge>
                        : <span className="small">—</span>}
                    </td>
                    <td>
                      {r.estado === 'borrador' ? (
                        <Link
                          href={`/portal/ros/${r.id}/editar`}
                          className="btn primary"
                          style={{ padding: '7px 12px', fontSize: 12 }}
                        >
                          Continuar
                        </Link>
                      ) : (
                        <Link
                          href={`/portal/ros/${r.id}`}
                          className="btn ghost"
                          style={{ padding: '7px 12px', fontSize: 12 }}
                        >
                          Ver detalle
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
