'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SuccessModal } from '@/components/SuccessModal';
import CustomSelect from '@/components/CustomSelect';

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }

const TIPO_LABEL: Record<string, string> = {
  bank:       'Banco',
  realestate: 'Inmobiliaria',
  casino:     'Casino',
  notarios:   'Notaría',
};

const TIPO_SECTOR_MAP: Record<string, string> = {
  bank:       'financiero',
  realestate: 'no_financiero',
  casino:     'no_financiero',
  zona_franca:'no_financiero',
  notarios:   'actividad_profesional',
  contador:   'actividad_profesional',
};

interface Sujeto {
  id: string;
  nombre: string;
  ruc: string | null;
  tipo: string;
  sector: string;
  organismo_supervisor: string | null;
  responsable_cumpl: string | null;
  estado: string;
  plantillasAsignadas: string[];
}

export function SujetoActions({
  sujeto,
  todasPlantillas,
  tiposDisponibles,
}: Readonly<{
  sujeto: Sujeto;
  todasPlantillas: Plantilla[];
  tiposDisponibles: string[];
}>) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [openEliminar, setOpenEliminar] = useState(false);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
  const [refreshOnClose, setRefreshOnClose] = useState(false);

  // form state
  const [nombre, setNombre] = useState(sujeto.nombre);
  const [ruc, setRuc] = useState(sujeto.ruc ?? '');
  const [tipo, setTipo] = useState(sujeto.tipo);
  const [sector, setSector] = useState(sujeto.sector);
  const [estado, setEstado] = useState(sujeto.estado);
  const [organismo, setOrganismo] = useState(sujeto.organismo_supervisor ?? '');
  const [responsable, setResponsable] = useState(sujeto.responsable_cumpl ?? '');
  const [seleccionadas, setSeleccionadas] = useState<string[]>(sujeto.plantillasAsignadas);

  useEffect(() => {
    if (TIPO_SECTOR_MAP[tipo]) setSector(TIPO_SECTOR_MAP[tipo]);
  }, [tipo]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const compatibles = todasPlantillas.filter((p) => p.tipo_sujeto_obligado === tipo);

  function toggle(id: string) {
    setSeleccionadas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (seleccionadas.length === 0) {
      setError('Debe asociar al menos una plantilla ROS.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sujetos-obligados/${sujeto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, ruc: ruc || null, tipo, sector, estado,
          organismo_supervisor: organismo || null,
          responsable_cumpl: responsable || null,
          plantillas: seleccionadas,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al actualizar.'); return; }
      setOpen(false);
      setSuccessModal({ title: 'Sujeto actualizado', message: 'Los datos del sujeto obligado fueron guardados correctamente.' });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function toggleEstado() {
    const nuevoEstado = sujeto.estado === 'activo' ? 'inactivo' : 'activo';
    setToggleError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/sujetos-obligados/${sujeto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToggleError(data.error ?? 'Error al cambiar el estado.');
        return;
      }
      setSuccessModal({ title: 'Estado actualizado', message: `El sujeto obligado fue ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} correctamente.` });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function eliminarSujeto() {
    setBusy(true);
    setOpenEliminar(false);
    setToggleError(null);
    try {
      const res = await fetch(`/api/sujetos-obligados/${sujeto.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToggleError(data.error ?? 'No se pudo eliminar el sujeto obligado.');
        return;
      }
      setSuccessModal({ title: 'Sujeto eliminado', message: 'El sujeto obligado fue eliminado del sistema correctamente.' });
      setRefreshOnClose(true);
    } finally { setBusy(false); }
  }

  const desactivar = sujeto.estado === 'activo';

  return (
    <>
      {toggleError && (
        <div className="client-status error" role="alert" style={{ marginBottom: 6, fontWeight: 600, fontSize: 12 }}>
          {toggleError}
          <button onClick={() => setToggleError(null)} aria-label="Cerrar"
            style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn primary"
          onClick={() => { setOpen(true); setError(null); setToggleError(null); }}
          disabled={busy}
          title="Editar sujeto obligado"
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8 }}
        >Editar</button>
        <button
          className="btn ghost"
          onClick={toggleEstado}
          disabled={busy}
          title={desactivar ? 'Desactivar' : 'Activar'}
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8, color: desactivar ? 'var(--amber)' : 'var(--green)' }}
        >{desactivar ? 'Desactivar' : 'Activar'}</button>
        <button
          className="btn ghost"
          onClick={() => setOpenEliminar(true)}
          disabled={busy}
          title="Eliminar sujeto obligado"
          style={{ padding: '5px 10px', fontSize: 12, minHeight: 32, borderRadius: 8, color: 'var(--red)' }}
        >Eliminar</button>
      </div>

      {/* Native <dialog> — no ARIA roles needed, backdrop via ::backdrop CSS */}
      <dialog
        ref={dialogRef}
        className="modal-box"
        style={{ textAlign: 'left', maxWidth: 560 }}
        aria-labelledby={`dialog-title-${sujeto.id}`}
        onClose={() => setOpen(false)}
      >
        <h3 id={`dialog-title-${sujeto.id}`} style={{ margin: '0 0 12px' }}>Editar sujeto obligado</h3>
        <form onSubmit={onSave}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor={`edit-nombre-${sujeto.id}`}>Nombre</label>
              <input id={`edit-nombre-${sujeto.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor={`edit-ruc-${sujeto.id}`}>RUC / identificador</label>
              <input id={`edit-ruc-${sujeto.id}`} value={ruc} onChange={(e) => setRuc(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`edit-tipo-${sujeto.id}`}>Tipo</label>
              <CustomSelect id={`edit-tipo-${sujeto.id}`} value={tipo} onChange={(e) => { setTipo(e.target.value); setSeleccionadas([]); }} required>
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>
                ))}
              </CustomSelect>
            </div>
            <div className="field">
              <label>Sector</label>
              <div style={{ padding: '11px 14px', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#475569' }}>
                {sector === 'financiero' ? 'Financiero' : sector === 'no_financiero' ? 'No financiero' : sector === 'actividad_profesional' ? 'Actividad profesional' : sector}
              </div>
            </div>
            <div className="field">
              <label htmlFor={`edit-estado-${sujeto.id}`}>Estado</label>
              <CustomSelect id={`edit-estado-${sujeto.id}`} value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </CustomSelect>
            </div>
            <div className="field">
              <label htmlFor={`edit-organismo-${sujeto.id}`}>Organismo supervisor</label>
              <input id={`edit-organismo-${sujeto.id}`} value={organismo} onChange={(e) => setOrganismo(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`edit-responsable-${sujeto.id}`}>Responsable de cumplimiento</label>
              <input id={`edit-responsable-${sujeto.id}`} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
            </div>

            {/* <fieldset> es el elemento nativo para agrupar controles de formulario */}
            <fieldset className="field full" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 6, display: 'block', width: '100%' }}>Plantillas ROS</legend>
              {compatibles.length === 0 ? (
                <div className="notice amber">No hay plantillas activas para este tipo.</div>
              ) : (
                <div className="lookup-grid">
                  {compatibles.map((p) => (
                    <label key={p.id} className="lookup-card lookup-row" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        style={{ width: 18, flex: 'none' }}
                        checked={seleccionadas.includes(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                      <strong>{p.nombre}</strong>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}

            <div className="field full" style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </dialog>

      <ConfirmModal
        isOpen={openEliminar}
        variant="danger"
        title="¿Eliminar sujeto obligado?"
        message="Esta acción es irreversible. El sujeto obligado será eliminado permanentemente del sistema y quedará registrado en auditoría."
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        busy={busy}
        onConfirm={eliminarSujeto}
        onCancel={() => setOpenEliminar(false)}
      />

      <SuccessModal
        isOpen={!!successModal}
        title={successModal?.title ?? ''}
        message={successModal?.message ?? ''}
        onClose={() => {
          setSuccessModal(null);
          if (refreshOnClose) { setRefreshOnClose(false); router.refresh(); }
        }}
      />
    </>
  );
}
