import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { PlantillaEditor } from './PlantillaEditor';

export const revalidate = 0;

const TIPO_LABEL: Record<string, string> = {
  bank: 'Banco',
  realestate: 'Inmobiliaria',
  casino: 'Casino',
  notarios: 'Notaría',
};

interface Plantilla {
  id: string;
  nombre: string;
  version: string;
  tipo_sujeto_obligado: string;
  sector: string | null;
  activa: number;
}
interface Campo {
  id: string;
  nombre: string;
  tipo_dato: string;
  obligatorio: number;
  orden: number;
  regla_validacion: string | null;
}
interface Doc {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_requerimiento: string;
  formatos_permitidos: string;
  tamano_maximo_mb: number;
  orden: number;
}

export default async function PlantillaDetalle({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  const plantilla = db.prepare<[string], Plantilla>(
    'SELECT id, nombre, version, tipo_sujeto_obligado, sector, activa FROM plantilla_ros WHERE id = ?',
  ).get(id);
  if (!plantilla) notFound();

  const campos = db.prepare<[string], Campo>(
    'SELECT id, nombre, tipo_dato, obligatorio, orden, regla_validacion FROM campo_plantilla WHERE plantilla_id = ? ORDER BY orden',
  ).all(id);

  const documentos = db.prepare<[string], Doc>(
    `SELECT id, nombre, descripcion, tipo_requerimiento, formatos_permitidos, tamano_maximo_mb, orden
       FROM documento_requerido WHERE plantilla_id = ? ORDER BY orden`,
  ).all(id);

  const sujetos = db.prepare<[string], { nombre: string; estado: string }>(
    `SELECT so.nombre, so.estado
       FROM sujeto_obligado_plantilla sop
       JOIN sujeto_obligado so ON so.id = sop.sujeto_obligado_id
      WHERE sop.plantilla_id = ?
      ORDER BY so.nombre`,
  ).all(id);

  return (
    <>
      <Link href="/admin/plantillas" className="btn ghost" style={{ marginBottom: 14, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={15} /> Volver a plantillas
      </Link>

      <TopBar
        eyebrow={`Plantilla · ${TIPO_LABEL[plantilla.tipo_sujeto_obligado] ?? plantilla.tipo_sujeto_obligado}`}
        title={plantilla.nombre}
        description="Configura los campos del formulario dinámico y los documentos requeridos de esta plantilla. Estos cambios definen qué verá el sujeto obligado al registrar un ROS."
      />

      <PlantillaEditor
        plantilla={plantilla}
        campos={campos}
        documentos={documentos}
        sujetos={sujetos}
      />
    </>
  );
}
