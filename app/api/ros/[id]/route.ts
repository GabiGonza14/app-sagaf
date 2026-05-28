// /api/ros/[id] — GET, PATCH (cambio de estado) y PUT (actualizar borrador)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { canAccessROS } from '@/lib/permissions';
import { maskIdentifier } from '@/lib/masking';

const patchSchema = z.object({
  estado: z.enum([
    'borrador', 'recibido', 'en_analisis', 'revision_documental', 'subsanacion', 'escalado', 'vinculado', 'cerrado',
  ]),
});

const putSchema = z.object({
  plantilla_id: z.string().min(1),
  oficial_cumplimiento: z.string().min(2),
  correo_oficial: z.string().email().optional(),
  fecha_deteccion: z.string().min(8),
  descripcion: z.string().optional().default(''),
  operacion: z.object({
    monto: z.number().positive().optional().default(0),
    jurisdiccion: z.string().optional().nullable(),
    senal_alerta: z.string().optional().default(''),
    producto_servicio: z.string().optional().nullable(),
    bien_inmueble: z.string().optional().nullable(),
    forma_pago: z.string().optional().nullable(),
    // PB-04: procedencia de fondos para inmobiliarias
    procedencia_fondos: z.string().optional().nullable(),
    tipo_operacion: z.string().optional().nullable(),
  }),
  partes: z.array(z.object({
    rol: z.string().min(1),
    tipo: z.enum(['natural', 'juridica']),
    identificador: z.string().min(3),
    nombre_visible: z.string().optional().nullable(),
  })).optional().default([]),
  submit: z.boolean().optional().default(false),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const ros = db.prepare<[string], { id: string; sujeto_obligado_id: string }>(
    'SELECT id, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const subject = {
    id: session.user.id, correo: session.user.email ?? '',
    rol: session.user.rol, sujeto_obligado_id: session.user.sujetoObligadoId,
  };
  if (!canAccessROS(subject, ros.sujeto_obligado_id)) {
    audit({
      modulo: 'ros', accion: 'acceso_ros', resultado: 'bloqueado',
      usuario_id: subject.id, usuario_correo: subject.correo, rol: subject.rol,
      recurso_afectado: id, criticidad: 'alta',
    });
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json(ros);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

  const ros = db.prepare<[string], { numero_ros: string; estado: string; sujeto_obligado_id: string }>(
    'SELECT numero_ros, estado, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Sujeto obligado solo puede enviar borrador → recibido
  if (session.user.rol === 'sujeto_obligado') {
    if (ros.estado !== 'borrador' || parsed.data.estado !== 'recibido') {
      return NextResponse.json({ error: 'Solo puedes enviar un borrador a la UAF' }, { status: 403 });
    }
    if (session.user.sujetoObligadoId !== ros.sujeto_obligado_id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    // Crear caso de análisis al recibir
    const numeroRos = ros.numero_ros;
    const existing = db.prepare('SELECT 1 FROM caso_analisis WHERE ros_id = ?').get(id);
    if (!existing) {
      db.prepare(`
        INSERT INTO caso_analisis (id, codigo_caso, ros_id, estado)
        VALUES (?, ?, ?, 'abierto')
      `).run(randomUUID(), `CASO-${numeroRos.replace('ROS-', '')}`, id);
    }
  } else if (!['analista', 'supervisor'].includes(session.user.rol)) {
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });
  }

  // Solo Supervisor puede cerrar
  if (parsed.data.estado === 'cerrado' && session.user.rol !== 'supervisor') {
    return NextResponse.json({ error: 'Solo Supervisor puede cerrar casos' }, { status: 403 });
  }

  db.prepare('UPDATE ros SET estado = ? WHERE id = ?').run(parsed.data.estado, id);

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'ros', accion: 'cambio_estado', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { anterior: ros.estado, nuevo: parsed.data.estado },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'sujeto_obligado') {
    return NextResponse.json({ error: 'Solo el sujeto obligado puede actualizar borradores' }, { status: 403 });
  }

  const ros = db.prepare<[string], { numero_ros: string; estado: string; sujeto_obligado_id: string }>(
    'SELECT numero_ros, estado, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (ros.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden editar borradores' }, { status: 400 });
  }
  if (session.user.sujetoObligadoId !== ros.sujeto_obligado_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = extractRequestContext(req);
  const esSubmit = parsed.data.submit;

  // Validación estricta si es submit
  if (esSubmit) {
    if (!parsed.data.descripcion || parsed.data.descripcion.length < 30) {
      return NextResponse.json({ error: 'La descripción debe tener al menos 30 caracteres' }, { status: 400 });
    }
    if (parsed.data.partes.length === 0) {
      return NextResponse.json({ error: 'Debe registrar al menos una parte involucrada' }, { status: 400 });
    }
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE ros SET plantilla_id = ?, oficial_cumplimiento = ?, correo_oficial = ?,
                      fecha_deteccion = ?, descripcion = ?,
                      estado = CASE WHEN ? THEN 'recibido' ELSE 'borrador' END
      WHERE id = ?
    `).run(
      parsed.data.plantilla_id, parsed.data.oficial_cumplimiento,
      parsed.data.correo_oficial ?? null, parsed.data.fecha_deteccion,
      parsed.data.descripcion, esSubmit ? 1 : 0, id,
    );

    // Reemplazar operacion_sospechosa
    db.prepare('DELETE FROM operacion_sospechosa WHERE ros_id = ?').run(id);
    db.prepare(`
      INSERT INTO operacion_sospechosa (id, ros_id, monto, moneda, jurisdiccion,
                                        producto_servicio, tipo_operacion, senal_alerta,
                                        bien_inmueble, forma_pago, procedencia_fondos)
      VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), id, parsed.data.operacion.monto,
      parsed.data.operacion.jurisdiccion ?? null,
      parsed.data.operacion.producto_servicio ?? null,
      parsed.data.operacion.tipo_operacion ?? null,
      parsed.data.operacion.senal_alerta,
      parsed.data.operacion.bien_inmueble ?? null,
      parsed.data.operacion.forma_pago ?? null,
      // PB-04: guardar procedencia de fondos para inmobiliarias
      parsed.data.operacion.procedencia_fondos ?? null,
    );

    // Reemplazar partes
    db.prepare('DELETE FROM parte_involucrada WHERE ros_id = ?').run(id);
    for (const p of parsed.data.partes) {
      db.prepare(`
        INSERT INTO parte_involucrada (id, ros_id, rol_en_operacion, tipo_persona,
                                       identificador, identificador_enmascarado, nombre_visible,
                                       datos_sensibles_bloqueados)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        randomUUID(), id, p.rol, p.tipo, p.identificador,
        maskIdentifier(p.identificador), p.nombre_visible ?? null,
      );
    }

    if (esSubmit) {
      const existing = db.prepare('SELECT 1 FROM caso_analisis WHERE ros_id = ?').get(id);
      if (!existing) {
        db.prepare(`
          INSERT INTO caso_analisis (id, codigo_caso, ros_id, estado)
          VALUES (?, ?, ?, 'abierto')
        `).run(randomUUID(), `CASO-${ros.numero_ros.replace('ROS-', '')}`, id);
      }
    }
  });

  tx();

  audit({
    modulo: 'ros',
    accion: esSubmit ? 'enviar_borrador' : 'actualizar_borrador',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: ros.numero_ros,
    detalle: { submit: esSubmit, partes: parsed.data.partes.length },
  });

  return NextResponse.json({ ok: true, numero_ros: ros.numero_ros, submit: esSubmit });
}
