import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { NuevoPlantillaForm } from './NuevoPlantillaForm';

export const revalidate = 0;

interface Row {
  id: string;
  nombre: string;
  version: string;
  tipo_sujeto_obligado: string;
  sector: string | null;
  activa: number;
  campos: number;
  documentos: number;
  asociados: number;
}

export default async function PlantillasAdmin() {
  const session = await auth();

  const rows = db.prepare<[], Row>(
    `
    SELECT pl.id, pl.nombre, pl.version, pl.tipo_sujeto_obligado, pl.sector, pl.activa,
           (SELECT COUNT(*) FROM campo_plantilla       WHERE plantilla_id = pl.id) AS campos,
           (SELECT COUNT(*) FROM documento_requerido   WHERE plantilla_id = pl.id) AS documentos,
           (SELECT COUNT(*) FROM sujeto_obligado_plantilla WHERE plantilla_id = pl.id) AS asociados
      FROM plantilla_ros pl
     ORDER BY pl.tipo_sujeto_obligado, pl.nombre
    `,
  ).all();

  return (
    <>
      <TopBar
        eyebrow="Plantillas ROS"
        title="Plantillas dinámicas por sector"
        description="Define la estructura de un ROS según el tipo de sujeto obligado. El sistema admite nuevas plantillas sin necesidad de rediseñar la solución (RE-02)."
      />

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Plantilla</th>
              <th>Tipo</th>
              <th>Sector</th>
              <th>Versión</th>
              <th>Documentos requeridos</th>
              <th>Sujetos asociados</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.nombre}</strong></td>
                <td>{r.tipo_sujeto_obligado}</td>
                <td>{r.sector ?? '—'}</td>
                <td>{r.version}</td>
                <td>{r.documentos}</td>
                <td>{r.asociados}</td>
                <td><Badge tone={r.activa ? 'green' : 'amber'}>{r.activa ? 'activa' : 'inactiva'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        Las plantillas preexistentes (Banco Persona Natural, Banco Persona Jurídica, Inmobiliaria) traen
        precargados los documentos requeridos del Manual de Calidad de ROS de la UAF (2018). Las nuevas
        plantillas se crean sin documentos; un analista puede agregarlos según el sector (RE-02).
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Crear nueva plantilla ROS</h3>
        <p className="small" style={{ marginBottom: 14 }}>
          Permite registrar nuevos tipos de sujeto obligado sin modificar el código (RE-02).
          Tras crear la plantilla, asígnela al sujeto obligado correspondiente desde la sección de sujetos obligados.
        </p>
        <NuevoPlantillaForm />
      </div>
    </>
  );
}
