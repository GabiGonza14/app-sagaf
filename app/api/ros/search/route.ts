// /api/ros/search — Autocomplete de ROS para analistas y supervisores
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const rol = session.user.rol;
  if (!['analista', 'supervisor'].includes(rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const like = `%${q}%`;
  const rows = db.prepare<unknown[], { id: string; numero_ros: string; sujeto_nombre: string; estado: string }>(
    `SELECT
      r.id,
      r.numero_ros,
      so.nombre AS sujeto_nombre,
      r.estado
    FROM ros r
    JOIN sujeto_obligado so ON so.id = r.sujeto_obligado_id
    WHERE r.estado != 'borrador'
      AND (r.numero_ros LIKE ? OR so.nombre LIKE ?)
    ORDER BY r.fecha_recepcion DESC
    LIMIT 10`
  ).all(like, like);

  return NextResponse.json({ results: rows });
}
