'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // form state
  const [nombre, setNombre] = useState(sujeto.nombre);
  const [ruc, setRuc] = useState(sujeto.ruc ?? '');
  const [tipo, setTipo] = useState(sujeto.tipo);
  const [sector, setSector] = useState(sujeto.sector);
  const [estado, setEstado] = useState(sujeto.estado);
  const [organismo, setOrganismo] = useState(sujeto.organismo_supervisor ?? '');
  const [responsable, setResponsable] = useState(sujeto.responsable_cumpl ?? '');
  const [seleccionadas, setSeleccionadas] = useState<string[]>(sujeto.plantillasAsignadas);

  const compatibles = todasPlantillas.filter((p) => p.tipo_sujeto_obligado === tipo);

  function toggle(id: string) {
    setSeleccionadas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (seleccionadas.length === 0) {
      setError('Debe asociar al menos una plantilla ROS (RE-01).');
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
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn secondary"
            onClick={() => { setOpen(true); setError(null); setToggleError(null); }}
            disabled={busy}
            title="Editar sujeto obligado"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Editar
          </button>
          <button
            className={`btn ${sujeto.estado === 'activo' ? 'red' : 'green'}`}
            onClick={toggleEstado}
            disabled={busy}
            title={sujeto.estado === 'activo' ? 'Desactivar' : 'Activar'}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            {sujeto.estado === 'activo' ? 'Desactivar' : 'Activar'}
          </button>
        </div>
        {toggleError && (
          <div className="client-status error" style={{ fontSize: 12, padding: '4px 8px' }}>{toggleError}</div>
        )}
      </div>

      {open && (
        <div
          className="modal-overlay"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          role="presentation"
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`dialog-title-${sujeto.id}`}
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
                  <select id={`edit-tipo-${sujeto.id}`} value={tipo} onChange={(e) => { setTipo(e.target.value); setSeleccionadas([]); }} required>
                    {tiposDisponibles.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`edit-sector-${sujeto.id}`}>Sector</label>
                  <select id={`edit-sector-${sujeto.id}`} value={sector} onChange={(e) => setSector(e.target.value)}>
                    <option value="financiero">Financiero</option>
                    <option value="no_financiero">No financiero</option>
                    <option value="actividad_profesional">Actividad profesional</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`edit-estado-${sujeto.id}`}>Estado</label>
                  <select id={`edit-estado-${sujeto.id}`} value={estado} onChange={(e) => setEstado(e.target.value)}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`edit-organismo-${sujeto.id}`}>Organismo supervisor</label>
                  <input id={`edit-organismo-${sujeto.id}`} value={organismo} onChange={(e) => setOrganismo(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`edit-responsable-${sujeto.id}`}>Responsable de cumplimiento</label>
                  <input id={`edit-responsable-${sujeto.id}`} value={responsable} onChange={(e) => setResponsable(e.target.value)} />
                </div>

                <div className="field full" role="group" aria-labelledby={`plantillas-label-${sujeto.id}`}>
                  <p id={`plantillas-label-${sujeto.id}`} style={{ fontWeight: 600, margin: '0 0 6px' }}>Plantillas ROS</p>
                  {compatibles.length === 0 ? (
                    <div className="notice amber">No hay plantillas activas para este tipo.</div>
                  ) : (
                    <div className="lookup-grid">
                      {compatibles.map((p) => (
                        <label key={p.id} className="lookup-card" style={{ cursor: 'pointer' }}>
                          <div className="lookup-row">
                            <input type="checkbox" style={{ width: 18, flex: 'none' }}
                                   checked={seleccionadas.includes(p.id)}
                                   onChange={() => toggle(p.id)} />
                            <strong>{p.nombre}</strong>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

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
          </div>
        </div>
      )}
    </>
  );
}
