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
        <div style={{ border: '1px solid var(--amber)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ background: 'var(--amber-soft)', borderBottom: '1px solid rgba(217,119,6,.18)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
            <strong style={{ color: '#7a4b00', fontSize: 13, flex: 1 }}>
              {mfaPendiente} usuario{mfaPendiente > 1 ? 's' : ''} pendiente{mfaPendiente > 1 ? 's' : ''} de enrolamiento MFA
            </strong>
            <Link href="/admin/usuarios" className="btn ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#7a4b00', borderColor: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Gestionar <ArrowRight size={13} />
            </Link>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7, background: '#fffdf7' }}>
            {usuariosSinMFA.map((u) => {
              const initials = u.nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase();
              const rolLabel = u.rol_nombre.replace(/_/g, ' ');
              return (
                <div key={u.correo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'white', border: '1px solid rgba(217,119,6,.14)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{u.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{u.correo}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>
                    {rolLabel}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--amber-soft)', color: '#7a4b00', fontWeight: 700, flexShrink: 0 }}>
                    Sin MFA
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Módulos administrativos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Usuarios */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--primary-soft), white)', border: '1px solid rgba(20,92,158,.1)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(20,92,158,.08)' }}>
            <Users size={24} style={{ color: 'var(--primary)' }} />
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
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--teal-soft), white)', border: '1px solid rgba(15,118,110,.1)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(15,118,110,.08)' }}>
            <Building2 size={24} style={{ color: 'var(--teal)' }} />
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
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--green-soft), white)', border: '1px solid rgba(21,128,61,.1)', display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(21,128,61,.08)' }}>
            <FileText size={24} style={{ color: 'var(--green)' }} />
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
          <strong>Separación de responsabilidades:</strong> El Administrador gestiona la infraestructura del sistema pero no tiene acceso al contenido sensible de los ROS ni al log de auditoría de casos. Esto cumple con el principio de mínimo privilegio.
        </span>
      </div>
    </>
  );
}
