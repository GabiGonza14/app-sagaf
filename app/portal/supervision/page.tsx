import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle, Clock, FileCheck, Shield } from 'lucide-react';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Badge, estadoTone } from '@/components/Badge';
import { FEATURES } from '@/lib/features';
import { labelTipoComunicacion } from '@/lib/supervision/constants';
import { PaqueteForm } from './PaqueteForm';

export const revalidate = 0;

function estadoSupervisionTone(estado: string) {
  if (estado === 'atendida' || estado === 'entregada') return 'green' as const;
  if (estado === 'en_analisis') return 'teal' as const;
  return 'amber' as const;
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lim = new Date(fecha.slice(0, 10));
  if (Number.isNaN(lim.getTime())) return null;
  return Math.ceil((lim.getTime() - hoy.getTime()) / 86400000);
}

export default async function SupervisionPage() {
  if (!FEATURES.SUPERVISION_SO) redirect('/portal');

  const session = await getSession();
  const soId = session!.user.sujetoObligadoId!;

  const pendientes = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM comunicacion_supervision
      WHERE sujeto_obligado_id = ? AND estado IN ('recibida', 'en_analisis')`,
  ).get(soId)?.n) ?? 0;

  const vencidas = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM comunicacion_supervision
      WHERE sujeto_obligado_id = ? AND estado IN ('recibida', 'en_analisis')
        AND fecha_limite_respuesta IS NOT NULL AND date(fecha_limite_respuesta) < date('now')`,
  ).get(soId)?.n) ?? 0;

  const enPlazo = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM comunicacion_supervision
      WHERE sujeto_obligado_id = ? AND estado IN ('recibida', 'en_analisis')
        AND fecha_limite_respuesta IS NOT NULL AND date(fecha_limite_respuesta) >= date('now')`,
  ).get(soId)?.n) ?? 0;

  const atendidas = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM comunicacion_supervision
      WHERE sujeto_obligado_id = ? AND estado = 'atendida'`,
  ).get(soId)?.n) ?? 0;

  const paquetesGenerados = (db.prepare<[string], { n: number }>(
    `SELECT COUNT(*) AS n FROM solicitud_paquete
      WHERE sujeto_obligado_id = ? AND estado IN ('generada', 'entregada')`,
  ).get(soId)?.n) ?? 0;

  const stats = { pendientes, vencidas, en_plazo: enPlazo, atendidas, paquetes_generados: paquetesGenerados };

  const comunicaciones = db.prepare(
    `SELECT c.id, c.organismo, c.tipo_comunicacion, c.numero_oficio, c.asunto, c.estado,
            c.fecha_registro, c.fecha_limite_respuesta,
            (SELECT COUNT(*) FROM solicitud_paquete s WHERE s.comunicacion_id = c.id) AS paquetes_vinculados
       FROM comunicacion_supervision c
      WHERE c.sujeto_obligado_id = ?
      ORDER BY
        CASE WHEN c.estado IN ('recibida', 'en_analisis') THEN 0 ELSE 1 END,
        c.fecha_limite_respuesta ASC NULLS LAST,
        c.fecha_registro DESC`,
  ).all(soId) as Array<{
    id: string;
    organismo: string;
    tipo_comunicacion: string;
    numero_oficio: string | null;
    asunto: string | null;
    estado: string;
    fecha_registro: string;
    fecha_limite_respuesta: string | null;
    paquetes_vinculados: number;
  }>;

  const so = db.prepare<[string], { tipo: string; nombre: string }>(
    'SELECT tipo, nombre FROM sujeto_obligado WHERE id = ?',
  ).get(soId);

  const paquetes = db.prepare(
    `SELECT s.id, s.numero_solicitud, s.estado, s.fecha_creacion, p.id AS paquete_id,
            (SELECT COUNT(*) FROM entrega_paquete e WHERE e.paquete_id = p.id) AS entregas
       FROM solicitud_paquete s
       LEFT JOIN paquete_generado p ON p.solicitud_id = s.id
      WHERE s.sujeto_obligado_id = ?
      ORDER BY s.fecha_creacion DESC
      LIMIT 20`,
  ).all(soId) as Array<{
    id: string;
    numero_solicitud: string;
    estado: string;
    fecha_creacion: string;
    paquete_id: string | null;
    entregas: number;
  }>;

  const sinPaquete = comunicaciones.filter(
    (c) => c.estado !== 'atendida' && c.paquetes_vinculados === 0,
  );

  return (
    <>
      <TopBar
        eyebrow="Oficial de Cumplimiento"
        title="Atención a supervisión"
        description={`${so?.nombre ?? 'Sujeto obligado'} — Registre oficios (comunicaciones) de la SBP u otros supervisores y genere paquetes de evidencia acotados.`}
      />

      <div className="kpis" style={{ marginBottom: 18 }}>
        <KpiCard
          label="Comunicaciones pendientes"
          value={stats.pendientes}
          badge="Requieren acción"
          tone={stats.pendientes > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Plazo vencido"
          value={stats.vencidas}
          badge="Urgente"
          tone={stats.vencidas > 0 ? 'red' : 'green'}
        />
        <KpiCard
          label="En plazo"
          value={stats.en_plazo}
          badge="Vigentes"
          tone="teal"
        />
        <KpiCard
          label="Paquetes generados"
          value={stats.paquetes_generados}
          badge="Histórico"
          tone="blue"
        />
      </div>

      {stats.vencidas > 0 && (
        <div className="notice red" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{stats.vencidas} comunicación{stats.vencidas > 1 ? 'es' : ''} con plazo vencido.</strong>
            <p className="small" style={{ margin: '6px 0 0' }}>
              Genere el paquete de respuesta y registre la entrega al regulador lo antes posible.
            </p>
          </div>
        </div>
      )}

      {stats.pendientes > 0 && stats.vencidas === 0 && (
        <div className="notice amber" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <Shield size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{stats.pendientes} comunicación{stats.pendientes > 1 ? 'es' : ''} pendiente{stats.pendientes > 1 ? 's' : ''} de atención.</strong>
            {sinPaquete.length > 0 && (
              <p className="small" style={{ margin: '6px 0 0' }}>
                {sinPaquete.length} sin paquete vinculado —{' '}
                <Link href={`/portal/supervision?comunicacion=${sinPaquete[0].id}#generar-paquete`}>
                  armar paquete ahora
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {sinPaquete.length > 0 && stats.pendientes === 0 && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <Clock size={16} style={{ display: 'inline', marginRight: 8 }} />
          Hay comunicaciones registradas sin paquete de respuesta generado.
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/portal/supervision/nueva" className="btn primary">Registrar oficio (OCR)</Link>
        {sinPaquete[0] && (
          <Link href={`/portal/supervision?comunicacion=${sinPaquete[0].id}#generar-paquete`} className="btn ghost">
            Armar paquete
          </Link>
        )}
      </div>

      <div className="card">
        <div className="panel-head" style={{ marginBottom: 14 }}>
          <div>
            <h3>Comunicaciones registradas</h3>
            <p>Oficios recibidos de supervisores — CR</p>
          </div>
        </div>
        {comunicaciones.length === 0 ? (
          <p className="small">No hay oficios registrados. Use <strong>Registrar oficio</strong> para cargar el PDF y extraer texto con OCR.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Oficio</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Plazo</th>
                <th>Paquete</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comunicaciones.map((c) => {
                const dias = diasHasta(c.fecha_limite_respuesta);
                const plazoUrgente = c.estado !== 'atendida' && dias !== null && dias < 0;
                const plazoProximo = c.estado !== 'atendida' && dias !== null && dias >= 0 && dias <= 7;
                return (
                  <tr key={c.id} style={plazoUrgente ? { background: 'var(--red-soft, #fff5f5)' } : undefined}>
                    <td>
                      {c.numero_oficio ?? '—'}
                      {plazoUrgente && (
                        <Badge tone="red" className="ml-2">Vencido</Badge>
                      )}
                      {plazoProximo && !plazoUrgente && (
                        <Badge tone="amber" className="ml-2">{dias}d</Badge>
                      )}
                    </td>
                    <td>{labelTipoComunicacion(c.tipo_comunicacion)}</td>
                    <td><Badge tone={estadoSupervisionTone(c.estado)}>{c.estado}</Badge></td>
                    <td>{c.fecha_limite_respuesta?.slice(0, 10) ?? '—'}</td>
                    <td>
                      {c.paquetes_vinculados > 0 ? (
                        <span className="small"><FileCheck size={14} style={{ verticalAlign: -2 }} /> {c.paquetes_vinculados}</span>
                      ) : (
                        <span className="small" style={{ color: 'var(--amber)' }}>Sin paquete</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/portal/supervision/${c.id}`}>Ver</Link>
                      {c.estado !== 'atendida' && (
                        <>
                          {' · '}
                          <Link href={`/portal/supervision?comunicacion=${c.id}#generar-paquete`}>Paquete</Link>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Suspense fallback={<div className="card" style={{ marginTop: 18 }}>Cargando formulario…</div>}>
        <PaqueteForm
          comunicaciones={comunicaciones}
          paquetesGenerados={paquetes}
          soTipo={so?.tipo ?? 'bank'}
          responsableNombre={session!.user.name ?? 'Oficial de Cumplimiento'}
        />
      </Suspense>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Paquetes generados</h3>
        {paquetes.length === 0 ? (
          <p className="small">Aún no hay paquetes.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Solicitud</th><th>Estado</th><th>Fecha</th><th></th></tr>
            </thead>
            <tbody>
              {paquetes.map((p) => (
                <tr key={p.id}>
                  <td>{p.numero_solicitud}</td>
                  <td><Badge tone={estadoTone(p.estado)}>{p.estado}</Badge></td>
                  <td>{p.fecha_creacion?.slice(0, 10)}</td>
                  <td>
                    {p.paquete_id && (
                      <Link href={`/api/supervision/paquetes/${p.paquete_id}/descargar`}>Descargar</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
