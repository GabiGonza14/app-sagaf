'use client';
import { useRef, useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, FileText, AlertCircle, User, Building2, Shield, FileCheck, Save, Info, ClipboardList, UserCheck, FileWarning, DollarSign, MapPin, Calendar, Mail, FileDigit, Type } from 'lucide-react';
import { FileDropZone, isAllowedFile, MAX_BYTES } from '@/components/FileDropZone';
import { useNavigationGuard } from '@/lib/navigation-guard';
import CustomSelect from '@/components/CustomSelect';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('es', es);

// ── Auto-save draft helpers (sessionStorage) ──
const DRAFT_KEY = 'sagaf_ros_draft';

function saveDraft(data: unknown) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

interface Plantilla { id: string; nombre: string; tipo_sujeto_obligado: string }
interface DocReq    { id: string; plantilla_id: string; nombre: string; orden: number; tipo_requerimiento: string }
interface CampoDin  { id: string; plantilla_id: string; nombre: string; tipo_dato: string; obligatorio: number; orden: number }

interface PartyState {
  id: string;
  tipo: 'natural' | 'juridica';
  status: 'idle' | 'verified' | 'not_found' | 'error';
  nombre: string;
  message?: string;
}

interface FormDraft {
  plantillaId: string;
  sujetoInvestigacion: 'natural' | 'juridica';
  ordenante: PartyState;
  beneficiario: PartyState;
  comprador: PartyState;
  cliente: PartyState;
  monto: string;
  jurisdiccion: string;
  senalAlerta: string;
  productoServicio: string;
  bienInmueble: string;
  formaPago: string;
  descripcion: string;
  oficial: string;
  correoOficial: string;
  fechaDeteccion: string;
  camposValores: Record<string, string>;
  observaciones: string;
  fileLabels: Record<string, string>;
  savedAt: number;
}

interface InitialData {
  rosId: string;
  plantillaId: string;
  oficial: string;
  correoOficial: string;
  fechaDeteccion: string;
  descripcion: string;
  observaciones?: string;
  monto: number;
  jurisdiccion: string;
  senalAlerta: string;
  productoServicio: string;
  bienInmueble: string;
  formaPago: string;
  sujetoInvestigacion: 'natural' | 'juridica';
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
  const [sujetoInvestigacion, setSujetoInvestigacion] = useState<'natural' | 'juridica'>(initialData?.sujetoInvestigacion ?? 'natural');

  const [ordenante, setOrdenante] = useState<PartyState>(
    initialData?.ordenante ?? { id: '', tipo: 'natural', status: 'idle', nombre: '' }
  );
  const [beneficiario, setBeneficiario] = useState<PartyState>(
    initialData?.beneficiario ?? { id: '', tipo: 'natural', status: 'idle', nombre: '' }
  );
  const [comprador, setComprador] = useState<PartyState>(
    initialData?.comprador ?? { id: '', tipo: 'natural', status: 'idle', nombre: '' }
  );
  const [cliente, setCliente] = useState<PartyState>(
    initialData?.cliente ?? { id: '', tipo: 'natural', status: 'idle', nombre: '' }
  );

  const [monto, setMonto] = useState(initialData?.monto != null ? String(initialData.monto) : '');
  const [jurisdiccion, setJurisdiccion] = useState(initialData?.jurisdiccion ?? '');
  const [senalAlerta, setSenalAlerta] = useState(initialData?.senalAlerta ?? '');
  const [productoServicio, setProductoServicio] = useState(initialData?.productoServicio ?? '');
  const [bienInmueble, setBienInmueble] = useState(initialData?.bienInmueble ?? '');
  const [formaPago, setFormaPago] = useState(initialData?.formaPago ?? '');
  const [descripcion, setDescripcion] = useState(initialData?.descripcion ?? '');
  const [oficial, setOficial] = useState(initialData?.oficial ?? oficialDefault);
  const [correoOficial, setCorreoOficial] = useState(initialData?.correoOficial ?? correoDefault);
  const [fechaDeteccion, setFechaDeteccion] = useState(initialData?.fechaDeteccion ?? new Date().toISOString().slice(0, 10));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [camposValores, setCamposValores] = useState<Record<string, string>>(initialData?.camposValores ?? {});
  const [observaciones, setObservaciones] = useState(initialData?.observaciones ?? '');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [extras, setExtras] = useState<File[]>([]);
  const [fileLabels, setFileLabels] = useState<Record<string, string>>(initialData?.uploadedDocs ?? {});

  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Navigation guard (unsaved changes) ──
  const { setUnsavedChanges, registerSaveDraft } = useNavigationGuard();

