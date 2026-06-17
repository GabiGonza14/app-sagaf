import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { Users, Building2, FileText, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export const revalidate = 0;

interface UsuarioSinMFA {
  nombre: string;
  correo: string;
  rol_nombre: string;
}

export default async function AdminHome() {
  const session = await auth();

  const usuarios    = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM usuario`).get()!.c;
  const sujetos     = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM sujeto_obligado WHERE estado = 'activo'`).get()!.c;
  const plantillas  = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM plantilla_ros WHERE activa = 1`).get()!.c;
  const mfaPendiente = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM usuario WHERE mfa_activo = 0 AND estado = 'activo'`).get()!.c;

  const usuariosSinMFA = db
    .prepare<[], UsuarioSinMFA>(
      `SELECT u.nombre, u.correo, r.nombre AS rol_nombre
         FROM usuario u
         JOIN rol r ON r.id = u.rol_id
        WHERE u.mfa_activo = 0 AND u.estado = 'activo'
        LIMIT 5`,
    )
    .all();

  return (
    <>
      <TopBar
        eyebrow="Administración SAGAF"
        title="Panel de administración"
        description="Gestiona usuarios, sujetos obligados y plantillas de ROS. Este rol no tiene acceso al contenido sensible de los reportes (separación de responsabilidades)."
      />

      <div className="kpis">
        <KpiCard label="Usuarios activos"      value={usuarios}      badge="Total registrados" tone="blue" />
        <KpiCard label="Sujetos obligados"     value={sujetos}       badge="Activos"           tone="teal" />
        <KpiCard label="Plantillas ROS activas" value={plantillas}   badge="Por sector"        tone="green" />
        <KpiCard label="Sin MFA enrolado"      value={mfaPendiente}  badge="Requieren acción"  tone="amber" />
      </div>

      {/* Alerta MFA */}
      {mfaPendiente > 0 && (
        <div className="notice amber" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>
              {mfaPendiente} usuario{mfaPendiente > 1 ? 's' : ''} aún no ha{mfaPendiente > 1 ? 'n' : ''} completado el enrolamiento MFA
            </strong>
            <div style={{ display: 'grid', gap: 3 }}>
              {usuariosSinMFA.map((u) => (
                <span key={u.correo} style={{ fontSize: 12 }}>
                  <strong>{u.nombre}</strong> ({u.rol_nombre}) — {u.correo}
                </span>
              ))}
            </div>
            <Link href="/admin/usuarios" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: '#7a4b00', textDecoration: 'underline' }}>
              Gestionar usuarios →
            </Link>
          </div>
        </div>
      )}

      {/* Módulos administrativos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Usuarios */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--primary-soft)', display: 'grid', placeItems: 'center' }}>
            <Users size={22} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Usuarios</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
              Crea, activa o desactiva cuentas. MFA obligatorio para todos los perfiles. Asigna roles y entidades.
            </p>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/admin/usuarios" className="btn primary" style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }}>
              Gestionar <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Sujetos obligados */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--teal-soft)', display: 'grid', placeItems: 'center' }}>
            <Building2 size={22} style={{ color: 'var(--teal)' }} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Sujetos Obligados</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
              Registra bancos, inmobiliarias y demás entidades reportantes. Asocia plantillas ROS por tipo y sector.
            </p>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/admin/sujetos-obligados" className="btn teal" style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }}>
              Gestionar <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Plantillas */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--green-soft)', display: 'grid', placeItems: 'center' }}>
            <FileText size={22} style={{ color: 'var(--green)' }} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Plantillas ROS</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
              Estructura dinámica de formularios según sector. Define documentos requeridos por tipo de sujeto obligado.
            </p>
          </div>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/admin/plantillas" className="btn ghost" style={{ marginLeft: 'auto', padding: '8px 14px', fontSize: 13 }}>
              Ver plantillas <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Aviso separación de responsabilidades */}
      <div className="notice" style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong>Separación de responsabilidades:</strong> El Administrador gestiona la infraestructura del sistema pero no tiene acceso al contenido sensible de los ROS ni al log de auditoría de casos. Esto cumple con el principio de mínimo privilegio de la Ley 23 de 2015 y los estándares GAFI.
        </span>
      </div>
    </>
  );
}
