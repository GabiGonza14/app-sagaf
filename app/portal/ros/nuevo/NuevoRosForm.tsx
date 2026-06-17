'use client';
import { useRef, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, FileText, AlertCircle, User, Building2, Shield, FileCheck, Save } from 'lucide-react';
import { FileDropZone, isAllowedFile, MAX_BYTES } from '@/components/FileDropZone';

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }
interface DocReq    { id: string; plantilla_id: string; nombre: string; orden: number; tipo_requerimiento: string }
interface CampoDin  { id: string; plantilla_id: string; nombre: string; tipo_dato: string; obligatorio: number; orden: number }

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
  cliente: PartyState;
  uploadedDocs: Record<string, string>;
  camposValores?: Record<string, string>;
}

interface Props {
  sujeto: { id: string; nombre: string; tipo: string };
  plantillas: Plantilla[];
  docsByPlantilla: Record<string, DocReq[]>;
  camposByPlantilla?: Record<string, CampoDin[]>;
  oficialDefault: string;
  correoDefault: string;
  initialData?: InitialData;
}


function isValidEmail(email: string): boolean {
  const at = email.indexOf('@');
  if (at < 1) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1 && !email.includes(' ');
}

function formatApiError(data: { error?: string; issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } }, fallback: string): string {
  if (!data.error) return fallback;
  if (data.error !== 'Datos inválidos') return data.error;
  const allMsgs = [
    ...(data.issues?.formErrors ?? []),
    ...Object.values(data.issues?.fieldErrors ?? {}).flat(),
  ];
  const detail = allMsgs.join(' ');
  return detail || fallback;
}

