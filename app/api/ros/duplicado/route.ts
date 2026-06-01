// /api/ros/duplicado — Detección de posible duplicidad (A6, CU-01 flujo alterno)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/lib/db';

const schema = z.object({
  identificadores: z.array(z.string().min(1)).min(1),
  monto: z.number().positive(),
  ventana_dias: z.number().int().positive().optional().default(30),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'sujeto_obligado') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const sujetoId = session.user.sujetoObligadoId;
  if (!sujetoId) return NextResponse.json({ error: 'Usuario sin entidad asociada' }, { status: 400 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { identificadores, monto, ventana_dias } = parsed.data;
  const margenPct = 0.10; // ±10 % del monto se considera "similar"

  const placeholders = identificadores.map(() => '?').join(', ');

  // Busca ROS de la misma organización con alguna parte coincidente,
  // monto similar (±10 %) y creado en la ventana de días reciente.
  // Excluye borradores propios porque aún no son reportes formales.
  // Una fila por ROS (DISTINCT en r.id); las partes coincidentes se agregan aparte.
  const rosRows = db.prepare(`
    SELECT DISTINCT
      r.id,
      r.numero_ros,
      r.estado,
      r.fecha_recepcion,
      o.monto
    FROM ros r
    JOIN parte_involucrada p ON p.ros_id = r.id
    JOIN operacion_sospechosa o ON o.ros_id = r.id
    WHERE r.sujeto_obligado_id = ?
      AND r.estado != 'borrador'
      AND p.identificador IN (${placeholders})
      AND o.monto BETWEEN ? AND ?
      AND r.fecha_recepcion >= datetime('now', ? || ' days')
    ORDER BY r.fecha_recepcion DESC
    LIMIT 5
  `).all(
    sujetoId,
    ...identificadores,
    monto * (1 - margenPct),
    monto * (1 + margenPct),
    `-${ventana_dias}`,
  ) as Array<{ id: string; numero_ros: string; estado: string; fecha_recepcion: string; monto: number }>;

  // Para cada ROS encontrado, obtener solo las partes que coincidieron con la búsqueda.
  const partesStmt = db.prepare(`
    SELECT identificador_enmascarado, rol_en_operacion
    FROM parte_involucrada
    WHERE ros_id = ? AND identificador IN (${placeholders})
  `);

  const duplicados = rosRows.map((r) => {
    const partes = partesStmt.all(r.id, ...identificadores) as Array<{
      identificador_enmascarado: string;
      rol_en_operacion: string;
    }>;
    return {
      id: r.id,
      numero_ros: r.numero_ros,
      estado: r.estado,
      fecha_recepcion: r.fecha_recepcion,
      monto: r.monto,
      partes: partes.map((p) => ({ enmascarada: p.identificador_enmascarado, rol: p.rol_en_operacion })),
    };
  });

  return NextResponse.json({ duplicados });
}
