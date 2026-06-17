'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TIPOS_SUGERIDOS = [
  { value: 'bank', label: 'Banco' },
  { value: 'realestate', label: 'Inmobiliaria' },
  { value: 'casino', label: 'Casino' },
  { value: 'notarios', label: 'Notaría' },
  { value: 'zona_franca', label: 'Zona franca' },
  { value: 'contador', label: 'Contador' },
];

export function NuevaPlantillaForm({ tiposExistentes = [] }: { tiposExistentes?: string[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [sector, setSector] = useState('financiero');
  const [version, setVersion] = useState('1.0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opciones = Array.from(
    new Map(
      [...TIPOS_SUGERIDOS, ...tiposExistentes.map((t) => ({ value: t, label: t }))].map((o) => [o.value, o]),
    ).values(),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tipo.trim()) { setError('El tipo de sujeto obligado es obligatorio.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo_sujeto_obligado: tipo.trim(),
          sector: sector.trim(),
          version: version.trim() || '1.0',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al crear la plantilla.'); return; }
      setNombre(''); setTipo(''); setVersion('1.0'); setSector('financiero');
      router.refresh();
      router.push(`/admin/plantillas/${data.id}`);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pl-nombre">Nombre de la plantilla</label>
          <input id="pl-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                 placeholder="Ej. ROS Banco · Persona Natural" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="pl-tipo">Tipo de sujeto obligado</label>
          <input id="pl-tipo" list="tipos-so" value={tipo} onChange={(e) => setTipo(e.target.value)}
                 placeholder="Ej. bank, casino, zona_franca…" required />
          <datalist id="tipos-so">
            {opciones.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </datalist>
          <span className="small" style={{ color: 'var(--muted)' }}>
            Puedes escribir un tipo nuevo para habilitar un sector futuro (RE-02).
          </span>
        </div>
        <div className="field">
          <label htmlFor="pl-sector">Sector</label>
          <select id="pl-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="financiero">Financiero</option>
            <option value="no_financiero">No financiero</option>
            <option value="actividad_profesional">Actividad profesional</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pl-version">Versión</label>
          <input id="pl-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" />
        </div>

        {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="field full">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear y configurar'}
          </button>
        </div>
      </div>
    </form>
  );
}
