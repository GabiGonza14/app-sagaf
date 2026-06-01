'use client';
import { useRef, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle, FileText, AlertCircle, User, Building2, Shield, FileCheck, Save } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }
interface DocReq    { id: string; plantilla_id: string; nombre: string; orden: number; tipo_requerimiento: string }

interface PartyState {
  id: string;
  status: 'idle' | 'verified' | 'not_found' | 'error';
  nombre: string;
  message?: string;
}

interface InitialData {
  rosId: string;
  plantillaId: string;
  oficial: string;
  correoOficial: string;
  fechaDeteccion: string;
  descripcion: string;
  monto: number;
  jurisdiccion: string;
  senalAlerta: string;
  productoServicio: string;
  bienInmueble: string;
  formaPago: string;
  tipoCliente: 'natural' | 'juridica';
  ordenante: PartyState;
  beneficiario: PartyState;
  comprador: PartyState;
  uploadedDocs: Record<string, string>;
}

interface Props {
  sujeto: { id: string; nombre: string; tipo: string };
  plantillas: Plantilla[];
  docsByPlantilla: Record<string, DocReq[]>;
  oficialDefault: string;
  correoDefault: string;
  initialData?: InitialData;
}

function FileDropZone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onChange(dropped);
  };

  return (
    <div
      className={`upload-zone${file ? ' has-file' : ''}${dragging ? ' dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="upload-zone-content">
          <CheckCircle size={18} className="upload-zone-icon uploaded" />
          <div>
            <div className="upload-zone-filename">{file.name}</div>
            <div className="upload-zone-size">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
          <button
            type="button"
            className="upload-zone-remove"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            aria-label="Quitar archivo"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="upload-zone-content">
          <Upload size={16} className="upload-zone-icon" />
          <div className="upload-zone-empty">
            <div className="upload-zone-hint">Arrastra o haz clic para subir</div>
            <div className="upload-zone-types">PDF, JPG, PNG — máx. 10 MB</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NuevoRosForm({ sujeto, plantillas, docsByPlantilla, oficialDefault, correoDefault, initialData }: Props) {
  const esEdicion = !!initialData;
  const router = useRouter();
  const isBank = sujeto.tipo === 'bank';
  const isRealEstate = sujeto.tipo === 'realestate';

  const defaultPlantilla = initialData?.plantillaId ?? plantillas[0]?.id ?? '';
  const [plantillaId, setPlantillaId] = useState(defaultPlantilla);
  const [tipoCliente, setTipoCliente] = useState<'natural' | 'juridica'>(initialData?.tipoCliente ?? 'natural');

  const [ordenante, setOrdenante] = useState<PartyState>(
    initialData?.ordenante ?? { id: '', status: 'idle', nombre: '' }
  );
  const [beneficiario, setBeneficiario] = useState<PartyState>(
    initialData?.beneficiario ?? { id: '', status: 'idle', nombre: '' }
  );
  const [comprador, setComprador] = useState<PartyState>(
    initialData?.comprador ?? { id: '', status: 'idle', nombre: '' }
  );

  const [monto, setMonto] = useState(initialData?.monto ? String(initialData.monto) : '');
  const [jurisdiccion, setJurisdiccion] = useState(initialData?.jurisdiccion ?? '');
  const [senalAlerta, setSenalAlerta] = useState(initialData?.senalAlerta ?? 'Movimientos incompatibles con el perfil');
  const [productoServicio, setProductoServicio] = useState(initialData?.productoServicio ?? '');
  const [bienInmueble, setBienInmueble] = useState(initialData?.bienInmueble ?? '');
  const [formaPago, setFormaPago] = useState(initialData?.formaPago ?? '');
  const [descripcion, setDescripcion] = useState(initialData?.descripcion ?? '');
  const [oficial, setOficial] = useState(initialData?.oficial ?? oficialDefault);
  const [correoOficial, setCorreoOficial] = useState(initialData?.correoOficial ?? correoDefault);
  const [fechaDeteccion, setFechaDeteccion] = useState(initialData?.fechaDeteccion ?? new Date().toISOString().slice(0, 10));

  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [extras, setExtras] = useState<File[]>([]);
  const [fileLabels, setFileLabels] = useState<Record<string, string>>(initialData?.uploadedDocs ?? {});

  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCondicionalModal, setShowCondicionalModal] = useState(false);

  const effectivePlantillaId = useMemo(() => {
    if (!isBank) return plantillaId || defaultPlantilla;
    const want = tipoCliente === 'natural'
      ? plantillas.find((p) => p.id === 'pl_bank_natural')
      : plantillas.find((p) => p.id === 'pl_bank_legal');
    return want?.id ?? plantillaId ?? defaultPlantilla;
  }, [isBank, tipoCliente, plantillaId, plantillas, defaultPlantilla]);

  const docList = docsByPlantilla[effectivePlantillaId] ?? [];
  const cargados = Object.values(files).filter((f) => f).length;
  const pct = docList.length > 0 ? Math.round((cargados / docList.length) * 100) : 0;

  async function verifyParty(
    field: 'ordenante' | 'beneficiario' | 'comprador',
    state: PartyState,
    setState: (s: PartyState) => void,
  ) {
    if (!state.id.trim()) {
      setState({ ...state, status: 'error', message: 'Debe ingresar la cédula / RUC.' });
      return;
    }
    try {
      const res = await fetch('/api/personas/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: state.id, contexto: field }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ ...state, status: 'error', message: data.error ?? 'Error de verificación' });
        return;
      }
      if (data.found) {
        setState({ id: state.id, status: 'verified', nombre: data.nombre });
      } else {
        setState({ id: state.id, status: 'not_found', nombre: '', message: 'Sin coincidencia. La UAF validará con la documentación adjunta.' });
      }
    } catch {
      setState({ ...state, status: 'error', message: 'No fue posible verificar en este momento.' });
    }
  }

  function buildPartes() {
    const partes: Array<{ rol: string; tipo: string; identificador: string; nombre_visible: string }> = [];
    if (isBank) {
      if (ordenante.id.trim())
        partes.push({ rol: 'ordenante', tipo: tipoCliente, identificador: ordenante.id.trim(), nombre_visible: ordenante.nombre });
      if (beneficiario.id.trim())
        partes.push({ rol: 'beneficiario', tipo: tipoCliente, identificador: beneficiario.id.trim(), nombre_visible: beneficiario.nombre });
    }
    if (isRealEstate && comprador.id.trim()) {
      partes.push({ rol: 'comprador', tipo: 'natural', identificador: comprador.id.trim(), nombre_visible: comprador.nombre });
    }
    return partes;
  }

  function buildBody() {
    return {
      plantilla_id: effectivePlantillaId,
      oficial_cumplimiento: oficial,
      correo_oficial: correoOficial,
      fecha_deteccion: fechaDeteccion,
      descripcion: esEdicion ? descripcion : descripcion,
      operacion: {
        monto: monto ? Number(monto) : 0,
        jurisdiccion,
        senal_alerta: senalAlerta,
        producto_servicio: isBank ? productoServicio : null,
        bien_inmueble: isRealEstate ? bienInmueble : null,
        forma_pago: isRealEstate ? formaPago : null,
        tipo_operacion: isBank ? 'bancaria' : 'inmobiliaria',
      },
      partes: buildPartes(),
    };
  }

  async function uploadFiles(rosId: string) {
    for (const docReq of docList) {
      const file = files[docReq.id];
      if (!file) continue;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ros_id', rosId);
      fd.append('documento_requerido_id', docReq.id);
      const up = await fetch('/api/documentos/upload', { method: 'POST', body: fd });
      if (!up.ok) {
        const upErr = await up.json().catch(() => ({}));
        setError(`Error subiendo "${docReq.nombre}": ${upErr.error ?? 'Error de subida'}`);
        return false;
      }
    }
    for (const extra of extras) {
      const fd = new FormData();
      fd.append('file', extra);
      fd.append('ros_id', rosId);
      await fetch('/api/documentos/upload', { method: 'POST', body: fd });
    }
    return true;
  }

  function isDocUploaded(docId: string): boolean {
    return !!(files[docId] || fileLabels[docId]);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const body = buildBody();
      let rosId: string;
      let numeroRos: string;

      if (esEdicion) {
        const res = await fetch(`/api/ros/${initialData!.rosId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, submit: true }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Error al enviar el ROS.'); return; }
        rosId = initialData!.rosId;
        numeroRos = data.numero_ros;
      } else {
        const res = await fetch('/api/ros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'No fue posible crear el ROS.'); return; }
        rosId = data.id;
        numeroRos = data.numero_ros;
      }

      const ok = await uploadFiles(rosId);
      if (!ok) return;

      setSuccess(`ROS ${numeroRos} enviado correctamente a la UAF.`);
      startTransition(() => {
        setTimeout(() => router.push(`/portal/ros/${rosId}`), 1200);
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);

    if (!descripcion.trim() || descripcion.length < 30) {
      setError('La descripción narrativa debe tener al menos 30 caracteres.');
      return;
    }
    if (!monto || Number.isNaN(Number(monto)) || Number(monto) <= 0) {
      setError('El monto debe ser un número mayor a 0.');
      return;
    }
    if (isBank && !ordenante.id.trim()) {
      setError('Debe registrar al menos la cédula del ordenante.');
      return;
    }
    if (isRealEstate && !comprador.id.trim()) {
      setError('Debe registrar la cédula del comprador.');
      return;
    }

    // Documentos obligatorios (requerido) — bloquean el envío
    const missingRequired = docList.filter(
      (d) => d.tipo_requerimiento === 'requerido' && !isDocUploaded(d.id),
    );
    if (missingRequired.length > 0) {
      setError('Complete los documentos obligatorios marcados en rojo para enviar el ROS.');
      return;
    }

    // Documentos condicionales faltantes — advertencia con confirmación
    const missingConditional = docList.filter(
      (d) => d.tipo_requerimiento === 'condicional' && !isDocUploaded(d.id),
    );
    if (missingConditional.length > 0) {
      setShowCondicionalModal(true);
      return;
    }

    await doSubmit();
  }

  async function onSaveDraft(e: React.MouseEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    setSubmitting(true);
    try {
      const body = buildBody();
      let rosId: string;
      let numeroRos: string;

      if (esEdicion) {
        const res = await fetch(`/api/ros/${initialData!.rosId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, submit: false }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Error al guardar borrador.'); return; }
        rosId = initialData!.rosId;
        numeroRos = data.numero_ros;
      } else {
        const res = await fetch('/api/ros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, modo: 'borrador' }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'No fue posible guardar el borrador.'); return; }
        rosId = data.id;
        numeroRos = data.numero_ros;
      }

      const ok = await uploadFiles(rosId);
      if (!ok) return;

      setSuccess(`Borrador ${numeroRos} guardado.`);
      startTransition(() => {
        setTimeout(() => router.push(`/portal/ros/${rosId}`), 1200);
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div className="form-grid">

        {/* ── Sección 1: Datos generales ── */}
        <div className="section-title">
          <span className="section-num">1</span>
          Datos generales del ROS
        </div>

        <div className="field">
          <label>Entidad reportante</label>
          <input value={sujeto.nombre} disabled />
        </div>
        <div className="field">
          <label>Fecha de detección</label>
          <input type="date" value={fechaDeteccion} onChange={(e) => setFechaDeteccion(e.target.value)} required />
        </div>
        <div className="field">
          <label>Oficial de cumplimiento</label>
          <input value={oficial} onChange={(e) => setOficial(e.target.value)} required placeholder="Nombre completo" />
        </div>
        <div className="field">
          <label>Correo institucional</label>
          <input type="email" value={correoOficial} onChange={(e) => setCorreoOficial(e.target.value)} required placeholder="correo@entidad.com" />
        </div>

        {/* ── Sección 2: Personas relacionadas ── */}
        <div className="section-title">
          <span className="section-num">2</span>
          Validación de personas relacionadas
        </div>
        <div className="notice" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <Shield size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          <strong>Privacidad (Ley 81/2019)</strong>: si una cédula/RUC ya existe en nuestros registros,
          solo verás el <strong>nombre</strong> para corroboración. No se autocompletan datos sensibles.
        </div>

        {isBank && (
          <>
            <div className="field">
              <label>Tipo de cliente</label>
              <select value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value as 'natural' | 'juridica')}>
                <option value="natural">Persona Natural</option>
                <option value="juridica">Persona Jurídica</option>
              </select>
            </div>
            <div className="field full">
              <div className="helper" style={{ marginBottom: 8 }}>
                Para reportes bancarios, valide por separado al <strong>ordenante</strong> y al <strong>beneficiario</strong>.
              </div>
              <div className="lookup-grid">
                <PartyCard label="Persona que realiza la transacción" role="Ordenante" icon={<User size={14} />}
                  state={ordenante} setState={setOrdenante}
                  onVerify={() => verifyParty('ordenante', ordenante, setOrdenante)} />
                <PartyCard label="Beneficiario" role="Beneficiario" icon={<User size={14} />}
                  state={beneficiario} setState={setBeneficiario}
                  onVerify={() => verifyParty('beneficiario', beneficiario, setBeneficiario)} />
              </div>
            </div>
          </>
        )}

        {isRealEstate && (
          <div className="field full">
            <div className="helper" style={{ marginBottom: 8 }}>
              Verifique al comprador. El sistema solo mostrará el nombre si la cédula existe en el directorio.
            </div>
            <div className="lookup-grid single">
              <PartyCard label="Cliente / Comprador reportado" role="Comprador" icon={<Building2 size={14} />}
                state={comprador} setState={setComprador}
                onVerify={() => verifyParty('comprador', comprador, setComprador)} />
            </div>
          </div>
        )}

        {/* ── Sección 3: Operación sospechosa ── */}
        <div className="section-title">
          <span className="section-num">3</span>
          Información de la operación sospechosa
        </div>
        <div className="field">
          <label>Monto aproximado (USD)</label>
          <input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="985000" required />
        </div>
        <div className="field">
          <label>{isRealEstate ? 'Ubicación del bien inmueble' : 'Jurisdicción relacionada'}</label>
          <input value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)} placeholder={isRealEstate ? 'Costa del Este, Panamá' : 'Panamá / Suiza'} />
        </div>
        <div className="field">
          <label>Tipología / señal de alerta</label>
          <select value={senalAlerta} onChange={(e) => setSenalAlerta(e.target.value)}>
            <option>Movimientos incompatibles con el perfil</option>
            <option>Uso de terceros o testaferros</option>
            <option>Procedencia de fondos no sustentada</option>
            <option>Operaciones fraccionadas</option>
            <option>Transferencias internacionales inusuales</option>
          </select>
        </div>
        {isBank && (
          <div className="field">
            <label>Producto bancario involucrado</label>
            <input value={productoServicio} onChange={(e) => setProductoServicio(e.target.value)} placeholder="Cuenta, préstamo, tarjeta, transferencia…" />
          </div>
        )}
        {isRealEstate && (
          <>
            <div className="field">
              <label>Bien inmueble involucrado</label>
              <input value={bienInmueble} onChange={(e) => setBienInmueble(e.target.value)} placeholder="Apartamento, finca, casa, local…" />
            </div>
            <div className="field">
              <label>Forma de pago</label>
              <input value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Efectivo, transferencia, mixto…" />
            </div>
          </>
        )}
        <div className="field full">
          <label>Descripción narrativa de los hechos</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required minLength={30}
            placeholder="Explique la operación, la inusualidad detectada, las gestiones realizadas y por qué se considera sospechosa." />
          <div className="helper">
            Mínimo 30 caracteres ({descripcion.length} escritos).
            Una narrativa insuficiente puede generar solicitud de subsanación.
          </div>
        </div>

        {/* ── Sección 4: Sustento documental ── */}
        <div className="section-title">
          <span className="section-num">4</span>
          Sustento documental
        </div>

        <div className="field full">
          {/* KPI summary */}
          <div className="doc-summary">
            <div className="info-box" style={{ borderColor: '#dbe8f6', background: 'var(--primary-soft)' }}>
              <span style={{ color: 'var(--primary)' }}>Requeridos</span>
              <strong style={{ color: 'var(--primary)' }}>{docList.length}</strong>
            </div>
            <div className="info-box" style={{ borderColor: cargados > 0 ? 'rgba(21,128,61,.3)' : undefined, background: cargados > 0 ? 'var(--green-soft)' : undefined }}>
              <span style={{ color: cargados > 0 ? 'var(--green)' : undefined }}>Cargados</span>
              <strong style={{ color: cargados > 0 ? 'var(--green)' : 'var(--primary)' }}>{cargados}</strong>
            </div>
            <div className="info-box" style={{ borderColor: docList.length - cargados > 0 ? '#fedf89' : 'rgba(21,128,61,.3)', background: docList.length - cargados > 0 ? 'var(--amber-soft)' : 'var(--green-soft)' }}>
              <span style={{ color: docList.length - cargados > 0 ? 'var(--amber)' : 'var(--green)' }}>Pendientes</span>
              <strong style={{ color: docList.length - cargados > 0 ? 'var(--amber)' : 'var(--green)' }}>{docList.length - cargados}</strong>
            </div>
          </div>

          {/* Progress bar */}
          {docList.length > 0 && (
            <div className="doc-progress">
              <div className="doc-progress-header">
                <span className="doc-progress-label">Progreso de carga</span>
                <span className="doc-progress-pct">{pct}%</span>
              </div>
              <div className="doc-progress-bar">
                <div className="doc-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Document cards */}
        <div className="field full">
          <div className="doc-grid">
            {docList.map((d, i) => {
              const file = files[d.id] ?? null;
              const uploaded = file || fileLabels[d.id];
              const tipoBadge =
                d.tipo_requerimiento === 'requerido'   ? 'red'   :
                d.tipo_requerimiento === 'condicional' ? 'amber' : 'gray';
              const tipoLabel =
                d.tipo_requerimiento === 'requerido'   ? 'Requerido'     :
                d.tipo_requerimiento === 'condicional' ? 'Si aplica'     : 'Complementario';
              return (
                <div key={d.id} className={`doc-card${file ? ' uploaded' : ''}`}>
                  <div className="doc-top">
                    <div className="doc-title">
                      <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, opacity: .6 }} />
                      {i + 1}. {d.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      <span className={`badge ${tipoBadge}`}>{tipoLabel}</span>
                      <span className={`badge ${uploaded ? 'green' : 'amber'}`}>
                        {file ? 'Listo para subir' : fileLabels[d.id] ? 'Adjunto guardado' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                  {fileLabels[d.id] && !file ? (
                    <div className="upload-zone has-file">
                      <div className="upload-zone-content">
                        <CheckCircle size={18} className="upload-zone-icon uploaded" />
                        <div>
                          <div className="upload-zone-filename">{fileLabels[d.id]}</div>
                          <div className="upload-zone-size">Adjunto del borrador (reemplazar si se desea)</div>
                        </div>
                        <button
                          type="button"
                          className="upload-zone-remove"
                          onClick={(e) => { e.stopPropagation(); setFileLabels({ ...fileLabels, [d.id]: '' }); }}
                          aria-label="Quitar archivo"
                        >×</button>
                      </div>
                    </div>
                  ) : null}
                  <FileDropZone
                    file={file}
                    onChange={(f) => setFiles({ ...files, [d.id]: f })}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Extra evidence */}
        <div className="field full">
          <label>Evidencia adicional no catalogada</label>
          <div
            className={`upload-zone${extras.length > 0 ? ' has-file' : ''}`}
            style={{ minHeight: 70 }}
            onClick={() => document.getElementById('extras-input')?.click()}
          >
            <input
              id="extras-input"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => setExtras(Array.from(e.target.files ?? []))}
            />
            {extras.length > 0 ? (
              <div className="upload-zone-content">
                <CheckCircle size={18} className="upload-zone-icon uploaded" />
                <div>
                  <div className="upload-zone-filename">{extras.length} archivo{extras.length > 1 ? 's' : ''} seleccionado{extras.length > 1 ? 's' : ''}</div>
                  <div className="upload-zone-size">{extras.map((f) => f.name).join(', ')}</div>
                </div>
                <button
                  type="button"
                  className="upload-zone-remove"
                  onClick={(e) => { e.stopPropagation(); setExtras([]); }}
                  aria-label="Quitar archivos"
                >×</button>
              </div>
            ) : (
              <div className="upload-zone-content">
                <FileCheck size={16} className="upload-zone-icon" />
                <div className="upload-zone-empty">
                  <div className="upload-zone-hint">Seleccionar archivos adicionales (múltiples)</div>
                  <div className="upload-zone-types">Fotografías, notas, correos u otros archivos complementarios no incluidos en la plantilla</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="client-status error" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
        {success && (
          <div className="client-status found" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={15} style={{ flexShrink: 0 }} />
            {success}
          </div>
        )}

        <div className="action-row" style={{ gridColumn: '1 / -1' }}>
          <button type="submit" className="btn primary" disabled={submitting || pending} style={{ minWidth: 200, justifyContent: 'center' }}>
            {submitting ? (
              <>Enviando ROS a la UAF…</>
            ) : (
              <>
                <FileCheck size={16} />
                {esEdicion ? 'Enviar a la UAF' : 'Enviar ROS a la UAF'}
              </>
            )}
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={submitting || pending}
            style={{ minWidth: 160, justifyContent: 'center' }}
            onClick={onSaveDraft}
          >
            <Save size={16} />
            {esEdicion ? 'Guardar borrador' : 'Guardar borrador'}
          </button>
          {!esEdicion && docList.length > 0 && cargados < docList.length && (
            <div className="helper" style={{ margin: 0, alignSelf: 'center' }}>
              {docList.length - cargados} documento{docList.length - cargados > 1 ? 's' : ''} pendiente{docList.length - cargados > 1 ? 's' : ''} — puede enviar con documentos faltantes.
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={showCondicionalModal}
        variant="warning"
        title="Documentos condicionales faltantes"
        message="Faltan documentos condicionales. ¿Desea enviar igual? La UAF puede solicitar subsanación."
        confirmLabel="Enviar de todas formas"
        cancelLabel="Revisar documentos"
        onConfirm={() => { setShowCondicionalModal(false); doSubmit(); }}
        onCancel={() => setShowCondicionalModal(false)}
      />
    </form>
  );
}

function PartyCard({
  label, role, icon, state, setState, onVerify,
}: {
  label: string;
  role: string;
  icon: React.ReactNode;
  state: PartyState;
  setState: (s: PartyState) => void;
  onVerify: () => void;
}) {
  return (
    <div className="lookup-card">
      <div className="lookup-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}
      </div>
      <div className="lookup-row">
        <input
          placeholder={`Cédula del ${role.toLowerCase()}`}
          value={state.id}
          onChange={(e) => setState({ ...state, id: e.target.value, status: 'idle', nombre: '' })}
        />
        <button type="button" className="btn secondary" onClick={onVerify} style={{ whiteSpace: 'nowrap' }}>
          Verificar
        </button>
      </div>
      {state.status === 'verified' && (
        <div className="client-status found" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} style={{ flexShrink: 0 }} />
          Coincidencia encontrada. Por privacidad, únicamente se muestra el nombre del {role.toLowerCase()}.
        </div>
      )}
      {state.status === 'not_found' && (
        <div className="client-status warning" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {state.message}
        </div>
      )}
      {state.status === 'error' && (
        <div className="client-status error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {state.message}
        </div>
      )}
      <div className="field full">
        <label>Nombre encontrado</label>
        <input value={state.nombre} readOnly placeholder="Solo se mostrará el nombre si existe coincidencia" />
      </div>
    </div>
  );
}
