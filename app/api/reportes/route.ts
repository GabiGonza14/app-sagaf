import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';

function formatSector(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function h(s: unknown): string {
  if (s == null) return '';
  const v = String(s);
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

function tdCell(a: string, bg: string, v: string, bold?: boolean): string {
  const al = a === 'center' ? 'text-align:center;' : a === 'right' ? 'text-align:right;' : 'text-align:left;';
  const st = `padding:8px 12px;border:1px solid #d0d7e2;${al}background:${bg}${bold ? ';font-weight:700' : ''}`;
  const nf = a === 'right' ? ' mso-number-format="#,##0"' : '';
  return `<td style="${st}"${nf}>${h(v)}</td>`;
}

function sheet(title: string, heads: string[], aligns: string[], rows: string[][], foots?: string[]): string {
  const thead = heads.map((th) => `<th style="background:#0f3e69;color:#fff;font-weight:700;font-size:11px;padding:10px 12px;text-align:center;border:1px solid #1a4a7a;white-space:nowrap">${h(th)}</th>`).join('');
  const tbody = rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f0f4fa';
    const cells = r.map((c, j) => tdCell(aligns[j] ?? 'left', bg, c)).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  let foot = '';
  if (foots) {
    const cells = foots.map((f, j) => tdCell(aligns[j] ?? 'left', '#e8edf5', f, true)).join('');
    foot = `<tr>${cells}</tr>`;
  }
  return `
    <h2 style="color:#0f3e69;font-size:14px;margin:0 0 10px">${h(title)}</h2>
    <table style="border-collapse:collapse;width:auto;font-size:12px;font-family:Segoe UI,Arial,sans-serif">
      <thead>${thead}</thead>
      <tbody>${tbody}${foot}</tbody>
    </table>`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

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

  const label = tipo === 'operativo' ? 'Reporte Operativo'
    : tipo === 'documental' ? 'Reporte Documental'
    : tipo === 'estadistico' ? 'Reporte Estadístico'
    : 'Inteligencia Financiera';

  let sections = '';
  let rows = 0;

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

    const totalT = data.reduce((a, d) => a + d.total, 0);
    const totalA = data.reduce((a, d) => a + d.alto, 0);
    const totalM = data.reduce((a, d) => a + d.medio, 0);
    const totalB = data.reduce((a, d) => a + d.bajo, 0);
    const total$ = data.reduce((a, d) => a + d.monto, 0);

    sections += sheet(
      'ROS por sector económico',
      ['Sector económico', 'Total ROS', 'Alto riesgo', 'Medio riesgo', 'Bajo riesgo', 'Monto total (USD)'],
      ['left', 'center', 'center', 'center', 'center', 'right'],
      data.map((d) => [formatSector(d.sector), String(d.total), String(d.alto), String(d.medio), String(d.bajo), `$${d.monto.toLocaleString('en-US')}`]),
      ['TOTAL', String(totalT), String(totalA), String(totalM), String(totalB), `$${total$.toLocaleString('en-US')}`],
    );
    rows = data.length;

    const tiempos = db.prepare<unknown[], { numero_ros: string; fecha_recepcion: string; estado: string; tiempo_horas: number | null }>(
      `SELECT r.numero_ros, r.fecha_recepcion, r.estado,
              CAST((julianday(COALESCE(
                (SELECT MAX(fecha_hora_servidor) FROM evento_auditoria WHERE recurso_afectado = r.numero_ros),
                r.fecha_recepcion)) - julianday(r.fecha_recepcion)) * 24 AS REAL) AS tiempo_horas
         FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where} ORDER BY r.fecha_recepcion DESC LIMIT 10`,
    ).all(...f.vals);

    sections += sheet(
      'Tiempos de atención (últimos 10)',
      ['ROS', 'Recibido', 'Estado', 'Tiempo (horas)'],
      ['left', 'center', 'center', 'right'],
      tiempos.map((t) => [t.numero_ros, t.fecha_recepcion, t.estado.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), t.tiempo_horas?.toFixed(1) ?? '—']),
    );

  } else if (tipo === 'documental') {
    const data = db.prepare<unknown[], { nombre: string; total_ros: number; cargados: number }>(
      `SELECT dr.nombre, COUNT(DISTINCT r.id) AS total_ros, COUNT(da.id) AS cargados
         FROM documento_requerido dr
         JOIN ros r ON r.plantilla_id = dr.plantilla_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         LEFT JOIN documento_adjunto da ON da.documento_requerido_id = dr.id AND da.ros_id = r.id
         ${f.where}
         GROUP BY dr.id, dr.nombre ORDER BY dr.plantilla_id, dr.orden`,
    ).all(...f.vals);

    sections += sheet(
      'Completitud documental por tipo',
      ['Documento requerido', 'ROS esperados', 'Cargados', 'Faltantes', 'Completitud'],
      ['left', 'center', 'center', 'center', 'center'],
      data.map((d) => {
        const faltantes = Math.max(0, d.total_ros - d.cargados);
        const pct = d.total_ros > 0 ? Math.round((d.cargados / d.total_ros) * 100) : 0;
        return [d.nombre, String(d.total_ros), String(d.cargados), String(faltantes), `${pct}%`];
      }),
    );
    rows = data.length;

    const docsPorEstado = db.prepare<unknown[], { estado: string; total: number }>(
      `SELECT da.estado, COUNT(*) AS total
         FROM documento_adjunto da
         JOIN ros r ON r.id = da.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where} GROUP BY da.estado ORDER BY total DESC`,
    ).all(...f.vals);

    sections += sheet(
      'Documentos por estado',
      ['Estado', 'Total'],
      ['left', 'center'],
      docsPorEstado.map((d) => [d.estado, String(d.total)]),
    );

  } else if (tipo === 'estadistico') {
    const porRiesgo = db.prepare<unknown[], { nivel: string; total: number }>(
      `SELECT rc.nivel, COUNT(DISTINCT rc.ros_id) AS total
         FROM riesgo_caso rc
         JOIN ros r ON r.id = rc.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         WHERE rc.fecha_clasificacion = (SELECT MAX(fecha_clasificacion) FROM riesgo_caso WHERE ros_id = rc.ros_id)
           ${f.and}
         GROUP BY rc.nivel ORDER BY total DESC`,
    ).all(...f.vals);

    sections += sheet(
      'Distribución por nivel de riesgo',
      ['Nivel de riesgo', 'Total ROS'],
      ['left', 'center'],
      porRiesgo.map((r) => [r.nivel.toUpperCase(), String(r.total)]),
    );
    rows = porRiesgo.length;

    const porEstado = db.prepare<unknown[], { estado: string; total: number }>(
      `SELECT r.estado, COUNT(*) AS total
         FROM ros r JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where} GROUP BY r.estado ORDER BY total DESC`,
    ).all(...f.vals);

    sections += sheet(
      'ROS por estado de flujo',
      ['Estado', 'Total'],
      ['left', 'center'],
      porEstado.map((e) => [e.estado.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), String(e.total)]),
    );

  } else if (tipo === 'inteligencia') {
    const jurisdicciones = db.prepare<unknown[], { jurisdiccion: string; total: number }>(
      `SELECT os.jurisdiccion, COUNT(*) AS total
         FROM operacion_sospechosa os
         JOIN ros r ON r.id = os.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where ? f.where + ' AND os.jurisdiccion IS NOT NULL' : 'WHERE os.jurisdiccion IS NOT NULL'}
         GROUP BY os.jurisdiccion ORDER BY total DESC LIMIT 10`,
    ).all(...f.vals);

    sections += sheet(
      'Jurisdicciones más frecuentes',
      ['Jurisdicción', 'Total ROS'],
      ['left', 'center'],
      jurisdicciones.map((j) => [j.jurisdiccion, String(j.total)]),
    );
    rows = jurisdicciones.length;

    const senales = db.prepare<unknown[], { senal_alerta: string; total: number }>(
      `SELECT os.senal_alerta, COUNT(*) AS total
         FROM operacion_sospechosa os
         JOIN ros r ON r.id = os.ros_id
         JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
         ${f.where} GROUP BY os.senal_alerta ORDER BY total DESC LIMIT 10`,
    ).all(...f.vals);

    sections += sheet(
      'Riesgo reportado',
      ['Riesgo reportado', 'Frecuencia'],
      ['left', 'center'],
      senales.map((s) => [s.senal_alerta, String(s.total)]),
    );

    const vinculoStats = db.prepare<[], { total: number; confirmados: number }>(
      `SELECT COUNT(*) AS total, SUM(confirmado) AS confirmados FROM vinculo_intersectorial`,
    ).get() ?? { total: 0, confirmados: 0 };

    sections += sheet(
      'Vínculos intersectoriales',
      ['Métrica', 'Valor'],
      ['left', 'center'],
      [
        ['Detectados', String(vinculoStats.total)],
        ['Confirmados', String(vinculoStats.confirmados ?? 0)],
        ['Pendientes de revisión', String(vinculoStats.total - (vinculoStats.confirmados ?? 0))],
      ],
    );
  }

  audit({
    modulo: 'reportes', accion: 'exportar_reporte', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { tipo, sector, estado, fecha_desde: fd, fecha_hasta: fh, registros: rows },
    criticidad: 'alta',
  });

  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${h(label)}</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; }
  .header { margin-bottom: 18px; }
  .header h1 { color: #0f3e69; font-size: 18px; margin: 0 0 4px; }
  .header p { color: #64748b; font-size: 11px; margin: 0; white-space: nowrap; }
  hr { border: none; border-top: 2px solid #0f3e69; margin: 14px 0 18px; }
  .section { margin-bottom: 24px; }
</style>
</head>
<body>
<div class="header">
  <h1>SAGAF — ${h(label)}</h1>
  <p style="margin:0">Usuario: ${h(session.user.email ?? '—')}</p>
  <p style="margin:0">Generado: ${ts} (America/Panama) &nbsp;|&nbsp; Registros: ${rows}</p>
</div>
<hr>
${sections}
<div style="margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px">
  SAGAF — Sistema Automatizado de Gestión de Análisis Financiero
  <br/>Exportación auditada
</div>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="sagaf-${tipo}-${Date.now()}.xls"`,
    },
  });
}
