'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ConfirmModal';
import { X } from 'lucide-react';

interface Rol { id: string; nombre: string }
interface Sujeto { id: string; nombre: string }

interface Props {
  usuarioId: string;
  nombreActual: string;
  correoActual: string;
  estadoActual: string;
  rolActualId: string;
  sujetoObligadoId: string | null;
  roles: Rol[];
  sujetos: Sujeto[];
}

export function UsuarioActions({
  usuarioId, nombreActual, correoActual, estadoActual, rolActualId,
  sujetoObligadoId, roles, sujetos,
}: Readonly<Props>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [openEstado, setOpenEstado] = useState(false);
  const [openEditar, setOpenEditar] = useState(false);
  const [openEliminar, setOpenEliminar] = useState(false);

  const [nombre, setNombre] = useState(nombreActual);
  const [correo, setCorreo] = useState(correoActual);
  const [rolId, setRolId] = useState(rolActualId);
  const [sujetoId, setSujetoId] = useState(sujetoObligadoId ?? '');

  const [error, setError] = useState<string | null>(null);

  const desactivar = estadoActual === 'activo';
  const nuevoEstado = desactivar ? 'inactivo' : 'activo';
  const rolCambio = rolId !== rolActualId;
  const rolName = roles.find((r) => r.id === rolId)?.nombre;
  const requiresSujeto = rolName === 'sujeto_obligado';

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

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { nombre, correo };
      if (rolCambio) {
        body.rol_id = rolId;
        body.sujeto_obligado_id = requiresSujeto ? (sujetoId || null) : null;
      }
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'No se pudo actualizar el usuario.'); return; }
      setOpenEditar(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function eliminarUsuario() {
    setBusy(true);
    setOpenEliminar(false);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'No se pudo eliminar el usuario.'); return; }
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
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn primary"
          onClick={() => setOpenEditar(true)}
          disabled={busy}
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8 }}
        >Editar</button>

        <button
          className="btn ghost"
          onClick={() => setOpenEstado(true)}
          disabled={busy}
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8, color: desactivar ? 'var(--amber)' : 'var(--green)' }}
        >{desactivar ? 'Desactivar' : 'Activar'}</button>

        <button
          className="btn ghost"
          onClick={() => setOpenEliminar(true)}
          disabled={busy}
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8, color: 'var(--red)' }}
        >Eliminar</button>
      </div>

      {/* Modal Editar */}
      {openEditar && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setOpenEditar(false); setNombre(nombreActual); setCorreo(correoActual); setRolId(rolActualId); setSujetoId(sujetoObligadoId ?? ''); setError(null); } }} role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <button type="button" className="modal-close" onClick={() => { setOpenEditar(false); setNombre(nombreActual); setCorreo(correoActual); setRolId(rolActualId); setSujetoId(sujetoObligadoId ?? ''); setError(null); }} aria-label="Cerrar"><X size={16} /></button>
            <h3 className="modal-title">Editar usuario</h3>
            <p className="modal-message">Modifique los datos del usuario. El correo debe ser único en el sistema.</p>
            <form onSubmit={guardarEdicion} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Nombre completo</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="field">
                <label>Correo institucional</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </div>
              <div className="field">
                <label>Rol</label>
                <select value={rolId} onChange={(e) => setRolId(e.target.value)} required>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              {requiresSujeto && (
                <div className="field">
                  <label>Sujeto obligado asociado</label>
                  <select value={sujetoId} onChange={(e) => setSujetoId(e.target.value)} required>
                    <option value="">— seleccione —</option>
                    {sujetos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => { setOpenEditar(false); setNombre(nombreActual); setCorreo(correoActual); setRolId(rolActualId); setSujetoId(sujetoObligadoId ?? ''); setError(null); }} disabled={busy}>Cancelar</button>
                <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        isOpen={openEliminar}
        variant="danger"
        title="¿Eliminar usuario?"
        message="Esta acción es irreversible. El usuario será eliminado permanentemente del sistema y quedará registrado en auditoría."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={eliminarUsuario}
        onCancel={() => setOpenEliminar(false)}
      />
    </>
  );
}
