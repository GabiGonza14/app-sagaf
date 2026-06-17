'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Plantilla {
  id: string; nombre: string; version: string;
  tipo_sujeto_obligado: string; sector: string | null; activa: number;
}
interface Campo {
  id: string; nombre: string; tipo_dato: string;
  obligatorio: number; orden: number; regla_validacion: string | null;
}
interface Doc {
  id: string; nombre: string; descripcion: string | null;
  tipo_requerimiento: string; formatos_permitidos: string; tamano_maximo_mb: number; orden: number;
}

const TIPO_DATO_LABEL: Record<string, string> = {
  text: 'Texto', number: 'Número', date: 'Fecha', select: 'Selección', textarea: 'Texto largo',
};
const REQ_LABEL: Record<string, string> = {
  requerido: 'Requerido', condicional: 'Condicional', opcional: 'Opcional',
};
function reqTone(t: string): 'red' | 'amber' | 'gray' {
  if (t === 'requerido') return 'red';
  if (t === 'condicional') return 'amber';
  return 'gray';
}

export function PlantillaEditor({
  plantilla, campos, documentos, sujetos,
}: Readonly<{
  plantilla: Plantilla;
  campos: Campo[];
  documentos: Doc[];
  sujetos: { nombre: string; estado: string }[];
}>) {
  const router = useRouter();

  // --- Datos de la plantilla ---
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [version, setVersion] = useState(plantilla.version);
  const [sector, setSector] = useState(plantilla.sector ?? 'financiero');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerMsg, setHeaderMsg] = useState<string | null>(null);
  const [headerErr, setHeaderErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveHeader(e: React.FormEvent) {
    e.preventDefault();
    setHeaderErr(null); setHeaderMsg(null); setSavingHeader(true);
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, version, sector }),
      });
      const data = await res.json();
      if (!res.ok) { setHeaderErr(data.error ?? 'Error al guardar.'); return; }
      setHeaderMsg('Cambios guardados.');
      router.refresh();
    } finally { setSavingHeader(false); }
  }

  async function toggleActiva() {
    setBusy(true);
    try {
      await fetch(`/api/plantillas/${plantilla.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: plantilla.activa !== 1 }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function deletePlantilla() {
    setBusy(true);
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setHeaderErr(data.error ?? 'No se pudo eliminar.'); setConfirmDelete(false); return; }
      router.push('/admin/plantillas');
      router.refresh();
    } finally { setBusy(false); }
  }

  // --- Alta de campo ---
  const [cNombre, setCNombre] = useState('');
  const [cTipo, setCTipo] = useState('text');
  const [cOblig, setCOblig] = useState(true);
  const [addingCampo, setAddingCampo] = useState(false);
  const [campoErr, setCampoErr] = useState<string | null>(null);

  async function addCampo(e: React.FormEvent) {
    e.preventDefault();
    setCampoErr(null);
    if (!cNombre.trim()) { setCampoErr('El nombre del campo es obligatorio.'); return; }
    setAddingCampo(true);
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}/campos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: cNombre.trim(), tipo_dato: cTipo, obligatorio: cOblig }),
      });
      const data = await res.json();
      if (!res.ok) { setCampoErr(data.error ?? 'Error.'); return; }
      setCNombre(''); setCTipo('text'); setCOblig(true);
      router.refresh();
    } finally { setAddingCampo(false); }
  }

  async function removeCampo(campoId: string) {
    setBusy(true);
    try {
      await fetch(`/api/plantillas/${plantilla.id}/campos?campoId=${campoId}`, { method: 'DELETE' });
      router.refresh();
    } finally { setBusy(false); }
  }

  // --- Alta de documento ---
  const [dNombre, setDNombre] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dTipo, setDTipo] = useState('requerido');
  const [dFormatos, setDFormatos] = useState('pdf,jpg,png');
  const [dMax, setDMax] = useState(10);
  const [addingDoc, setAddingDoc] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);

  async function addDoc(e: React.FormEvent) {
    e.preventDefault();
    setDocErr(null);
    if (!dNombre.trim()) { setDocErr('El nombre del documento es obligatorio.'); return; }
    setAddingDoc(true);
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}/documentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: dNombre.trim(), descripcion: dDesc.trim() || null,
          tipo_requerimiento: dTipo, formatos_permitidos: dFormatos.trim() || 'pdf,jpg,png',
          tamano_maximo_mb: Number(dMax) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDocErr(data.error ?? 'Error.'); return; }
      setDNombre(''); setDDesc(''); setDTipo('requerido'); setDFormatos('pdf,jpg,png'); setDMax(10);
      router.refresh();
    } finally { setAddingDoc(false); }
  }

  async function removeDoc(docId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/plantillas/${plantilla.id}/documentos?docId=${docId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setDocErr(d.error ?? 'No se pudo eliminar.'); }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* ---- Datos de la plantilla ---- */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Datos de la plantilla</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={plantilla.activa === 1 ? 'green' : 'red'}>{plantilla.activa === 1 ? 'activa' : 'inactiva'}</Badge>
            <button className={`btn ${plantilla.activa === 1 ? 'red' : 'green'}`} onClick={toggleActiva} disabled={busy}
                    style={{ fontSize: 13, padding: '6px 12px' }}>
              {plantilla.activa === 1 ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>
        <form onSubmit={saveHeader}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ph-nombre">Nombre</label>
              <input id="ph-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="ph-version">Versión</label>
              <input id="ph-version" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ph-sector">Sector</label>
              <select id="ph-sector" value={sector} onChange={(e) => setSector(e.target.value)}>
                <option value="financiero">Financiero</option>
                <option value="no_financiero">No financiero</option>
                <option value="actividad_profesional">Actividad profesional</option>
              </select>
            </div>
            {headerErr && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{headerErr}</div>}
            {headerMsg && <div className="client-status found" style={{ gridColumn: '1 / -1' }}>{headerMsg}</div>}
            <div className="field full" style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="submit" className="btn primary" disabled={savingHeader}>
                {savingHeader ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(true)} disabled={busy}
                      style={{ color: 'var(--red)' }}>
                <Trash2 size={15} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Eliminar plantilla
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ---- Campos del formulario ---- */}
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 4px' }}>Campos del formulario dinámico</h3>
        <p className="small" style={{ marginBottom: 14, color: 'var(--muted)' }}>
          Definen qué campos verá el sujeto obligado al registrar un ROS con esta plantilla (RF-01).
        </p>
        {campos.length === 0 ? (
          <div className="notice amber">Esta plantilla aún no tiene campos. Agrega el primero abajo.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>#</th><th>Campo</th><th>Tipo</th><th>Obligatorio</th><th></th></tr>
            </thead>
            <tbody>
              {campos.map((c, i) => (
                <tr key={c.id}>
                  <td className="small">{i + 1}</td>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{TIPO_DATO_LABEL[c.tipo_dato] ?? c.tipo_dato}</td>
                  <td>{c.obligatorio === 1 ? <Badge tone="red">Sí</Badge> : <Badge tone="gray">No</Badge>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost" onClick={() => removeCampo(c.id)} disabled={busy}
                            title="Eliminar campo" style={{ color: 'var(--red)', padding: '4px 8px' }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={addCampo} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-nombre">Nuevo campo</label>
              <input id="c-nombre" value={cNombre} onChange={(e) => setCNombre(e.target.value)} placeholder="Ej. Número de cuenta" />
            </div>
            <div className="field">
              <label htmlFor="c-tipo">Tipo de dato</label>
              <select id="c-tipo" value={cTipo} onChange={(e) => setCTipo(e.target.value)}>
                {Object.entries(TIPO_DATO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-oblig">¿Obligatorio?</label>
              <select id="c-oblig" value={cOblig ? '1' : '0'} onChange={(e) => setCOblig(e.target.value === '1')}>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
            {campoErr && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{campoErr}</div>}
            <div className="field full">
              <button type="submit" className="btn secondary" disabled={addingCampo}>
                <Plus size={15} style={{ marginRight: 4, verticalAlign: '-2px' }} />
                {addingCampo ? 'Agregando…' : 'Agregar campo'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ---- Documentos requeridos ---- */}
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 4px' }}>Documentos requeridos</h3>
        <p className="small" style={{ marginBottom: 14, color: 'var(--muted)' }}>
          Cada documento tendrá su propio contenedor de carga para el sujeto obligado (RF-07). Los &quot;requeridos&quot; bloquean el envío del ROS.
        </p>
        {documentos.length === 0 ? (
          <div className="notice amber">Esta plantilla aún no tiene documentos requeridos. Agrega el primero abajo.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>#</th><th>Documento</th><th>Tipo</th><th>Formatos</th><th>Máx.</th><th></th></tr>
            </thead>
            <tbody>
              {documentos.map((d, i) => (
                <tr key={d.id}>
                  <td className="small">{i + 1}</td>
                  <td>
                    <strong>{d.nombre}</strong>
                    {d.descripcion && <div className="small" style={{ color: 'var(--muted)' }}>{d.descripcion}</div>}
                  </td>
                  <td><Badge tone={reqTone(d.tipo_requerimiento)}>{REQ_LABEL[d.tipo_requerimiento] ?? d.tipo_requerimiento}</Badge></td>
                  <td className="small">{d.formatos_permitidos}</td>
                  <td className="small">{d.tamano_maximo_mb} MB</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost" onClick={() => removeDoc(d.id)} disabled={busy}
                            title="Eliminar documento" style={{ color: 'var(--red)', padding: '4px 8px' }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={addDoc} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="d-nombre">Nuevo documento</label>
              <input id="d-nombre" value={dNombre} onChange={(e) => setDNombre(e.target.value)} placeholder="Ej. Estado de cuenta últimos 2 años" />
            </div>
            <div className="field">
              <label htmlFor="d-tipo">Tipo de requerimiento</label>
              <select id="d-tipo" value={dTipo} onChange={(e) => setDTipo(e.target.value)}>
                {Object.entries(REQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-formatos">Formatos permitidos</label>
              <input id="d-formatos" value={dFormatos} onChange={(e) => setDFormatos(e.target.value)} placeholder="pdf,jpg,png" />
            </div>
            <div className="field">
              <label htmlFor="d-max">Tamaño máx. (MB)</label>
              <input id="d-max" type="number" min={1} max={50} value={dMax} onChange={(e) => setDMax(Number(e.target.value))} />
            </div>
            <div className="field full">
              <label htmlFor="d-desc">Descripción (opcional)</label>
              <input id="d-desc" value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="Guía breve para el sujeto obligado" />
            </div>
            {docErr && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{docErr}</div>}
            <div className="field full">
              <button type="submit" className="btn secondary" disabled={addingDoc}>
                <Plus size={15} style={{ marginRight: 4, verticalAlign: '-2px' }} />
                {addingDoc ? 'Agregando…' : 'Agregar documento'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ---- Sujetos que la usan ---- */}
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 4px' }}>Sujetos obligados que la usan</h3>
        <p className="small" style={{ marginBottom: 12, color: 'var(--muted)' }}>
          La asociación se gestiona desde cada sujeto obligado.
        </p>
        {sujetos.length === 0 ? (
          <div className="notice">
            Ninguno todavía. Asóciala desde{' '}
            <a href="/admin/sujetos-obligados" style={{ color: 'var(--primary)' }}>Sujetos obligados</a>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sujetos.map((s) => (
              <span key={s.nombre} className="badge gray" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {s.nombre}
                <Badge tone={s.estado === 'activo' ? 'green' : 'red'}>{s.estado}</Badge>
              </span>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDelete}
        variant="danger"
        title="¿Eliminar plantilla?"
        message="Se eliminarán también sus campos y documentos requeridos. Esta acción no se puede deshacer. (Si la plantilla está en uso por algún ROS o sujeto, el sistema la bloqueará y deberás desactivarla en su lugar.)"
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={deletePlantilla}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
