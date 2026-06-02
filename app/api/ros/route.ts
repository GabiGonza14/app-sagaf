// /api/ros — Crear y listar ROS (CU-01, RF-01)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { generateNumeroROS } from '@/lib/ros-number';
import { maskIdentifier } from '@/lib/masking';
import { requirePermission, ForbiddenError } from '@/lib/permissions';

const schema = z.object({
  plantilla_id: z.string().min(1),
  oficial_cumplimiento: z.string().min(2),
  correo_oficial: z.string().email().optional(),
  fecha_deteccion: z.string().min(8),
  descripcion: z.string().min(1),
  operacion: z.object({
    monto: z.number().positive(),
    jurisdiccion: z.string().optional().nullable(),
    senal_alerta: z.string().min(1),
    producto_servicio: z.string().optional().nullable(),
    bien_inmueble: z.string().optional().nullable(),
    forma_pago: z.string().optional().nullable(),
    tipo_operacion: z.string().optional().nullable(),
  }),
  partes: z.array(z.object({
    rol: z.string().min(1),
    tipo: z.enum(['natural', 'juridica']),
    identificador: z.string().min(3),
    nombre_visible: z.string().optional().nullable(),
  })).min(1),
  modo: z.enum(['completo', 'borrador']).optional().default('completo'),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const subject = {
    id: session.user.id,
    correo: session.user.email ?? '',
    rol: session.user.rol,
    sujeto_obligado_id: session.user.sujetoObligadoId,
  };

  try {
    requirePermission(subject, 'ros:create');
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (!subject.sujeto_obligado_id) {
    return NextResponse.json({ error: 'Usuario sin entidad asociada' }, { status: 400 });
  }

  // A3 — Sujeto obligado inactivo no puede registrar ROS (CU-06)
  // A4 — Sin plantilla asignada no puede registrar ROS (CU-06)
  const so = db.prepare<[string], { estado: string; plantillas: number }>(
    `SELECT so.estado,
            (SELECT COUNT(*) FROM sujeto_obligado_plantilla WHERE sujeto_obligado_id = so.id) AS plantillas
       FROM sujeto_obligado so WHERE so.id = ?`,
  ).get(subject.sujeto_obligado_id);

  if (so?.estado !== 'activo') {
    return NextResponse.json(
      { error: 'Su organización está inactiva. No puede registrar nuevos ROS hasta que el administrador la habilite.' },
      { status: 403 },
    );
  }
  if (so.plantillas === 0) {
    return NextResponse.json(
      { error: 'Su organización no tiene plantillas ROS asignadas. Contacte al administrador.' },
      { status: 403 },
    );
  }

  const payload = await req.json().catch(() => null);
  const baseSchema = payload?.modo === 'borrador'
    ? schema.extend({
        partes: z.array(z.object({
          rol: z.string().min(1),
          tipo: z.enum(['natural', 'juridica']),
          identificador: z.string().min(3),
          nombre_visible: z.string().optional().nullable(),
        })).optional().default([]),
        descripcion: z.string().optional().default(''),
        operacion: z.object({
          monto: z.number().positive().optional().default(0),
          jurisdiccion: z.string().optional().nullable(),
          senal_alerta: z.string().optional().default(''),
          producto_servicio: z.string().optional().nullable(),
          bien_inmueble: z.string().optional().nullable(),
          forma_pago: z.string().optional().nullable(),
          tipo_operacion: z.string().optional().nullable(),
        }),
      })
    : schema;
  const parsed = baseSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }

  const esBorrador = parsed.data.modo === 'borrador';

  // Verifica que la plantilla esté habilitada para este sujeto obligado
  const plOk = db.prepare(
    'SELECT 1 FROM sujeto_obligado_plantilla WHERE sujeto_obligado_id = ? AND plantilla_id = ?',
  ).get(subject.sujeto_obligado_id, parsed.data.plantilla_id);
  if (!plOk) {
    return NextResponse.json({ error: 'Plantilla no autorizada para este sujeto obligado' }, { status: 403 });
  }

  const ctx = extractRequestContext(req);

  const tx = db.transaction(() => {
    const numeroRos = generateNumeroROS();
    const rosId = randomUUID();

    db.prepare(`
      INSERT INTO ros (id, numero_ros, sujeto_obligado_id, plantilla_id,
                       oficial_cumplimiento, correo_oficial, fecha_deteccion,
                       estado, descripcion, canal_recepcion, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'portal_publico', ?)
    `).run(
      rosId, numeroRos, subject.sujeto_obligado_id, parsed.data.plantilla_id,
      parsed.data.oficial_cumplimiento, parsed.data.correo_oficial ?? null,
      parsed.data.fecha_deteccion, esBorrador ? 'borrador' : 'recibido',
      parsed.data.descripcion, subject.id,
    );

    db.prepare(`
      INSERT INTO operacion_sospechosa (id, ros_id, monto, moneda, jurisdiccion,
                                        producto_servicio, tipo_operacion, senal_alerta,
                                        bien_inmueble, forma_pago)
      VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), rosId, parsed.data.operacion.monto, parsed.data.operacion.jurisdiccion ?? null,
      parsed.data.operacion.producto_servicio ?? null,
      parsed.data.operacion.tipo_operacion ?? null,
      parsed.data.operacion.senal_alerta,
      parsed.data.operacion.bien_inmueble ?? null,
      parsed.data.operacion.forma_pago ?? null,
    );

    for (const p of parsed.data.partes) {
      db.prepare(`
        INSERT INTO parte_involucrada (id, ros_id, rol_en_operacion, tipo_persona,
                                       identificador, identificador_enmascarado, nombre_visible,
                                       datos_sensibles_bloqueados)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        randomUUID(), rosId, p.rol, p.tipo, p.identificador,
        maskIdentifier(p.identificador), p.nombre_visible ?? null,
      );
    }

    if (!esBorrador) {
      db.prepare(`
        INSERT INTO caso_analisis (id, codigo_caso, ros_id, estado)
        VALUES (?, ?, ?, 'abierto')
      `).run(randomUUID(), `CASO-${numeroRos.replace('ROS-', '')}`, rosId);
    }

    return { id: rosId, numero_ros: numeroRos };
  });

  const result = tx();

  audit({
    modulo: 'ros',
    accion: esBorrador ? 'guardar_borrador' : 'crear_ros',
    resultado: 'exito',
    usuario_id: subject.id,
    usuario_correo: subject.correo,
    rol: subject.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: result.numero_ros,
    detalle: { partes: parsed.data.partes.length, monto: parsed.data.operacion.monto, modo: parsed.data.modo },
  });

  return NextResponse.json(result, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  let rows;
  if (session.user.rol === 'sujeto_obligado') {
    rows = db.prepare(
      `SELECT id, numero_ros, estado, fecha_recepcion FROM ros WHERE sujeto_obligado_id = ? ORDER BY fecha_recepcion DESC`,
    ).all(session.user.sujetoObligadoId);
  } else if (['analista', 'supervisor'].includes(session.user.rol)) {
    rows = db.prepare(
      `SELECT id, numero_ros, estado, fecha_recepcion FROM ros ORDER BY fecha_recepcion DESC`,
    ).all();
  } else {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  return NextResponse.json(rows);
}
