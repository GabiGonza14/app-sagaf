import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessROS } from '@/lib/permissions';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = db.prepare('SELECT nombre_archivo FROM documento_adjunto WHERE id = ?').get(id) as any;
  return {
    title: row ? row.nombre_archivo : 'Documento',
  };
}

export default async function DocumentViewer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) return notFound();

  // Validate access
  const row = db.prepare(`
    SELECT da.ros_id, r.sujeto_obligado_id
    FROM documento_adjunto da
    JOIN ros r ON r.id = da.ros_id
    WHERE da.id = ?
  `).get(id) as any;

  if (!row) return notFound();

  const subject = {
    id: session.user.id, correo: session.user.email ?? '',
    rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  
  if (!canAccessROS(subject, row.sujeto_obligado_id)) {
    return notFound();
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <iframe
        src={`/api/documentos/${id}/file`}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Visor de documento"
      />
    </div>
  );
}
