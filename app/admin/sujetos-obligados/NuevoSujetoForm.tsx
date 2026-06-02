'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }

export function NuevoSujetoForm({
  plantillas,
  tiposDisponibles,
}: {
  plantillas: Plantilla[];
  tiposDisponibles: string[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [ruc, setRuc] = useState('');
  const [tipo, setTipo] = useState('');
  const [sector, setSector] = useState('financiero');
  const [estado, setEstado] = useState('activo');
  const [organismo, setOrganismo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compatibles = plantillas.filter((p) => p.tipo_sujeto_obligado === tipo);

  function toggle(id: string) {
    setSeleccionadas((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!organismo.trim()) {
      setError('El organismo supervisor es obligatorio.');
      return;
    }
    if (!responsable.trim()) {
      setError('El responsable de cumplimiento es obligatorio.');
      return;
    }
    if (seleccionadas.length === 0) {
      setError('Debe asociar al menos una plantilla ROS (RE-01).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sujetos-obligados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, ruc, tipo, sector, estado,
          organismo_supervisor: organismo,
          responsable_cumpl: responsable,
          plantillas: seleccionadas,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error.'); return; }
      setNombre(''); setRuc(''); setOrganismo(''); setResponsable(''); setSeleccionadas([]);
      setEstado('activo');
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="so-nombre">Nombre</label>
          <input id="so-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="so-ruc">RUC / identificador</label>
          <input id="so-ruc" value={ruc} onChange={(e) => setRuc(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="so-tipo">Tipo</label>
          <select id="so-tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setSeleccionadas([]); }} required>
            <option value="">— Seleccione —</option>
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="so-sector">Sector</label>
          <select id="so-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="financiero">Financiero</option>
            <option value="no_financiero">No financiero</option>
            <option value="actividad_profesional">Actividad profesional</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="so-estado">Estado inicial</label>
          <select id="so-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="so-organismo">Organismo supervisor <span aria-hidden="true" style={{ color: 'var(--danger, #dc2626)' }}>*</span></label>
          <input id="so-organismo" value={organismo} onChange={(e) => setOrganismo(e.target.value)} placeholder="Ej. Superintendencia de Bancos" required />
        </div>
        <div className="field">
          <label htmlFor="so-responsable">Responsable de cumplimiento <span aria-hidden="true" style={{ color: 'var(--danger, #dc2626)' }}>*</span></label>
          <input id="so-responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} required />
        </div>

        <div className="field full">
          <label>Plantillas ROS a asociar</label>
          {compatibles.length === 0 ? (
            <div className="notice amber">No hay plantillas activas para este tipo. Cree una primero.</div>
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
        <div className="field full">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar sujeto obligado'}
          </button>
        </div>
      </div>
    </form>
  );
}