  function collectDraft(): FormDraft {
    return {
      plantillaId, sujetoInvestigacion,
      ordenante, beneficiario, comprador, cliente,
      monto, jurisdiccion, senalAlerta, productoServicio, bienInmueble, formaPago,
      descripcion, oficial, correoOficial, fechaDeteccion,
      camposValores, observaciones, fileLabels,
      savedAt: Date.now(),
    };
  }

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
    const want = sujetoInvestigacion === 'natural'
      ? plantillas.find((p) => p.id === 'pl_bank_natural')
      : plantillas.find((p) => p.id === 'pl_bank_legal');
    return want?.id ?? plantillaId ?? defaultPlantilla;
  }, [isBank, sujetoInvestigacion, plantillaId, plantillas, defaultPlantilla]);

  const camposDinamicos = camposByPlantilla[effectivePlantillaId] ?? [];
  const camposDinamicosOk = camposDinamicos.every(
    (c) => c.obligatorio !== 1 || (camposValores[c.id] ?? '').trim() !== '',
  );
  function setCampoValor(id: string, valor: string) {
    setCamposValores((cur) => ({ ...cur, [id]: valor }));
  }

  const docList    = docsByPlantilla[effectivePlantillaId] ?? [];
  const docListReq  = docList.filter((d) => d.tipo_requerimiento === 'requerido');
  const docListCond = docList.filter((d) => d.tipo_requerimiento === 'condicional');
  const docListOpt  = docList.filter((d) => d.tipo_requerimiento === 'opcional');
  const cargados    = docList.filter((d) => files[d.id] || fileLabels[d.id]).length;
  const cargadosReq = docListReq.filter((d) => files[d.id] || fileLabels[d.id]).length;
  const pct = docListReq.length > 0 ? Math.round((cargadosReq / docListReq.length) * 100) : 100;
  const todosDocumentosCargados = cargadosReq >= docListReq.length;

  const docsOk = todosDocumentosCargados;
  const camposBaseOk = Boolean(
    oficial.trim() &&
    isValidEmail(correoOficial) &&
    fechaDeteccion &&
    Number(monto) > 0 &&
    senalAlerta.trim() &&
    descripcion.trim().length >= 30 &&
    docsOk,
  );
  function partyNameValid(p: PartyState): boolean {
    return p.status === 'verified' || (p.status === 'not_found' && p.nombre.trim().length >= 2);
  }

  interface FaltaItem {
    label: string;
    icon: React.ReactNode;
    categoria: 'generales' | 'verificacion' | 'datos' | 'adicional' | 'documentos';
  }

  function getFaltantes(): FaltaItem[] {
    const faltantes: FaltaItem[] = [];

    // 1. Datos generales del ROS
    if (!oficial.trim()) faltantes.push({ label: 'Ingresar el nombre del oficial de cumplimiento', icon: <User size={14} />, categoria: 'generales' });
    if (!correoOficial.trim() || !isValidEmail(correoOficial)) faltantes.push({ label: 'Ingresar un correo institucional válido', icon: <Mail size={14} />, categoria: 'generales' });
    if (!fechaDeteccion) faltantes.push({ label: 'Seleccionar la fecha de detección', icon: <Calendar size={14} />, categoria: 'generales' });

    // 2. Verificación de identidad
    if (isBank) {
      if (ordenante.status === 'idle') faltantes.push({ label: 'Verificar la cédula del ordenante', icon: <UserCheck size={14} />, categoria: 'verificacion' });
      else if (ordenante.status === 'not_found' && ordenante.nombre.trim().length < 2) faltantes.push({ label: 'Ingresar el nombre del ordenante', icon: <User size={14} />, categoria: 'verificacion' });
      if (beneficiario.status === 'idle') faltantes.push({ label: 'Verificar la cédula del beneficiario', icon: <UserCheck size={14} />, categoria: 'verificacion' });
      else if (beneficiario.status === 'not_found' && beneficiario.nombre.trim().length < 2) faltantes.push({ label: 'Ingresar el nombre del beneficiario', icon: <User size={14} />, categoria: 'verificacion' });
    }

    if (isRealEstate) {
      if (comprador.status === 'idle') faltantes.push({ label: 'Verificar la cédula del comprador', icon: <UserCheck size={14} />, categoria: 'verificacion' });
      else if (comprador.status === 'not_found' && comprador.nombre.trim().length < 2) faltantes.push({ label: 'Ingresar el nombre del comprador', icon: <User size={14} />, categoria: 'verificacion' });
    }

    if (isGeneric) {
      if (cliente.status === 'idle') faltantes.push({ label: 'Verificar la cédula/RUC del cliente', icon: <UserCheck size={14} />, categoria: 'verificacion' });
      else if (cliente.status === 'not_found' && cliente.nombre.trim().length < 2) faltantes.push({ label: 'Ingresar el nombre del cliente', icon: <User size={14} />, categoria: 'verificacion' });
    }

    // 3. Datos de la operación (en orden del formulario)
    if (!monto || Number.isNaN(Number(monto)) || Number(monto) <= 0) faltantes.push({ label: 'Ingresar un monto válido mayor a 0', icon: <DollarSign size={14} />, categoria: 'datos' });
    if (!jurisdiccion.trim()) faltantes.push({ label: isRealEstate ? 'Ingresar la ubicación del bien inmueble' : 'Ingresar la jurisdicción relacionada', icon: <MapPin size={14} />, categoria: 'datos' });
    if (!senalAlerta.trim()) faltantes.push({ label: 'Seleccionar el riesgo reportado', icon: <AlertCircle size={14} />, categoria: 'datos' });
    if (isBank && !productoServicio.trim()) faltantes.push({ label: 'Ingresar el producto bancario involucrado', icon: <FileDigit size={14} />, categoria: 'datos' });
    if (isRealEstate && !bienInmueble.trim()) faltantes.push({ label: 'Ingresar el bien inmueble involucrado', icon: <Building2 size={14} />, categoria: 'datos' });
    if (isRealEstate && !formaPago.trim()) faltantes.push({ label: 'Ingresar la forma de pago', icon: <DollarSign size={14} />, categoria: 'datos' });
    if (!descripcion.trim() || descripcion.length < 30) faltantes.push({ label: `Ampliar la descripción narrativa (mín. 30 caracteres, actual: ${descripcion.length})`, icon: <Type size={14} />, categoria: 'datos' });

    // 4. Información adicional de la plantilla
    const campoFaltante = camposDinamicos.find((c) => c.obligatorio === 1 && !(camposValores[c.id] ?? '').trim());
    if (campoFaltante) faltantes.push({ label: `Completar el campo "${campoFaltante.nombre}"`, icon: <FileText size={14} />, categoria: 'adicional' });

    // 5. Sustento documental
    if (!todosDocumentosCargados) {
      faltantes.push({ label: `Cargar ${docListReq.length - cargadosReq} documento(s) obligatorio(s)`, icon: <FileWarning size={14} />, categoria: 'documentos' });
    }

    return faltantes;
  }

  const camposBancoOk = !isBank || Boolean(
    ordenante.id.trim().length >= 3 && partyNameValid(ordenante) &&
    beneficiario.id.trim().length >= 3 && partyNameValid(beneficiario) &&
    jurisdiccion.trim() &&
    productoServicio.trim(),
  );
  const camposInmobiliariaOk = !isRealEstate || Boolean(
    comprador.id.trim().length >= 3 && partyNameValid(comprador) &&
    jurisdiccion.trim() &&
    bienInmueble.trim() &&
    formaPago.trim(),
  );
  const camposGenericOk = !isGeneric || (cliente.id.trim().length >= 3 && partyNameValid(cliente));
  const formListo = camposBaseOk && camposBancoOk && camposInmobiliariaOk && camposGenericOk && camposDinamicosOk;
  const hayAlgunDato = [
    ordenante.id, beneficiario.id, comprador.id, cliente.id,
    monto, descripcion, productoServicio, bienInmueble, formaPago, jurisdiccion,
  ].some((v) => v.trim() !== '') || cargados > 0;

  // Auto-save draft every 3s when there's data
  useEffect(() => {
    if (!hayAlgunDato) return;
    const timer = setTimeout(() => saveDraft(collectDraft()), 3000);
    return () => clearTimeout(timer);
  }, [
    hayAlgunDato, plantillaId, sujetoInvestigacion,
    ordenante, beneficiario, comprador, cliente,
    monto, jurisdiccion, senalAlerta, productoServicio, bienInmueble, formaPago,
    descripcion, oficial, correoOficial, fechaDeteccion,
    camposValores, observaciones, fileLabels,
  ]);

  // beforeunload: warn browser close/refresh
  useEffect(() => {
    if (!hayAlgunDato) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hayAlgunDato]);

  // Sync unsaved changes flag for navigation guard
  useEffect(() => {
    setUnsavedChanges(hayAlgunDato);
  }, [hayAlgunDato, setUnsavedChanges]);

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
        setState({ id: state.id, tipo: state.tipo, status: 'verified', nombre: data.nombre });
      } else {
        setState({ id: state.id, tipo: state.tipo, status: 'not_found', nombre: '', message: 'Sin coincidencia. Ingrese el nombre para registrarlo en el sistema.' });
      }
    } catch {
      setState({ ...state, status: 'error', message: 'No fue posible verificar en este momento.' });
    }
  }

  function buildPartes() {
    const partes: Array<{ rol: string; tipo: string; identificador: string; nombre_visible: string }> = [];
    if (isBank) {
      if (ordenante.id.trim())
        partes.push({ rol: 'ordenante', tipo: ordenante.tipo, identificador: ordenante.id.trim(), nombre_visible: ordenante.nombre });
      if (beneficiario.id.trim())
        partes.push({ rol: 'beneficiario', tipo: beneficiario.tipo, identificador: beneficiario.id.trim(), nombre_visible: beneficiario.nombre });
    }
    if (isRealEstate && comprador.id.trim()) {
      partes.push({ rol: 'comprador', tipo: comprador.tipo, identificador: comprador.id.trim(), nombre_visible: comprador.nombre });
    }
    if (isGeneric && cliente.id.trim()) {
      partes.push({ rol: 'cliente', tipo: cliente.tipo, identificador: cliente.id.trim(), nombre_visible: cliente.nombre });
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

      clearDraft();
      setUnsavedChanges(false);
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
    if (!senalAlerta.trim()) return 'El riesgo reportado es obligatorio.';
    if (!descripcion.trim() || descripcion.length < 30)
      return 'La descripción narrativa debe tener al menos 30 caracteres.';
    if (!todosDocumentosCargados)
      return `Debe cargar todos los documentos obligatorios antes de enviar. Faltan ${docListReq.length - cargadosReq}.`;
    return null;
  }

  function validateBank(): string | null {
    if (!isBank) return null;
    if (ordenante.id.trim().length < 3) return 'La cédula del ordenante debe tener al menos 3 caracteres.';
    if (ordenante.status === 'idle') return 'Debe verificar la cédula del ordenante antes de enviar.';
    if (ordenante.status === 'error') return 'Error en la verificación del ordenante. Intente de nuevo.';
    if (ordenante.status === 'not_found' && ordenante.nombre.trim().length < 2) return 'El ordenante no fue encontrado. Debe ingresar el nombre manualmente.';
    if (beneficiario.id.trim().length < 3) return 'La cédula del beneficiario debe tener al menos 3 caracteres.';
    if (beneficiario.status === 'idle') return 'Debe verificar la cédula del beneficiario antes de enviar.';
    if (beneficiario.status === 'error') return 'Error en la verificación del beneficiario. Intente de nuevo.';
    if (beneficiario.status === 'not_found' && beneficiario.nombre.trim().length < 2) return 'El beneficiario no fue encontrado. Debe ingresar el nombre manualmente.';
    if (!jurisdiccion.trim()) return 'La jurisdicción relacionada es obligatoria.';
    if (!productoServicio.trim()) return 'El producto bancario involucrado es obligatorio.';
    return null;
  }

  function validateRealEstate(): string | null {
    if (!isRealEstate) return null;
    if (comprador.id.trim().length < 3) return 'La cédula del cliente / comprador debe tener al menos 3 caracteres.';
    if (comprador.status === 'idle') return 'Debe verificar la cédula del comprador antes de enviar.';
    if (comprador.status === 'error') return 'Error en la verificación del comprador. Intente de nuevo.';
    if (comprador.status === 'not_found' && comprador.nombre.trim().length < 2) return 'El comprador no fue encontrado. Debe ingresar el nombre manualmente.';
    if (!jurisdiccion.trim()) return 'La ubicación del bien inmueble es obligatoria.';
    if (!bienInmueble.trim()) return 'El bien inmueble involucrado es obligatorio.';
    if (!formaPago.trim()) return 'La forma de pago es obligatoria.';
    return null;
  }

  function validateGeneric(): string | null {
    if (!isGeneric) return null;
    if (cliente.id.trim().length < 3) return 'La cédula/RUC del cliente o parte involucrada debe tener al menos 3 caracteres.';
    if (cliente.status === 'idle') return 'Debe verificar la cédula/RUC del cliente antes de enviar.';
    if (cliente.status === 'error') return 'Error en la verificación del cliente. Intente de nuevo.';
    if (cliente.status === 'not_found' && cliente.nombre.trim().length < 2) return 'El cliente no fue encontrado. Debe ingresar el nombre manualmente.';
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

  async function saveDraftAction() {
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
        if (!res.ok) { throw new Error(formatApiError(data, 'Error al guardar borrador.')); }
        rosId = initialData!.rosId;
        numeroRos = data.numero_ros;
      } else {
        const res = await fetch('/api/ros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, modo: 'borrador' }),
        });
        const data = await res.json();
        if (!res.ok) { throw new Error(formatApiError(data, 'No fue posible guardar el borrador.')); }
        rosId = data.id;
        numeroRos = data.numero_ros;
      }

      const ok = await uploadFiles(rosId);
      if (!ok) throw new Error('Error al subir archivos.');

      clearDraft();
      setUnsavedChanges(false);
      setSuccess(`Borrador ${numeroRos} guardado.`);
      router.refresh();
      startTransition(() => {
        setTimeout(() => router.push(`/portal/ros/${rosId}`), 1200);
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveDraft(e: React.MouseEvent) {
    e.preventDefault();
    try {
      await saveDraftAction();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar borrador.');
    }
  }

  // Register save function with navigation guard (sin deps para tener la fn actualizada en cada render)
  useEffect(() => {
    registerSaveDraft(saveDraftAction);
    return () => registerSaveDraft(null);
  });

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
          <div className="relative">
            <DatePicker
              id="fecha-deteccion"
              selected={fechaDeteccion ? new Date(fechaDeteccion + 'T12:00:00') : null}
              onChange={(date: Date | null) => {
                if (date) {
                  const yyyy = date.getFullYear();
                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                  const dd = String(date.getDate()).padStart(2, '0');
                  setFechaDeteccion(`${yyyy}-${mm}-${dd}`);
                } else {
                  setFechaDeteccion('');
                }
              }}
              maxDate={new Date()}
              locale="es"
              dateFormat="yyyy-MM-dd"
              className="w-full"
              wrapperClassName="w-full"
              placeholderText="Seleccione una fecha"
              required
              showPopperArrow={false}
              autoComplete="off"
              popperPlacement="bottom-start"
              popperClassName="-translate-x-3 mt-1"
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="oficial-cumplimiento">Oficial de cumplimiento</label>
          <input id="oficial-cumplimiento" value={oficial} disabled />
        </div>
        <div className="field">
          <label htmlFor="correo-oficial">Correo institucional</label>
          <input id="correo-oficial" type="email" value={correoOficial} disabled />
        </div>

        {/* ── Sección 2: Personas relacionadas ── */}
        <div className="section-title">
          <span className="section-num">2</span>
          Validación de personas relacionadas
        </div>
        {isBank && (
          <div className="field full">
            <label>Sujeto de la investigación</label>
            <div className="segmented-control">
              <button type="button" className={`segment ${sujetoInvestigacion === 'natural' ? 'active' : ''}`} onClick={() => setSujetoInvestigacion('natural')}>
                Persona Natural
              </button>
              <button type="button" className={`segment ${sujetoInvestigacion === 'juridica' ? 'active' : ''}`} onClick={() => setSujetoInvestigacion('juridica')}>
                Persona Jurídica
              </button>
            </div>
            <div className="helper" style={{ marginTop: 6 }}>
              ¿A quién investiga el banco? Esto determina la plantilla y los documentos requeridos.
            </div>
          </div>
        )}
        <div className="notice" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
          <Shield size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          <strong>Privacidad</strong>: si una cédula o RUC ya existe en nuestros registros,
          solo verás el nombre o razón social para corroboración. No se autocompletan datos sensibles.
          {' '}<strong>La verificación es obligatoria</strong> antes de enviar el ROS. Si no existe el identificador, ingrese el nombre manualmente tras verificar.
        </div>

        {isBank && (
          <>
            <div className="field full">
              <div className="helper" style={{ marginBottom: 8 }}>
                Cada parte puede ser persona natural o jurídica. Seleccione el tipo y valide el identificador por separado.
              </div>
              <div className="lookup-grid">
                <PartyCard label="Persona que realiza la transacción" role="Ordenante" icon={<User size={14} />} required
                  state={ordenante} setState={setOrdenante}
                  onVerify={() => verifyParty('ordenante', ordenante, setOrdenante)} />
                <PartyCard label="Beneficiario" role="Beneficiario" icon={<User size={14} />} required
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
              Verifique al cliente o parte involucrada. Seleccione si es persona natural o jurídica.
            </div>
            <div className="lookup-grid single">
              <PartyCard label="Cliente / Parte involucrada" role="Cliente" icon={<User size={14} />} required
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
          <label>Riesgo reportado <span className="req">*</span></label>
          <CustomSelect value={senalAlerta} onChange={(e) => setSenalAlerta(e.target.value)} placeholder="Seleccione una tipología...">
            <option>Movimientos incompatibles con el perfil</option>
            <option>Uso de terceros o testaferros</option>
            <option>Procedencia de fondos no sustentada</option>
            <option>Operaciones fraccionadas</option>
            <option>Transferencias internacionales inusuales</option>
          </CustomSelect>
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
            Mínimo 30 caracteres ({descripcion.length} escritos)
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
          {/* Stat strip compacto */}
          <div className="doc-stat-strip">
            <span className="doc-stat req">
              <span className="doc-stat-dot" />
              <strong>{docListReq.length}</strong> obligatorios
            </span>
            {docListCond.length > 0 && (
              <>
                <span className="doc-stat-divider" />
                <span className="doc-stat cond">
                  <span className="doc-stat-dot" />
                  <strong>{docListCond.length}</strong> condicionales
                </span>
              </>
            )}
            {docListOpt.length > 0 && (
              <>
                <span className="doc-stat-divider" />
                <span className="doc-stat">
                  <strong>{docListOpt.length}</strong> opcionales
                </span>
              </>
            )}
            <div className="doc-stat-right">
              <span className="doc-stat-divider" />
              <span className={`doc-stat${cargados > 0 ? ' ok' : ''}`}>
                <span className="doc-stat-dot" style={{ background: cargados > 0 ? 'var(--green)' : '#cbd5e1' }} />
                <strong>{cargados}</strong> cargados
              </span>
              <span className="doc-stat-divider" />
              <span className={`doc-stat${docListReq.length - cargadosReq === 0 ? ' ok' : ' cond'}`}>
                <strong>{docListReq.length - cargadosReq}</strong> pendientes oblig.
              </span>
            </div>
          </div>

          {/* Barra de progreso */}
          {docList.length > 0 && (
            <div className="doc-progress">
              <div className="doc-progress-header">
                <span className="doc-progress-label">Progreso de carga obligatorios</span>
                <span className="doc-progress-pct">{pct}%</span>
              </div>
              <div className="doc-progress-bar">
                <div className="doc-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tarjetas de documentos agrupadas por tipo */}
        <div className="field full">
          {(() => {
            const renderCard = (d: DocReq, typeClass: string) => {
              const file = files[d.id] ?? null;
              const uploaded = file || fileLabels[d.id];
              const globalIdx = docList.findIndex(x => x.id === d.id) + 1;
              return (
                <div key={d.id} className={`doc-card ${typeClass}${file ? ' uploaded' : ''}`}>
                  <div className="doc-top">
                    <div className="doc-title" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span className="doc-num">{globalIdx}</span>
                      {d.nombre}
                    </div>
                    {(file || fileLabels[d.id] || d.tipo_requerimiento === 'requerido') && (
                      <span className={`badge ${uploaded ? 'green' : d.tipo_requerimiento === 'requerido' ? 'amber' : 'gray'}`} style={{ flexShrink: 0, fontSize: 10 }}>
                        {file ? 'Listo ✓' : fileLabels[d.id] ? 'Guardado' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                  {fileLabels[d.id] && !file ? (
                    <div className="upload-zone has-file">
                      <div className="upload-zone-content">
                        <CheckCircle size={18} className="upload-zone-icon uploaded" />
                        <div>
                          <div className="upload-zone-filename">{fileLabels[d.id]}</div>
                          <div className="upload-zone-size">Adjunto guardado · reemplazar si se desea</div>
                        </div>
                        <button type="button" className="upload-zone-remove"
                          onClick={(e) => { e.stopPropagation(); setFileLabels({ ...fileLabels, [d.id]: '' }); }}
                          aria-label="Quitar archivo">×</button>
                      </div>
                    </div>
                  ) : null}
                  {!fileLabels[d.id] && (
                    <FileDropZone file={file} onChange={(f) => setFiles({ ...files, [d.id]: f })} />
                  )}
                </div>
              );
            };
            return (
              <>
                {docListReq.length > 0 && (
                  <>
                    <div className="doc-group-label req">
                      <span className="doc-group-dot" />
                      Obligatorios — {docListReq.length} documentos
                      <span className="doc-group-line" />
                    </div>
                    <div className="doc-grid">{docListReq.map(d => renderCard(d, 'req-card'))}</div>
                  </>
                )}
                {docListCond.length > 0 && (
                  <>
                    <div className="doc-group-label cond">
                      <span className="doc-group-dot" />
                      Condicionales — {docListCond.length} documentos
                      <span className="doc-group-line" />
                    </div>
                    <div className="doc-grid">{docListCond.map(d => renderCard(d, 'cond-card'))}</div>
                  </>
                )}
                {docListOpt.length > 0 && (
                  <>
                    <div className="doc-group-label opt">
                      <span className="doc-group-dot" />
                      Opcionales — {docListOpt.length} documentos
                      <span className="doc-group-line" />
                    </div>
                    <div className="doc-grid">{docListOpt.map(d => renderCard(d, 'opt-card'))}</div>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Observaciones adicionales — A3: permite enviar con docs faltantes si se justifica */}
        <div className="field full">
          <label htmlFor="observaciones-adicionales">
            Observaciones adicionales
          </label>
          <textarea
            id="observaciones-adicionales"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Explique cualquier documento faltante, aclaración o información adicional relevante."
          />
          <div className="helper" style={{ color: 'var(--muted)' }}>
            Información adicional o aclaraciones generales sobre el caso.
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

        {/* ── Botones de acción ── */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
        </div>

        {/* ── Indicador de pasos faltantes ── */}
        {!formListo && (
          <div style={{
            gridColumn: '1 / -1',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: '#991b1b',
              fontSize: '0.875rem',
              fontWeight: 700,
            }}>
              <ClipboardList size={16} />
              Complete lo siguiente para habilitar el envío
            </div>
            {(() => {
              const items = getFaltantes();
              const cats: Record<string, FaltaItem[]> = {};
              items.forEach((it) => { (cats[it.categoria] ??= []).push(it); });
              const catMeta: Record<string, string> = {
                generales: 'Datos generales del ROS',
                verificacion: 'Verificación de identidad',
                datos: 'Datos de la operación',
                adicional: 'Información adicional',
                documentos: 'Documentación',
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries(cats).map(([cat, catItems]) => (
                    <div key={cat}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#b91c1c',
                        marginBottom: '0.5rem',
                      }}>
                        {catMeta[cat]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {catItems.map((it, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            fontSize: '0.8125rem',
                            color: '#7f1d1d',
                          }}>
                            <span style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '1.25rem',
                              height: '1.25rem',
                              borderRadius: '50%',
                              background: '#fee2e2',
                              color: '#dc2626',
                              flexShrink: 0,
                            }}>
                              {it.icon}
                            </span>
                            {it.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

      </div>

    </form>
  );
}

function PartyCard({
  label, role, icon, required, state, setState, onVerify,
}: {
  label: string;
  role: string;
  icon: React.ReactNode;
  required?: boolean;
  state: PartyState;
  setState: (s: PartyState) => void;
  onVerify: () => void;
}) {
  const esJuridica = state.tipo === 'juridica';
  const idLabel    = esJuridica ? 'RUC' : 'Cédula';
  const nombreLabel = state.status === 'not_found'
    ? (esJuridica ? 'Razón social' : 'Nombre')
    : (esJuridica ? 'Razón social encontrada' : 'Nombre encontrado');
  const coincidenciaMsg = esJuridica
    ? `Coincidencia encontrada. Por privacidad, únicamente se muestra la razón social del ${role.toLowerCase()}.`
    : `Coincidencia encontrada. Por privacidad, únicamente se muestra el nombre del ${role.toLowerCase()}.`;

  return (
    <div className="lookup-card">
      <div className="lookup-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}{required && <span className="req">*</span>}
      </div>
      <div className="segmented-control" style={{ marginBottom: 10 }}>
        <button type="button" className={`segment ${state.tipo === 'natural' ? 'active' : ''}`}
          onClick={() => setState({ ...state, tipo: 'natural', id: '', nombre: '', status: 'idle' })}>
          Persona Natural
        </button>
        <button type="button" className={`segment ${state.tipo === 'juridica' ? 'active' : ''}`}
          onClick={() => setState({ ...state, tipo: 'juridica', id: '', nombre: '', status: 'idle' })}>
          Persona Jurídica
        </button>
      </div>
      <div className="lookup-row">
        <input
          placeholder={`Ingrese ${idLabel} y haga clic en Verificar`}
          value={state.id}
          onChange={(e) => setState({ ...state, id: e.target.value, status: 'idle', nombre: '' })}
          autoComplete="off"
          maxLength={20}
        />
        <button type="button" className="btn secondary" onClick={onVerify} style={{ whiteSpace: 'nowrap' }}>
          Verificar
        </button>
      </div>
      {state.status === 'idle' && state.id.trim().length >= 3 && (
        <div className="client-status" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e0f2fe', borderColor: '#7dd3fc', color: '#0369a1' }}>
          <Info size={13} style={{ flexShrink: 0 }} />
          Haga clic en <strong>Verificar</strong> para validar este {idLabel} antes de continuar.
        </div>
      )}
      {state.status === 'verified' && (
        <div className="client-status found" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} style={{ flexShrink: 0 }} />
          {coincidenciaMsg}
        </div>
      )}
      {state.status === 'not_found' && (
        <div className="client-status warning" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {state.message ?? 'Sin coincidencia. Ingrese el nombre para registrarlo en el sistema.'}
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
        <input
          value={state.nombre}
          readOnly={state.status !== 'not_found'}
          onChange={(e) => setState({ ...state, nombre: e.target.value })}
          placeholder={
            state.status === 'not_found'
              ? `Ingrese ${esJuridica ? 'la razón social' : 'el nombre'} del ${role.toLowerCase()}`
              : `Solo se mostrará ${esJuridica ? 'la razón social' : 'el nombre'} si existe coincidencia`
          }
        />
      </div>
    </div>
  );
}