export function NuevoRosForm({ sujeto, plantillas, docsByPlantilla, camposByPlantilla = {}, oficialDefault, correoDefault, initialData }: Props) {
  const esEdicion = !!initialData;
  const router = useRouter();
  const isBank = sujeto.tipo === 'bank';
  const isRealEstate = sujeto.tipo === 'realestate';
  const isGeneric = !isBank && !isRealEstate;

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
  const [cliente, setCliente] = useState<PartyState>(
    initialData?.cliente ?? { id: '', status: 'idle', nombre: '' }
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

  const [camposValores, setCamposValores] = useState<Record<string, string>>(initialData?.camposValores ?? {});
  const [observaciones, setObservaciones] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [extras, setExtras] = useState<File[]>([]);
  const [fileLabels, setFileLabels] = useState<Record<string, string>>(initialData?.uploadedDocs ?? {});

  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  interface DuplicadoROS {
    id: string;
    numero_ros: string;
    estado: string;
    fecha_recepcion: string;
    monto: number;
    partes: Array<{ enmascarada: string; rol: string }>;
  }
  const [duplicadosPendientes, setDuplicadosPendientes] = useState<DuplicadoROS[]>([]);
  const confirmarPeseRef = useRef(false);

  const effectivePlantillaId = useMemo(() => {
    if (!isBank) return plantillaId || defaultPlantilla;
    const want = tipoCliente === 'natural'
      ? plantillas.find((p) => p.id === 'pl_bank_natural')
      : plantillas.find((p) => p.id === 'pl_bank_legal');
    return want?.id ?? plantillaId ?? defaultPlantilla;
  }, [isBank, tipoCliente, plantillaId, plantillas, defaultPlantilla]);

  const camposDinamicos = camposByPlantilla[effectivePlantillaId] ?? [];
  const camposDinamicosOk = camposDinamicos.every(
    (c) => c.obligatorio !== 1 || (camposValores[c.id] ?? '').trim() !== '',
  );
  function setCampoValor(id: string, valor: string) {
    setCamposValores((cur) => ({ ...cur, [id]: valor }));
  }

  const docList    = docsByPlantilla[effectivePlantillaId] ?? [];
  const docListReq = docList.filter((d) => d.tipo_requerimiento === 'requerido');
  const cargados    = docList.filter((d) => files[d.id] || fileLabels[d.id]).length;
  const cargadosReq = docListReq.filter((d) => files[d.id] || fileLabels[d.id]).length;
  const pct = docListReq.length > 0 ? Math.round((cargadosReq / docListReq.length) * 100) : 100;
  const todosDocumentosCargados = cargadosReq >= docListReq.length;

  const docsOk = todosDocumentosCargados || observaciones.trim().length >= 10;
  const camposBaseOk = Boolean(
    oficial.trim() &&
    isValidEmail(correoOficial) &&
    fechaDeteccion &&
    Number(monto) > 0 &&
    descripcion.trim().length >= 30 &&
    docsOk,
  );
  const camposBancoOk = !isBank || Boolean(
    ordenante.id.trim().length >= 3 &&
    beneficiario.id.trim().length >= 3 &&
    jurisdiccion.trim() &&
    productoServicio.trim(),
  );
  const camposInmobiliariaOk = !isRealEstate || Boolean(
    comprador.id.trim().length >= 3 &&
    jurisdiccion.trim() &&
    bienInmueble.trim() &&
    formaPago.trim(),
  );
  const camposGenericOk = !isGeneric || cliente.id.trim().length >= 3;
  const formListo = camposBaseOk && camposBancoOk && camposInmobiliariaOk && camposGenericOk && camposDinamicosOk;
  const hayAlgunDato = [
    ordenante.id, beneficiario.id, comprador.id, cliente.id,
    monto, descripcion, productoServicio, bienInmueble, formaPago, jurisdiccion,
  ].some((v) => v.trim() !== '') || cargados > 0;

  async function verifyParty(
    field: 'ordenante' | 'beneficiario' | 'comprador' | 'cliente',
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
    if (isGeneric && cliente.id.trim()) {
      partes.push({ rol: 'cliente', tipo: tipoCliente, identificador: cliente.id.trim(), nombre_visible: cliente.nombre });
    }
    return partes;
  }

  function buildBody() {
    return {
      plantilla_id: effectivePlantillaId,
      oficial_cumplimiento: oficial,
      correo_oficial: correoOficial,
      fecha_deteccion: fechaDeteccion,
      descripcion,
      observaciones,
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
      campos: camposDinamicos.map((c) => ({ campo_plantilla_id: c.id, valor: camposValores[c.id] ?? '' })),
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

  async function checkDuplicados(): Promise<DuplicadoROS[]> {
    const ids = buildPartes().map((p) => p.identificador).filter(Boolean);
    const montoNum = Number(monto);
    if (ids.length === 0 || !montoNum) return [];
    try {
      const res = await fetch('/api/ros/duplicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificadores: ids, monto: montoNum }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.duplicados ?? [];
    } catch {
      return [];
    }
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
        if (!res.ok) { setError(formatApiError(data, 'Error al enviar el ROS.')); return; }
        rosId = initialData!.rosId;
        numeroRos = data.numero_ros;
      } else {
        const res = await fetch('/api/ros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setError(formatApiError(data, 'No fue posible crear el ROS.')); return; }
        rosId = data.id;
        numeroRos = data.numero_ros;
      }

      const ok = await uploadFiles(rosId);
      if (!ok) return;

      setSuccess(`ROS ${numeroRos} enviado correctamente a la UAF.`);
      router.refresh();
      startTransition(() => {
        setTimeout(() => router.push(`/portal/ros/${rosId}`), 1200);
      });
    } finally {
      setSubmitting(false);
    }
  }

  function validateForm(): string | null {
    if (!oficial.trim()) return 'El nombre del oficial de cumplimiento es obligatorio.';
    if (!correoOficial.trim() || !isValidEmail(correoOficial))
      return 'El correo institucional del oficial es obligatorio y debe tener un formato válido.';
    if (!fechaDeteccion) return 'La fecha de detección es obligatoria.';
    if (!monto || Number.isNaN(Number(monto)) || Number(monto) <= 0)
      return 'El monto debe ser un número mayor a 0.';
    const bankError = validateBank();
    if (bankError) return bankError;
    const realEstateError = validateRealEstate();
    if (realEstateError) return realEstateError;
    const genericError = validateGeneric();
    if (genericError) return genericError;
    const campoFaltante = camposDinamicos.find((c) => c.obligatorio === 1 && !(camposValores[c.id] ?? '').trim());
    if (campoFaltante) return `El campo "${campoFaltante.nombre}" es obligatorio.`;
    if (!descripcion.trim() || descripcion.length < 30)
      return 'La descripción narrativa debe tener al menos 30 caracteres.';
    if (!todosDocumentosCargados && observaciones.trim().length < 10)
      return `Faltan ${docListReq.length - cargadosReq} documento(s) obligatorio(s). Cárguelos o justifique su ausencia en el campo Observaciones (mín. 10 caracteres).`;
    return null;
  }

  function validateBank(): string | null {
    if (!isBank) return null;
    if (ordenante.id.trim().length < 3) return 'La cédula del ordenante debe tener al menos 3 caracteres.';
    if (beneficiario.id.trim().length < 3) return 'La cédula del beneficiario debe tener al menos 3 caracteres.';
    if (!jurisdiccion.trim()) return 'La jurisdicción relacionada es obligatoria.';
    if (!productoServicio.trim()) return 'El producto bancario involucrado es obligatorio.';
    return null;
  }

  function validateRealEstate(): string | null {
    if (!isRealEstate) return null;
    if (comprador.id.trim().length < 3) return 'La cédula del cliente / comprador debe tener al menos 3 caracteres.';
    if (!jurisdiccion.trim()) return 'La ubicación del bien inmueble es obligatoria.';
    if (!bienInmueble.trim()) return 'El bien inmueble involucrado es obligatorio.';
    if (!formaPago.trim()) return 'La forma de pago es obligatoria.';
    return null;
  }

  function validateGeneric(): string | null {
    if (!isGeneric) return null;
    if (cliente.id.trim().length < 3) return 'La cédula/RUC del cliente o parte involucrada debe tener al menos 3 caracteres.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);

    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    // A6 — Detección de posible duplicidad (solo en envío formal, no borradores)
    if (!confirmarPeseRef.current) {
      setSubmitting(true);
      const dups = await checkDuplicados();
      setSubmitting(false);
      if (dups.length > 0) {
        setDuplicadosPendientes(dups);
        return;
      }
    }

    confirmarPeseRef.current = false;
    setDuplicadosPendientes([]);
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
        if (!res.ok) { setError(formatApiError(data, 'Error al guardar borrador.')); return; }
        rosId = initialData!.rosId;
        numeroRos = data.numero_ros;
      } else {
        const res = await fetch('/api/ros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, modo: 'borrador' }),
        });
        const data = await res.json();
        if (!res.ok) { setError(formatApiError(data, 'No fue posible guardar el borrador.')); return; }
        rosId = data.id;
        numeroRos = data.numero_ros;
      }

      const ok = await uploadFiles(rosId);
      if (!ok) return;

      setSuccess(`Borrador ${numeroRos} guardado.`);
      router.refresh();
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
          <label htmlFor="fecha-deteccion">Fecha de detección <span className="req">*</span></label>
          <input id="fecha-deteccion" type="date" value={fechaDeteccion} onChange={(e) => setFechaDeteccion(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="oficial-cumplimiento">Oficial de cumplimiento <span className="req">*</span></label>
          <input id="oficial-cumplimiento" value={oficial} onChange={(e) => setOficial(e.target.value)} required placeholder="Nombre completo" />
        </div>
        <div className="field">
          <label htmlFor="correo-oficial">Correo institucional <span className="req">*</span></label>
          <input id="correo-oficial" type="email" value={correoOficial} onChange={(e) => setCorreoOficial(e.target.value)} required placeholder="correo@entidad.com" />
        </div>

        {/* ── Sección 2: Personas relacionadas ── */}
        <div className="section-title">
          <span className="section-num">2</span>
          Validación de personas relacionadas
        </div>
        <div className="notice" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <Shield size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          <strong>Privacidad</strong>: si {isBank && tipoCliente === 'juridica' ? 'un RUC' : 'una cédula/RUC'} ya existe en nuestros registros,
          solo verás {isBank && tipoCliente === 'juridica' ? <strong>la razón social</strong> : <strong>el nombre</strong>} para corroboración. No se autocompletan datos sensibles.
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
                <PartyCard label="Persona que realiza la transacción" role="Ordenante" icon={<User size={14} />} required
                  esJuridica={tipoCliente === 'juridica'}
                  state={ordenante} setState={setOrdenante}
                  onVerify={() => verifyParty('ordenante', ordenante, setOrdenante)} />
                <PartyCard label="Beneficiario" role="Beneficiario" icon={<User size={14} />} required
                  esJuridica={tipoCliente === 'juridica'}
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
              <PartyCard label="Cliente / Comprador reportado" role="Comprador" icon={<Building2 size={14} />} required
                state={comprador} setState={setComprador}
                onVerify={() => verifyParty('comprador', comprador, setComprador)} />
            </div>
          </div>
        )}

        {isGeneric && (
          <div className="field full">
            <div className="helper" style={{ marginBottom: 8 }}>
              Verifique al cliente o parte involucrada. El sistema solo mostrará el nombre si la cédula/RUC existe en el directorio.
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="tipo-cliente-generic">Tipo de persona</label>
              <select id="tipo-cliente-generic" value={tipoCliente} onChange={(e) => setTipoCliente(e.target.value as 'natural' | 'juridica')}>
                <option value="natural">Persona Natural</option>
                <option value="juridica">Persona Jurídica</option>
              </select>
            </div>
            <div className="lookup-grid single">
              <PartyCard label="Cliente / Parte involucrada" role="Cliente" icon={<User size={14} />} required
                esJuridica={tipoCliente === 'juridica'}
                state={cliente} setState={setCliente}
                onVerify={() => verifyParty('cliente', cliente, setCliente)} />
            </div>
          </div>
        )}

        {/* ── Sección 3: Operación sospechosa ── */}
        <div className="section-title">
          <span className="section-num">3</span>
          Información de la operación sospechosa
        </div>
        <div className="field">
          <label htmlFor="monto">Monto aproximado (USD) <span className="req">*</span></label>
          <input id="monto" type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="985000" required />
        </div>
        <div className="field">
          <label htmlFor="jurisdiccion">{isRealEstate ? 'Ubicación del bien inmueble' : 'Jurisdicción relacionada'} <span className="req">*</span></label>
          <input id="jurisdiccion" value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)} placeholder={isRealEstate ? 'Costa del Este, Panamá' : 'Panamá / Suiza'} />
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
            <label htmlFor="producto-servicio">Producto bancario involucrado <span className="req">*</span></label>
            <input id="producto-servicio" value={productoServicio} onChange={(e) => setProductoServicio(e.target.value)} placeholder="Cuenta, préstamo, tarjeta, transferencia…" />
          </div>
        )}
        {isRealEstate && (
          <>
            <div className="field">
              <label htmlFor="bien-inmueble">Bien inmueble involucrado <span className="req">*</span></label>
              <input id="bien-inmueble" value={bienInmueble} onChange={(e) => setBienInmueble(e.target.value)} placeholder="Apartamento, finca, casa, local…" />
            </div>
            <div className="field">
              <label htmlFor="forma-pago">Forma de pago <span className="req">*</span></label>
              <input id="forma-pago" value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Efectivo, transferencia, mixto…" />
            </div>
          </>
        )}
        <div className="field full">
          <label htmlFor="descripcion">Descripción narrativa de los hechos <span className="req">*</span></label>
          <textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required minLength={30}
            placeholder="Explique la operación, la inusualidad detectada, las gestiones realizadas y por qué se considera sospechosa." />
          <div className="helper">
            Mínimo 30 caracteres ({descripcion.length} escritos).
            Una narrativa insuficiente puede generar solicitud de subsanación.
          </div>
        </div>

        {/* ── Sección dinámica: campos definidos por la plantilla (RF-01, data-driven) ── */}
        {camposDinamicos.length > 0 && (
          <>
            <div className="section-title">
              <span className="section-num" aria-hidden="true">+</span>
              Información adicional de la plantilla
            </div>
            {camposDinamicos.map((c) => {
              const val = camposValores[c.id] ?? '';
              const req = c.obligatorio === 1;
              const fid = `campo-${c.id}`;
              return (
                <div className={`field${c.tipo_dato === 'textarea' ? ' full' : ''}`} key={c.id}>
                  <label htmlFor={fid}>
                    {c.nombre}{req && <span className="req"> *</span>}
                  </label>
                  {c.tipo_dato === 'textarea' ? (
                    <textarea id={fid} value={val} required={req}
                      onChange={(e) => setCampoValor(c.id, e.target.value)}
                      placeholder="Información requerida por la plantilla" />
                  ) : (
                    <input id={fid} value={val} required={req}
                      type={c.tipo_dato === 'number' ? 'number' : c.tipo_dato === 'date' ? 'date' : 'text'}
                      onChange={(e) => setCampoValor(c.id, e.target.value)} />
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── Sección 4: Sustento documental ── */}
        <div className="section-title">
          <span className="section-num">4</span>
          Sustento documental
        </div>

        <div className="field full">
          {/* KPI summary */}
          <div className="doc-summary">
            <div className="info-box" style={{ borderColor: '#dbe8f6', background: 'var(--primary-soft)' }}>
              <span style={{ color: 'var(--primary)' }}>Obligatorios</span>
              <strong style={{ color: 'var(--primary)' }}>{docListReq.length}</strong>
            </div>
            {docList.length > docListReq.length && (
              <div className="info-box">
                <span>Opcionales</span>
                <strong>{docList.length - docListReq.length}</strong>
              </div>
            )}
            <div className="info-box" style={{ borderColor: cargados > 0 ? 'rgba(21,128,61,.3)' : undefined, background: cargados > 0 ? 'var(--green-soft)' : undefined }}>
              <span style={{ color: cargados > 0 ? 'var(--green)' : undefined }}>Cargados</span>
              <strong style={{ color: cargados > 0 ? 'var(--green)' : 'var(--primary)' }}>{cargados}</strong>
            </div>
            <div className="info-box" style={{ borderColor: docListReq.length - cargadosReq > 0 ? '#fedf89' : 'rgba(21,128,61,.3)', background: docListReq.length - cargadosReq > 0 ? 'var(--amber-soft)' : 'var(--green-soft)' }}>
              <span style={{ color: docListReq.length - cargadosReq > 0 ? 'var(--amber)' : 'var(--green)' }}>Pendientes obligatorios</span>
              <strong style={{ color: docListReq.length - cargadosReq > 0 ? 'var(--amber)' : 'var(--green)' }}>{docListReq.length - cargadosReq}</strong>
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
              return (
                <div key={d.id} className={`doc-card${file ? ' uploaded' : ''}`}>
                  <div className="doc-top">
                    <div className="doc-title">
                      <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5, opacity: .6 }} />
                      {i + 1}. {d.nombre}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      {d.tipo_requerimiento !== 'requerido' && (
                        <span className="badge gray" style={{ fontSize: 10 }}>Opcional</span>
                      )}
                      <span className={`badge ${uploaded ? 'green' : d.tipo_requerimiento === 'requerido' ? 'amber' : 'gray'}`}>
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
                  {!fileLabels[d.id] && (
                    <FileDropZone
                      file={file}
                      onChange={(f) => setFiles({ ...files, [d.id]: f })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Observaciones adicionales — A3: permite enviar con docs faltantes si se justifica */}
        <div className="field full">
          <label htmlFor="observaciones-adicionales">
            Observaciones adicionales
            {!todosDocumentosCargados && <span className="req"> *</span>}
          </label>
          <textarea
            id="observaciones-adicionales"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Explique cualquier documento faltante, aclaración o información adicional relevante."
          />
          {!todosDocumentosCargados && (
            <div className="helper" style={{ color: observaciones.trim().length >= 10 ? 'var(--green)' : 'var(--amber)' }}>
              {observaciones.trim().length >= 10
                ? `Justificación registrada (${observaciones.trim().length} caracteres). Puede enviar el ROS con documentos pendientes.`
                : `Faltan documentos. Puede enviar el ROS si justifica la ausencia aquí (mín. 10 caracteres · ${observaciones.trim().length}/10).`}
            </div>
          )}
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
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={(e) => {
                const valid = Array.from(e.target.files ?? []).filter((f) => isAllowedFile(f) && f.size <= MAX_BYTES);
                setExtras(valid);
              }}
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

        {/* A6 — Alerta de posible duplicidad */}
        {duplicadosPendientes.length > 0 && (
          <div style={{
            gridColumn: '1 / -1',
            border: '1.5px solid #f59e0b',
            borderRadius: 10,
            background: '#fffbeb',
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <strong style={{ color: '#92400e', fontSize: 14 }}>
                Posible duplicidad detectada
              </strong>
            </div>
            <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 10px 0' }}>
              Tu organización ya tiene {duplicadosPendientes.length === 1 ? 'un ROS reciente' : `${duplicadosPendientes.length} ROS recientes`} con
              la misma parte involucrada y monto similar en los últimos 30 días.
              Si se trata de una operación distinta, puedes continuar de todas formas.
            </p>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 14 }}>
              <thead>
                <tr style={{ background: '#fef3c7' }}>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#78350f' }}>Nº ROS</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#78350f' }}>Partes coincidentes</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#78350f' }}>Monto</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#78350f' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600, color: '#78350f' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {duplicadosPendientes.map((d) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #fde68a' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#92400e' }}>{d.numero_ros}</td>
                    <td style={{ padding: '5px 8px', color: '#92400e' }}>
                      {d.partes.map((p, pi) => (
                        <span key={p.enmascarada}>
                          {p.enmascarada} <span style={{ opacity: .7 }}>({p.rol})</span>
                          {pi < d.partes.length - 1 && <br />}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: '5px 8px', color: '#92400e' }}>${d.monto.toLocaleString()}</td>
                    <td style={{ padding: '5px 8px', color: '#92400e' }}>{new Date(d.fecha_recepcion).toLocaleDateString('es-PA')}</td>
                    <td style={{ padding: '5px 8px', color: '#92400e' }}>{d.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn primary"
                style={{ background: '#d97706', borderColor: '#d97706', fontSize: 13 }}
                onClick={() => { confirmarPeseRef.current = true; }}
              >
                Continuar de todas formas
              </button>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 13 }}
                onClick={() => setDuplicadosPendientes([])}
              >
                Cancelar y revisar
              </button>
            </div>
          </div>
        )}

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
          <button type="submit" className="btn primary" disabled={submitting || pending || !formListo} style={{ minWidth: 200, justifyContent: 'center' }}>
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
            disabled={submitting || pending || !hayAlgunDato}
            style={{ minWidth: 160, justifyContent: 'center' }}
            onClick={onSaveDraft}
          >
            <Save size={16} />
            {esEdicion ? 'Guardar borrador' : 'Guardar borrador'}
          </button>
          {!formListo && (
            <div className="helper" style={{ margin: 0, alignSelf: 'center', color: 'var(--amber)' }}>
              Complete todos los campos obligatorios para habilitar el envío.
            </div>
          )}
        </div>

      </div>

    </form>
  );
}

function PartyCard({
  label, role, icon, required, esJuridica, state, setState, onVerify,
}: {
  label: string;
  role: string;
  icon: React.ReactNode;
  required?: boolean;
  esJuridica?: boolean;
  state: PartyState;
  setState: (s: PartyState) => void;
  onVerify: () => void;
}) {
  const idLabel    = esJuridica ? 'RUC' : 'Cédula';
  const nombreLabel = esJuridica ? 'Razón social encontrada' : 'Nombre encontrado';
  const coincidenciaMsg = esJuridica
    ? `Coincidencia encontrada. Por privacidad, únicamente se muestra la razón social del ${role.toLowerCase()}.`
    : `Coincidencia encontrada. Por privacidad, únicamente se muestra el nombre del ${role.toLowerCase()}.`;

  return (
    <div className="lookup-card">
      <div className="lookup-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}{required && <span className="req">*</span>}
      </div>
      <div className="lookup-row">
        <input
          placeholder={`${idLabel} del ${role.toLowerCase()}`}
          value={state.id}
          onChange={(e) => setState({ ...state, id: e.target.value, status: 'idle', nombre: '' })}
          autoComplete="off"
          maxLength={20}
        />
        <button type="button" className="btn secondary" onClick={onVerify} style={{ whiteSpace: 'nowrap' }}>
          Verificar
        </button>
      </div>
      {state.status === 'verified' && (
        <div className="client-status found" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} style={{ flexShrink: 0 }} />
          {coincidenciaMsg}
        </div>
      )}
      {state.status === 'not_found' && (
        <div className="client-status warning" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {state.message ?? 'Sin coincidencia. La UAF validará con la documentación adjunta.'}
        </div>
      )}
      {state.status === 'error' && (
        <div className="client-status error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {state.message}
        </div>
      )}
      <div className="field full">
        <label>{nombreLabel}</label>
        <input value={state.nombre} readOnly placeholder={`Solo se mostrará ${esJuridica ? 'la razón social' : 'el nombre'} si existe coincidencia`} />
      </div>
    </div>
  );
}
