import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { Badge } from '@/components/Badge';
import { formatPanama } from '@/lib/date';
import { NuevoUsuarioForm } from './NuevoUsuarioForm';
import { UsuarioActions } from './UsuarioActions';

export const revalidate = 0;

interface UserRow {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  rol_id: string;
  sujeto_nombre: string | null;
  estado: string;
  mfa_activo: number;
  ultimo_acceso: string | null;
}

interface SujetoRow { id: string; nombre: string }

export default async function UsuariosAdmin() {
  const session = await auth();

  const users = db.prepare<[], UserRow>(
    `
    SELECT u.id, u.nombre, u.correo, r.nombre AS rol, u.rol_id,
           so.nombre AS sujeto_nombre, u.estado, u.mfa_activo, u.ultimo_acceso
      FROM usuario u
      JOIN rol r ON r.id = u.rol_id
      LEFT JOIN sujeto_obligado so ON so.id = u.sujeto_obligado_id
     ORDER BY u.nombre
    `,
  ).all();

  const sujetos = db.prepare<[], SujetoRow>(`SELECT id, nombre FROM sujeto_obligado WHERE estado = 'activo' ORDER BY nombre`).all();
  const roles = db.prepare<[], { id: string; nombre: string }>(`SELECT id, nombre FROM rol ORDER BY nombre`).all();

  return (
    <>
      <TopBar
        eyebrow="Control de acceso y roles"
        title="Gestión de usuarios"
        description="Crea, actualiza o desactiva usuarios. MFA es obligatorio para todos los perfiles. Los sujetos obligados solo gestionan sus propios reportes."
      />

      <div className="card">
        <div className="panel-head">
          <div><h3>Usuarios registrados</h3><p>Total: {users.length}</p></div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Sujeto obligado</th>
              <th>Estado</th>
              <th>MFA</th>
              <th>Último acceso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.correo}</td>
                <td><Badge tone="blue">{u.rol}</Badge></td>
                <td>{u.sujeto_nombre ?? '—'}</td>
                <td><Badge tone={u.estado === 'activo' ? 'green' : 'red'}>{u.estado}</Badge></td>
                <td>
                  <Badge tone={u.mfa_activo ? 'green' : 'amber'}>
                    {u.mfa_activo ? 'enrolado' : 'sin enrolar'}
                  </Badge>
                </td>
                <td className="small">{u.ultimo_acceso ? formatPanama(u.ultimo_acceso) : '—'}</td>
                <td><UsuarioActions usuarioId={u.id} estadoActual={u.estado} rolActualId={u.rol_id} roles={roles} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Crear nuevo usuario</h3>
        <p className="small" style={{ marginBottom: 14 }}>El usuario deberá enrolar su autenticador de dos factores en su primer ingreso.</p>
        <NuevoUsuarioForm sujetos={sujetos} roles={roles} />
      </div>
    </>
  );
}
