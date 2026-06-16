// GET /api/reportes — Exportación controlada de reportes (CU-04, RE-02)
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

function buildFilter(f: Readonly<{
  sector?: string; estado?: string; fecha_desde?: string; fecha_hasta?: string;
}>) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  if (f.sector)      { conds.push('so.sector = ?');                      vals.push(f.sector); }
  if (f.estado)      { conds.push('r.estado = ?');                       vals.push(f.estado); }
  if (f.fecha_desde) { conds.push("date(r.fecha_recepcion) >= date(?)"); vals.push(f.fecha_desde); }
  if (f.fecha_hasta) { conds.push("date(r.fecha_recepcion) <= date(?)"); vals.push(f.fecha_hasta); }
  return {
    where: conds.length ? `WHERE ${conds.join(' AND ')}` : '',
    and:   conds.length ? `AND ${conds.join(' AND ')}`   : '',
    vals,
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // A3 — Exportación no autorizada: bloquear y auditar (RE-02)
  if (session.user.rol !== 'supervisor') {
    audit({
      modulo: 'reportes', accion: 'exportar_reporte', resultado: 'bloqueado',
      usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
      criticidad: 'alta',
    });
    return NextResponse.json({ error: 'La exportación está reservada al rol Supervisor' }, { status: 403 });
  }

  const url    = new URL(req.url);
  const tipo   = url.searchParams.get('tipo')        ?? 'operativo';
  const sector = url.searchParams.get('sector')      ?? '';
  const estado = url.searchParams.get('estado')      ?? '';
  const fd     = url.searchParams.get('fecha_desde') ?? '';
  const fh     = url.searchParams.get('fecha_hasta') ?? '';

  const f = buildFilter({
    sector:      sector || undefined,
    estado:      estado || undefined,
    fecha_desde: fd     || undefined,
    fecha_hasta: fh     || undefined,
  });

  const ctx = extractRequestContext(req);

  let header = '';
  let body   = '';
  let rows   = 0;

  if (tipo === 'operativo') {
    const data = db.prepare<unknown[], {
      sector: string; total: number; alto: number; medio: number; bajo: number; monto: number;
    }>(
      `SELECT so.sector, COUNT(*) AS total,
              SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'alto'  THEN 1 ELSE 0 END) AS alto,
              SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'medio' THEN 1 ELSE 0 END) AS medio,
              SUM(CASE WHEN (SELECT nivel FROM riesgo_caso WHERE ros_id = r.id ORDER BY fecha_clasificacion DESC LIMIT 1) = 'bajo'  THEN 1 ELSE 0 END) AS bajo,
              COALESCE(SUM((SELECT monto FROM operacion_sospechosa WHERE ros_id = r.id)), 0) AS monto
         FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where} GROUP BY so.sector ORDER BY total DESC`,
    ).all(...f.vals);
    header = 'sector,total,alto,medio,bajo,monto_usd\n';
    body   = data.map((r) => `${r.sector},${r.total},${r.alto},${r.medio},${r.bajo},${r.monto}`).join('\n');
    rows   = data.length;

  } else if (tipo === 'documental') {
    const data = db.prepare<unknown[], {
      nombre: string; total_ros: number; cargados: number;
    }>(
      `SELECT dr.nombre, COUNT(DISTINCT r.id) AS total_ros, COUNT(da.id) AS cargados
         FROM documento_requerido dr
         JOIN ros r ON r.plantilla_id = dr.plantilla_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         LEFT JOIN documento_adjunto da ON da.documento_requerido_id = dr.id AND da.ros_id = r.id
         ${f.where}
         GROUP BY dr.id, dr.nombre ORDER BY dr.plantilla_id, dr.orden LIMIT 25`,
    ).all(...f.vals);
    header = 'documento_requerido,esperados,cargados,faltantes,completitud_pct\n';
    body   = data.map((d) => {
      const faltantes = Math.max(0, d.total_ros - d.cargados);
      const pct = d.total_ros > 0 ? Math.round((d.cargados / d.total_ros) * 100) : 0;
      return `"${d.nombre}",${d.total_ros},${d.cargados},${faltantes},${pct}%`;
    }).join('\n');
    rows = data.length;

  } else if (tipo === 'estadistico') {
    const data = db.prepare<unknown[], { nivel: string; total: number }>(
      `SELECT rc.nivel, COUNT(DISTINCT rc.ros_id) AS total
         FROM riesgo_caso rc
         JOIN ros r ON r.id = rc.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         WHERE rc.fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)
           ${f.and}
         GROUP BY rc.nivel ORDER BY total DESC`,
    ).all(...f.vals);
    header = 'nivel_riesgo,total_ros\n';
    body   = data.map((r) => `${r.nivel},${r.total}`).join('\n');
    rows   = data.length;

  } else if (tipo === 'inteligencia') {
    const data = db.prepare<unknown[], { jurisdiccion: string; total: number }>(
      `SELECT os.jurisdiccion, COUNT(*) AS total
         FROM operacion_sospechosa os
         JOIN ros r ON r.id = os.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where ? f.where + ' AND os.jurisdiccion IS NOT NULL' : 'WHERE os.jurisdiccion IS NOT NULL'}
         GROUP BY os.jurisdiccion ORDER BY total DESC LIMIT 10`,
    ).all(...f.vals);
    header = 'jurisdiccion,total_ros\n';
    body   = data.map((r) => `"${r.jurisdiccion}",${r.total}`).join('\n');
    rows   = data.length;
  }

  audit({
    modulo: 'reportes', accion: 'exportar_reporte', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { tipo, sector, estado, fecha_desde: fd, fecha_hasta: fh, registros: rows },
    criticidad: 'alta',
  });

  const watermark = `# SAGAF — Exportación auditada · Usuario: ${session.user.email} · Generado: ${new Date().toISOString()} · Tipo: ${tipo}\n`;

  return new NextResponse(watermark + header + body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sagaf-${tipo}-${Date.now()}.csv"`,
    },
  });
}
