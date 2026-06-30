'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, estadoTone, estadoLabel, riskTone } from '@/components/Badge';
import { formatPanamaShort } from '@/lib/date';
import { Trash2, X } from 'lucide-react';

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

interface Props {
  ros: RosResumen[];
  filtroEstado: string;
}

export function RosListClient({ ros, filtroEstado }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borradores = ros.filter((r) => r.estado === 'borrador');
  const borradoresEnVista = ros.filter((r) => r.estado === 'borrador');

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = borradoresEnVista.map((r) => r.id);
    const allChecked = ids.every((id) => selected.has(id));
    setSelected(allChecked ? new Set() : new Set(ids));
  };

  const allBorradoresChecked =
    borradoresEnVista.length > 0 &&
    borradoresEnVista.every((r) => selected.has(r.id));

  const idsToDelete = [...selected].filter((id) => borradores.some((r) => r.id === id));

  const numerosToDelete = idsToDelete.map(
    (id) => ros.find((r) => r.id === id)?.numero_ros ?? id,
  );

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const results = await Promise.allSettled(
        idsToDelete.map((id) =>
          fetch(`/api/ros/${id}`, { method: 'DELETE' }).then((r) => {
            if (!r.ok) throw new Error(r.statusText);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      setModal(false);
      setSelected(new Set());
      if (failed > 0) {
        setError(`${failed} borrador(es) no pudieron eliminarse.`);
      }
      router.refresh();
    });
  };

  return (
    <>
      {/* Toolbar de selección */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--primary-soft)', border: '1px solid var(--primary)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
            {selected.size} borrador{selected.size > 1 ? 'es' : ''} seleccionado{selected.size > 1 ? 's' : ''}
          </span>
          <button
            className="btn red"
            style={{ padding: '5px 12px', fontSize: 12, marginLeft: 'auto' }}
            onClick={() => setModal(true)}
          >
            <Trash2 size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            Eliminar seleccionados
          </button>
          <button
            className="btn ghost"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={() => setSelected(new Set())}
            title="Limpiar selección"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="notice" style={{ borderColor: 'var(--red)', background: 'var(--red-soft)', color: 'var(--red)', marginBottom: 12 }}>
          {error}
        </div>
      )}

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
                <th style={{ width: 36 }}>
                  {borradoresEnVista.length > 0 && (
                    <input
                      type="checkbox"
                      checked={allBorradoresChecked}
                      onChange={toggleAll}
                      title="Seleccionar todos los borradores"
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </th>
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
                <tr key={r.id} style={selected.has(r.id) ? { background: 'var(--primary-soft)' } : undefined}>
                  <td>
                    {r.estado === 'borrador' && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    )}
                  </td>
                  <td>
                    <Link href={`/portal/ros/${r.id}`} style={{ color: '#0f3e69', fontFamily: 'Consolas, monospace', fontWeight: 700, textDecoration: 'none' }}>
                      {r.numero_ros}
                    </Link>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatPanamaShort(r.fecha_recepcion)}</td>
                  <td><Badge tone={estadoTone(r.estado)}>{estadoLabel(r.estado, 'portal')}</Badge></td>
                  <td style={{ whiteSpace: 'nowrap' }}>${r.monto.toLocaleString('en-US')}</td>
                  <td>
                    {r.nivel_riesgo
                      ? <Badge tone={riskTone(r.nivel_riesgo)}>{r.nivel_riesgo}</Badge>
                      : <span className="small">Sin clasificar</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                      {r.doc_obl_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: r.doc_obl_cargados >= r.doc_obl_total ? 'var(--green-soft)' : 'var(--red-soft)',
                          color: r.doc_obl_cargados >= r.doc_obl_total ? 'var(--green)' : 'var(--red)',
                        }} title="Obligatorios">
                          {r.doc_obl_cargados}/{r.doc_obl_total} obl.
                        </span>
                      )}
                      {r.doc_cond_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: 'var(--amber-soft)', color: 'var(--amber)',
                        }} title="Condicionales">
                          {r.doc_cond_cargados}/{r.doc_cond_total} cond.
                        </span>
                      )}
                      {r.doc_opt_total > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: '#f1f5f9', color: '#64748b',
                        }} title="Opcionales">
                          {r.doc_opt_cargados}/{r.doc_opt_total} opc.
                        </span>
                      )}
                      {r.doc_obl_total === 0 && r.doc_cond_total === 0 && r.doc_opt_total === 0 && (
                        <span className="small">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {r.pendientes_subsanacion > 0
                      ? <Badge tone="amber">{r.pendientes_subsanacion} pendiente{r.pendientes_subsanacion > 1 ? 's' : ''}</Badge>
                      : <span className="small">—</span>}
                  </td>
                  <td>
                    {r.estado === 'borrador' ? (
                      <Link href={`/portal/ros/${r.id}/editar`} className="btn primary" style={{ padding: '7px 12px', fontSize: 12 }}>
                        Continuar
                      </Link>
                    ) : (
                      <Link href={`/portal/ros/${r.id}`} className="btn ghost" style={{ padding: '7px 12px', fontSize: 12 }}>
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

      {/* Modal de confirmación */}
      {modal && idsToDelete.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{
            background: 'white', borderRadius: 14, padding: '28px 32px',
            maxWidth: 440, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Trash2 size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 17 }}>Eliminar borradores seleccionados</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 14 }}>
              Esta acción es irreversible. Se eliminarán {idsToDelete.length} borrador{idsToDelete.length > 1 ? 'es' : ''}:
            </p>
            <ul style={{ margin: '0 0 20px 0', padding: '0 0 0 20px', fontSize: 13 }}>
              {numerosToDelete.map((n) => <li key={n} style={{ fontFamily: 'Consolas, monospace', marginBottom: 3 }}>{n}</li>)}
            </ul>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn ghost"
                style={{ padding: '7px 16px', fontSize: 13 }}
                onClick={() => setModal(false)}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                className="btn red"
                style={{ padding: '7px 16px', fontSize: 13 }}
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? 'Eliminando…' : `Sí, eliminar ${idsToDelete.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
