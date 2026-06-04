import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { BackButton } from '@/components/BackButton';
import { NuevoRosForm } from '../../nuevo/NuevoRosForm';

interface SujetoRow { id: string; nombre: string; tipo: string }
interface PlantillaRow { id: string; nombre: string; tipo_sujeto_obligado: string }
interface DocRow { id: string; plantilla_id: string; nombre: string; orden: number; tipo_requerimiento: string }

interface RosRow {
  id: string; numero_ros: string; plantilla_id: string;
  oficial_cumplimiento: string; correo_oficial: string | null;
  fecha_deteccion: string; descripcion: string; estado: string;
}

interface OpRow {
  monto: number; jurisdiccion: string | null;
  senal_alerta: string; producto_servicio: string | null;
  bien_inmueble: string | null; forma_pago: string | null;
  tipo_operacion: string | null;
}

interface ParteRow {
  rol_en_operacion: string; tipo_persona: string;
  identificador: string; nombre_visible: string | null;
}

interface DocAdjRow {
  id: string; documento_requerido_id: string | null;
  nombre_archivo: string;
}

function partyStatus(row: ParteRow): 'verified' | 'not_found' {
  return row.nombre_visible ? 'verified' : 'not_found';
}

export default async function EditarBorradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const soId = session.user.sujetoObligadoId!;

  const ros = db.prepare<[string], RosRow>(
    'SELECT * FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) notFound();
  if (ros.estado !== 'borrador') redirect('/portal/ros');
  if (session.user.sujetoObligadoId !== null) {
    const r = db.prepare('SELECT sujeto_obligado_id FROM ros WHERE id = ?').get(id) as { sujeto_obligado_id: string };
    if (r.sujeto_obligado_id !== soId) redirect('/portal/ros');
  }

  const so = db.prepare<[string], SujetoRow>('SELECT id, nombre, tipo FROM sujeto_obligado WHERE id = ?').get(soId);
  if (!so) redirect('/portal');

  const plantillas = db.prepare<[string], PlantillaRow>(
    `SELECT pl.id, pl.nombre, pl.tipo_sujeto_obligado
       FROM plantilla_ros pl
       JOIN sujeto_obligado_plantilla sopl ON sopl.plantilla_id = pl.id
      WHERE sopl.sujeto_obligado_id = ? AND pl.activa = 1
      ORDER BY pl.nombre`,
  ).all(soId);

  const docs = db.prepare<[], DocRow>(
    'SELECT id, plantilla_id, nombre, orden, tipo_requerimiento FROM documento_requerido ORDER BY plantilla_id, orden',
  ).all();

  const docsByPlantilla: Record<string, DocRow[]> = {};
  for (const d of docs) {
    if (plantillas.find((p) => p.id === d.plantilla_id)) {
      (docsByPlantilla[d.plantilla_id] ||= []).push(d);
    }
  }

  const op = db.prepare<[string], OpRow | undefined>(
    'SELECT * FROM operacion_sospechosa WHERE ros_id = ?',
  ).get(id);

  const partes = db.prepare<[string], ParteRow>(
    'SELECT rol_en_operacion, tipo_persona, identificador, nombre_visible FROM parte_involucrada WHERE ros_id = ?',
  ).all(id);

  const adjuntos = db.prepare<[string], DocAdjRow>(
    'SELECT id, documento_requerido_id, nombre_archivo FROM documento_adjunto WHERE ros_id = ?',
  ).all(id);

  const uploadedDocs: Record<string, string> = {};
  for (const a of adjuntos) {
    if (a.documento_requerido_id) uploadedDocs[a.documento_requerido_id] = a.nombre_archivo;
  }

  const partePorRol: Record<string, ParteRow> = {};
  for (const p of partes) partePorRol[p.rol_en_operacion] = p;

  const initialData = {
    rosId: ros.id,
    plantillaId: ros.plantilla_id,
    oficial: ros.oficial_cumplimiento,
    correoOficial: ros.correo_oficial ?? '',
    fechaDeteccion: ros.fecha_deteccion.slice(0, 10),
    descripcion: ros.descripcion,
    monto: op?.monto ?? 0,
    jurisdiccion: op?.jurisdiccion ?? '',
    senalAlerta: op?.senal_alerta ?? '',
    productoServicio: op?.producto_servicio ?? '',
    bienInmueble: op?.bien_inmueble ?? '',
    formaPago: op?.forma_pago ?? '',
    tipoCliente: (partePorRol['ordenante']?.tipo_persona ?? 'natural') as 'natural' | 'juridica',
    ordenante: partePorRol['ordenante']
      ? { id: partePorRol['ordenante'].identificador, status: partyStatus(partePorRol['ordenante']), nombre: partePorRol['ordenante'].nombre_visible ?? '' }
      : { id: '', status: 'idle' as const, nombre: '' },
    beneficiario: partePorRol['beneficiario']
      ? { id: partePorRol['beneficiario'].identificador, status: partyStatus(partePorRol['beneficiario']), nombre: partePorRol['beneficiario'].nombre_visible ?? '' }
      : { id: '', status: 'idle' as const, nombre: '' },
    comprador: partePorRol['comprador']
      ? { id: partePorRol['comprador'].identificador, status: partyStatus(partePorRol['comprador']), nombre: partePorRol['comprador'].nombre_visible ?? '' }
      : { id: '', status: 'idle' as const, nombre: '' },
    uploadedDocs,
  };

  return (
    <>
      <TopBar
        eyebrow="Editar borrador"
        title={`Editar ${ros.numero_ros}`}
        description="Complete o corrija los datos del borrador antes de enviarlo a la UAF."
        right={<BackButton href="/portal/ros" label="Mis ROS" />}
      />

      <NuevoRosForm
        sujeto={{ id: so.id, nombre: so.nombre, tipo: so.tipo }}
        plantillas={plantillas}
        docsByPlantilla={docsByPlantilla}
        oficialDefault={session.user.name ?? ''}
        correoDefault={session.user.email ?? ''}
        initialData={initialData}
      />
    </>
  );
}
