'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NuevoPlantillaForm() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [tipoNuevo, setTipoNuevo] = useState('');
  const [sector, setSector] = useState('financiero');
  const [version, setVersion] = useState('1.0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Tipos conocidos como sugerencias; el admin puede ingresar uno nuevo libremente
  const tiposSugeridos = [
    { value: 'bank',       label: 'Banco' },
    { value: 'realestate', label: 'Inmobiliaria / Promotora' },
    { value: 'casino',     label: 'Casino' },
    { value: 'abogado',    label: 'Abogado / Notario' },
    { value: 'remesa',     label: 'Casa de Remesas' },
    { value: 'zona_libre', label: 'Zona Libre' },
    { value: 'otro',       label: 'Otro sector' },
    { value: '__nuevo__',  label: 'Nuevo tipo personalizado…' },
  ];

  const tipoEfectivo = tipo === '__nuevo__' ? tipoNuevo.trim() : tipo;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!tipoEfectivo) { setError('Seleccione o ingrese el tipo de sujeto obligado.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, tipo_sujeto_obligado: tipoEfectivo, sector, version }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al crear plantilla.'); return; }
      setNombre(''); setTipo(''); setTipoNuevo(''); setVersion('1.0'); setOk(true);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pl-nombre">Nombre de la plantilla</label>
          <input id="pl-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                 placeholder="Ej. ROS Casino · Persona Natural" required />
        </div>
        <div className="field">
          <label htmlFor="pl-version">Versión</label>
          <input id="pl-version" value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pl-tipo">Tipo de sujeto obligado</label>
          <select id="pl-tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setTipoNuevo(''); }} required>
            <option value="">— Seleccione —</option>
            {tiposSugeridos.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {tipo === '__nuevo__' && (
          <div className="field">
            <label htmlFor="pl-tipo-nuevo">Identificador del nuevo tipo</label>
            <input id="pl-tipo-nuevo" value={tipoNuevo}
                   onChange={(e) => setTipoNuevo(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                   placeholder="Ej. constructora" required />
            <span className="small" style={{ color: 'var(--text-secondary)' }}>
              Solo letras minúsculas y guiones bajos. Ejemplo: <code>casa_cambio</code>
            </span>
          </div>
        )}
        <div className="field">
          <label htmlFor="pl-sector">Sector</label>
          <select id="pl-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="financiero">Financiero</option>
            <option value="no_financiero">No financiero</option>
            <option value="actividad_profesional">Actividad profesional</option>
          </select>
        </div>

        {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        {ok   && <div className="client-status success" style={{ gridColumn: '1 / -1' }}>Plantilla creada correctamente.</div>}

        <div className="field full">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear plantilla'}
          </button>
        </div>
      </div>
    </form>
  );
}
