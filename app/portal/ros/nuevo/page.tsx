import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { BackButton } from '@/components/BackButton';
import { NuevoRosForm } from './NuevoRosForm';

interface PlantillaRow {
  id: string;
  nombre: string;
  tipo_sujeto_obligado: string;
}

interface DocRow {
  id: string;
  plantilla_id: string;
  nombre: string;
  orden: number;
  tipo_requerimiento: string;
}

interface SujetoRow {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
}

export default async function NuevoRosPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const soId = session.user.sujetoObligadoId!;

  const so = db
    .prepare<[string], SujetoRow>('SELECT id, nombre, tipo, estado FROM sujeto_obligado WHERE id = ?')
    .get(soId);
  if (!so) redirect('/portal');

  // Plantillas habilitadas para este sujeto obligado (CU-06 RE-01)
  const plantillas = db
    .prepare<[string], PlantillaRow>(
      `
      SELECT pl.id, pl.nombre, pl.tipo_sujeto_obligado
        FROM plantilla_ros pl
        JOIN sujeto_obligado_plantilla sopl ON sopl.plantilla_id = pl.id
       WHERE sopl.sujeto_obligado_id = ? AND pl.activa = 1
       ORDER BY pl.nombre
      `,
    )
    .all(soId);

  const docs = db
    .prepare<[], DocRow>('SELECT id, plantilla_id, nombre, orden, tipo_requerimiento FROM documento_requerido ORDER BY plantilla_id, orden')
    .all();

  const docsByPlantilla: Record<string, DocRow[]> = {};
  for (const d of docs) {
    if (plantillas.find((p) => p.id === d.plantilla_id)) {
      (docsByPlantilla[d.plantilla_id] ||= []).push(d);
    }
  }

  // A3 — Bloqueo si sujeto obligado está inactivo (CU-06)
  if (so.estado !== 'activo') {
    return (
      <>
        <TopBar
          eyebrow="Recepción y registro"
          title="Registrar nuevo Reporte de Operación Sospechosa"
          right={<BackButton href="/portal" label="Inicio" />}
        />
        <div className="notice red" style={{ marginTop: 24 }}>
          <strong>Organización inactiva.</strong> Su organización ha sido desactivada por el administrador del sistema.
          No puede registrar nuevos ROS mientras esté inactiva. Contacte al administrador para solicitar la reactivación.
        </div>
      </>
    );
  }

  // A4 — Bloqueo si no tiene plantillas asignadas (CU-06)
  if (plantillas.length === 0) {
    return (
      <>
        <TopBar
          eyebrow="Recepción y registro"
          title="Registrar nuevo Reporte de Operación Sospechosa"
          right={<BackButton href="/portal" label="Inicio" />}
        />
        <div className="notice amber" style={{ marginTop: 24 }}>
          <strong>Sin plantillas asignadas.</strong> Su organización no tiene plantillas ROS habilitadas.
          Contacte al administrador para asociar una plantilla antes de registrar un ROS.
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        eyebrow="Recepción y registro"
        title="Registrar nuevo Reporte de Operación Sospechosa"
        right={<BackButton href="/portal" label="Inicio" />}
      />

      <NuevoRosForm
        sujeto={{ id: so.id, nombre: so.nombre, tipo: so.tipo }}
        plantillas={plantillas}
        docsByPlantilla={docsByPlantilla}
        oficialDefault={session.user.name ?? ''}
        correoDefault={session.user.email ?? ''}
      />
    </>
  );
}
