// GET /api/auditoria — Listado de eventos para clientes externos (CU-03)
// El log es de SOLO LECTURA en BD (trigger ABORT). Aquí también.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!['auditor', 'supervisor', 'admin'].includes(session.user.rol)) {
    const ctx403 = extractRequestContext(req);
    audit({
      modulo: 'auditoria', accion: 'consulta_log', resultado: 'bloqueado',
      usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
      ip: ctx403.ip, user_agent: ctx403.user_agent,
      criticidad: 'alta',
    });
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });
  }

  const url = new URL(req.url);
  const modulo = url.searchParams.get('modulo');
  const criticidad = url.searchParams.get('criticidad');
  const resultado = url.searchParams.get('resultado');
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');

  const where: string[] = [];
  const params: unknown[] = [];
  if (modulo)     { where.push('modulo = ?');     params.push(modulo); }
  if (criticidad) { where.push('criticidad = ?'); params.push(criticidad); }
  if (resultado)  { where.push('resultado = ?');  params.push(resultado); }
  if (desde)      { where.push('fecha_hora_servidor >= ?'); params.push(desde); }
  if (hasta)      { where.push('fecha_hora_servidor <= ?'); params.push(hasta + ' 23:59:59'); }

  const sql = `
    SELECT id, fecha_hora_servidor, usuario_correo, rol, modulo, accion, resultado,
           ip, recurso_afectado, criticidad
      FROM evento_auditoria
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY fecha_hora_servidor DESC
     LIMIT 500
  `;
  const rows = db.prepare<unknown[], unknown>(sql).all(...params);

  // CU-03 · la consulta al log queda auditada
  const ctx = extractRequestContext(req);
  audit({
    modulo: 'auditoria', accion: 'consulta_log_api', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { filtros: { modulo, criticidad, resultado, desde, hasta } },
  });

  return NextResponse.json(rows);
}
