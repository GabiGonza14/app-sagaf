'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Rol { id: string; nombre: string }

interface Props {
  usuarioId: string;
  estadoActual: string;
  rolActualId: string;
  roles: Rol[];
}

export function UsuarioActions({ usuarioId, estadoActual, rolActualId, roles }: Readonly<Props>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openEstado, setOpenEstado] = useState(false);
  const [openRol, setOpenRol] = useState(false);
  const [rolId, setRolId] = useState(rolActualId);
  const [error, setError] = useState<string | null>(null);

  const desactivar = estadoActual === 'activo';
  const nuevoEstado = desactivar ? 'inactivo' : 'activo';
  const rolNuevoNombre = roles.find((r) => r.id === rolId)?.nombre ?? rolId;
  const rolCambio = rolId !== rolActualId;

  async function toggleEstado() {
    setBusy(true);
    setOpenEstado(false);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'No se pudo actualizar el estado del usuario.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  async function guardarRol() {
    setBusy(true);
    setOpenRol(false);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol_id: rolId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'No se pudo cambiar el rol del usuario.'); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      {error && (
        <div className="client-status error" role="alert" style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>
          {error}
          <button onClick={() => setError(null)} aria-label="Cerrar"
            style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Toggle estado */}
        <button
          className={`btn ${desactivar ? 'amber' : 'green'}`}
          onClick={() => setOpenEstado(true)}
          disabled={busy}
          style={{ padding: '6px 10px', fontSize: 12 }}
        >
          {desactivar ? 'Desactivar' : 'Activar'}
        </button>

        {/* Cambio de rol (A4) */}
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            disabled={busy}
            style={{ fontSize: 12, padding: '4px 6px', flex: 1 }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
          <button
            className="btn secondary"
            onClick={() => setOpenRol(true)}
            disabled={busy || !rolCambio}
            style={{ padding: '4px 8px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            Cambiar rol
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={openEstado}
        variant={desactivar ? 'warning' : 'success'}
        title={desactivar ? '¿Desactivar usuario?' : '¿Activar usuario?'}
        message={
          desactivar
            ? 'El usuario no podrá iniciar sesión mientras esté inactivo. Puedes reactivarlo en cualquier momento.'
            : 'El usuario podrá volver a iniciar sesión. Esta acción queda registrada en auditoría.'
        }
        confirmLabel={desactivar ? 'Sí, desactivar' : 'Sí, activar'}
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={toggleEstado}
        onCancel={() => setOpenEstado(false)}
      />

      <ConfirmModal
        isOpen={openRol}
        variant="warning"
        title="¿Cambiar rol del usuario?"
        message={`El usuario recibirá el rol "${rolNuevoNombre}". Sus permisos cambiarán de inmediato y la acción quedará registrada en auditoría (RE-04).`}
        confirmLabel="Sí, cambiar rol"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={guardarRol}
        onCancel={() => { setOpenRol(false); setRolId(rolActualId); }}
      />
    </>
  );
}
