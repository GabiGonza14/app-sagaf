import { auth } from '@/auth';
import { headers } from 'next/headers';
import { ShieldCheck } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { KpiCard } from '@/components/KpiCard';
import { AuditTable } from '@/components/AuditTable';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';

export const revalidate = 0;

interface SP {
  q?: string; modulo?: string; rol?: string; resultado?: string; criticidad?: string; desde?: string; hasta?: string;
}

export default async function AuditorHome({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await auth();
  const sp = await searchParams;
  const filters = {
    q:          sp.q          ?? '',
    modulo:     sp.modulo     ?? '',
    rol:        sp.rol        ?? '',
    resultado:  sp.resultado  ?? '',
    criticidad: sp.criticidad ?? '',
    desde:      sp.desde      ?? '',
    hasta:      sp.hasta      ?? '',
  };

  // CU-03 · auditoría de la auditoría
  const h = await headers();
  audit({
    modulo: 'auditoria',
    accion: 'consulta_log',
    resultado: 'exito',
    usuario_id: session!.user.id,
    usuario_correo: session!.user.email,
    rol: session!.user.rol,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    user_agent: h.get('user-agent'),
    detalle: filters,
  });

  const total    = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM evento_auditoria`).get()!.c;
  const fallos   = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM evento_auditoria WHERE resultado = 'fallo'`).get()!.c;
  const criticos = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM evento_auditoria WHERE criticidad = 'critica'`).get()!.c;
  const mfaFails = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM evento_auditoria WHERE accion = 'mfa_verify_failed'`).get()!.c;

  // Módulos reales en la DB (no hardcodeados)
  const modulosDisponibles = db.prepare<[], { modulo: string }>(
    `SELECT DISTINCT modulo FROM evento_auditoria ORDER BY modulo`,
  ).all().map((r) => r.modulo);

  return (
    <>
      <TopBar
        eyebrow="Auditoría interna"
        title="Auditoría del sistema SAGAF"
        description="Acceso de solo lectura al log inmutable de eventos. Muestra quién hizo qué, cuándo y sobre qué entidad. No tienes acceso al contenido de los ROS."
      />

      <div className="kpis">
        <KpiCard label="Eventos totales"   value={total}    badge="Histórico" tone="blue"   />
        <KpiCard label="Eventos con fallo" value={fallos}   badge="Revisar"   tone="amber"  />
        <KpiCard label="Eventos críticos"  value={criticos} badge="Atención"  tone="red"    />
        <KpiCard label="Fallos MFA"        value={mfaFails} badge="Seguridad" tone="purple" />
      </div>

      <div className="notice" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18 }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong>Log inmutable:</strong> Este historial es de solo lectura.
          Los triggers de base de datos bloquean cualquier UPDATE o DELETE sobre la tabla{' '}
          <code style={{ fontFamily: 'Consolas, monospace', background: '#e8f3ff', padding: '1px 5px', borderRadius: 5 }}>evento_auditoria</code>.
          La consulta que estás realizando ahora también quedó registrada.
        </span>
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h3>Eventos de auditoría</h3>
            <p>Fecha del servidor · Usuario · Rol · Módulo · Acción · Entidad afectada · Cambios · Resultado · IP</p>
          </div>
        </div>
        <AuditTable filters={filters} modulosDisponibles={modulosDisponibles} />
      </div>
    </>
  );
}
