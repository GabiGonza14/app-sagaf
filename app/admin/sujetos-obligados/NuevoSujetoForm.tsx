'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CustomSelect from '@/components/CustomSelect';
import { SuccessModal } from '@/components/SuccessModal';

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
  useEffect(() => {
    if (TIPO_SECTOR_MAP[tipo]) setSector(TIPO_SECTOR_MAP[tipo]);
  }, [tipo]);

  const [organismo, setOrganismo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);

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
      setError('Debe asociar al menos una plantilla ROS.');
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
      setSuccessModal(true);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
    <SuccessModal
      isOpen={successModal}
      title="Sujeto obligado registrado"
      message="El nuevo sujeto obligado fue creado correctamente en el sistema."
      onClose={() => setSuccessModal(false)}
    />
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
          <CustomSelect id="so-tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setSeleccionadas([]); }} placeholder="— Seleccione —" required>
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
          <label htmlFor="so-estado">Estado inicial</label>
          <CustomSelect id="so-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </CustomSelect>
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
    </>
  );
}
