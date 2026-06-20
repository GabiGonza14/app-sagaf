// /api/ros/[id] — GET, PATCH (cambio de estado + reversión) y PUT (actualizar borrador)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { audit, extractRequestContext } from '@/lib/audit';
import { canAccessROS } from '@/lib/permissions';
import { maskIdentifier } from '@/lib/masking';
import { UPLOADS_DIR } from '@/lib/uploads';

// Mapa de transiciones válidas entre estados del ROS
// Permite avances y retrocesos controlados
const TRANSICIONES: Record<string, Set<string>> = {
  borrador:             new Set(['recibido']),
  recibido:             new Set(['en_analisis']),
  en_analisis:          new Set(['revision_documental', 'subsanacion', 'escalado', 'vinculado']),
  revision_documental:  new Set(['en_analisis', 'subsanacion', 'escalado', 'vinculado']),
  subsanacion:          new Set(['en_analisis', 'revision_documental', 'escalado', 'vinculado']),
  escalado:             new Set(['en_analisis', 'revision_documental', 'cerrado', 'vinculado']),
  vinculado:            new Set(['en_analisis', 'revision_documental', 'escalado', 'cerrado']),
  cerrado:              new Set(['en_analisis']),  // re-apertura solo supervisor
};

const patchSchema = z.object({
  estado: z.enum([
    'borrador', 'recibido', 'en_analisis', 'revision_documental', 'subsanacion', 'escalado', 'vinculado', 'cerrado',
  ]),
});

const putSchema = z.object({
  plantilla_id: z.string().min(1),
  oficial_cumplimiento: z.string().optional().default(''),
  correo_oficial: z.string().optional().default(''),
  fecha_deteccion: z.string().optional().default(''),
  descripcion: z.string().optional().default(''),
  observaciones: z.string().optional().default(''),
  operacion: z.object({
    monto: z.number().min(0).optional().default(0),
    jurisdiccion: z.string().optional().nullable(),
    senal_alerta: z.string().optional().default(''),
    producto_servicio: z.string().optional().nullable(),
    bien_inmueble: z.string().optional().nullable(),
    forma_pago: z.string().optional().nullable(),
    tipo_operacion: z.string().optional().nullable(),
  }),
  partes: z.array(z.object({
    rol: z.string().min(1),
    tipo: z.enum(['natural', 'juridica']),
    identificador: z.string().min(3, 'La cédula/RUC debe tener al menos 3 caracteres.'),
    nombre_visible: z.string().optional().nullable(),
  })).optional().default([]),
  campos: z.array(z.object({
    campo_plantilla_id: z.string().min(1),
    valor: z.string().optional().default(''),
  })).optional().default([]),
  submit: z.boolean().optional().default(false),
});

// BL-016 — Valida campos `obligatorio = 1` de la plantilla al enviar el borrador
function validateCamposObligatorios(
  plantillaId: string,
  campos: ReadonlyArray<{ campo_plantilla_id: string; valor: string }>,
): string | null {
  const obligatorios = db.prepare<[string], { id: string; nombre: string }>(
    'SELECT id, nombre FROM campo_plantilla WHERE plantilla_id = ? AND obligatorio = 1',
  ).all(plantillaId);
  const valorById = new Map(campos.map((c) => [c.campo_plantilla_id, c.valor ?? '']));
  for (const o of obligatorios) {
    if (!(valorById.get(o.id) ?? '').trim()) return `El campo "${o.nombre}" es obligatorio.`;
  }
  return null;
}

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

  const desde = ros.estado;
  const hacia = parsed.data.estado;

  // Validar transición
  const permitidos = TRANSICIONES[desde];
  if (!permitidos?.has(hacia)) {
    return NextResponse.json({
      error: `Transición no permitida: no puede ir de "${desde}" a "${hacia}".`,
    }, { status: 400 });
  }

  // Sujeto obligado solo puede enviar borrador → recibido
  if (session.user.rol === 'sujeto_obligado') {
    if (desde !== 'borrador' || hacia !== 'recibido') {
      return NextResponse.json({ error: 'Solo puedes enviar un borrador a la UAF' }, { status: 403 });
    }
    if (session.user.sujetoObligadoId !== ros.sujeto_obligado_id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    // Crear caso de análisis al recibir
    const existing = db.prepare('SELECT 1 FROM caso_analisis WHERE ros_id = ?').get(id);
    if (!existing) {
      db.prepare(`
        INSERT INTO caso_analisis (id, codigo_caso, ros_id, estado)
        VALUES (?, ?, ?, 'abierto')
      `).run(randomUUID(), `CASO-${ros.numero_ros.replace('ROS-', '')}`, id);
    }
  } else if (!['analista', 'supervisor'].includes(session.user.rol)) {
    return NextResponse.json({ error: 'Permiso insuficiente' }, { status: 403 });
  }

  // Solo Supervisor puede cerrar (hacia cerrado)
  if (hacia === 'cerrado' && session.user.rol !== 'supervisor') {
    return NextResponse.json({ error: 'Solo Supervisor puede cerrar casos' }, { status: 403 });
  }
  // Solo Supervisor puede reabrir (desde cerrado)
  if (desde === 'cerrado' && session.user.rol !== 'supervisor') {
    return NextResponse.json({ error: 'Solo Supervisor puede reabrir casos cerrados' }, { status: 403 });
  }

  const esReversion = desde === 'cerrado' || desde === 'vinculado'
    || (desde === 'escalado' && (hacia === 'en_analisis' || hacia === 'revision_documental'))
    || (desde === 'subsanacion' && (hacia === 'en_analisis' || hacia === 'revision_documental'));

  db.prepare('UPDATE ros SET estado = ? WHERE id = ?').run(hacia, id);

  const ctx = extractRequestContext(req);
  const accion = esReversion ? 'reabrir_ros' : 'cambio_estado';
  audit({
    modulo: 'ros', accion, resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { anterior: desde, nuevo: hacia },
    criticidad: esReversion ? 'alta' : 'normal',
  });

  return NextResponse.json({ ok: true, accion, desde, hacia });
}

function validateSubmitFields(data: z.infer<typeof putSchema>): string | null {
  if (!data.oficial_cumplimiento || data.oficial_cumplimiento.length < 2)
    return 'El nombre del oficial de cumplimiento es obligatorio';
  if (!data.fecha_deteccion || data.fecha_deteccion.length < 8)
    return 'La fecha de detección es obligatoria';
  if (!data.descripcion || data.descripcion.length < 30)
    return 'La descripción debe tener al menos 30 caracteres';
  if (data.partes.length === 0)
    return 'Debe registrar al menos una parte involucrada';
  return null;
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

  // Verifica que la nueva plantilla_id esté autorizada para este sujeto obligado
  const plOk = db.prepare(
    'SELECT 1 FROM sujeto_obligado_plantilla WHERE sujeto_obligado_id = ? AND plantilla_id = ?',
  ).get(session.user.sujetoObligadoId, parsed.data.plantilla_id);
  if (!plOk) {
    return NextResponse.json({ error: 'Plantilla no autorizada para este sujeto obligado' }, { status: 403 });
  }

  const ctx = extractRequestContext(req);
  const esSubmit = parsed.data.submit;

  if (esSubmit) {
    const validationError = validateSubmitFields(parsed.data);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const camposErr = validateCamposObligatorios(parsed.data.plantilla_id, parsed.data.campos);
    if (camposErr) return NextResponse.json({ error: camposErr }, { status: 400 });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE ros SET plantilla_id = ?, oficial_cumplimiento = ?, correo_oficial = ?,
                      fecha_deteccion = ?, descripcion = ?, observaciones = ?,
                      estado = CASE WHEN ? THEN 'recibido' ELSE 'borrador' END
      WHERE id = ?
    `).run(
      parsed.data.plantilla_id, parsed.data.oficial_cumplimiento,
      parsed.data.correo_oficial ?? null, parsed.data.fecha_deteccion,
      parsed.data.descripcion, parsed.data.observaciones || null,
      esSubmit ? 1 : 0, id,
    );

    // Reemplazar operacion_sospechosa
    db.prepare('DELETE FROM operacion_sospechosa WHERE ros_id = ?').run(id);
    db.prepare(`
      INSERT INTO operacion_sospechosa (id, ros_id, monto, moneda, jurisdiccion,
                                        producto_servicio, tipo_operacion, senal_alerta,
                                        bien_inmueble, forma_pago)
      VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), id, parsed.data.operacion.monto,
      parsed.data.operacion.jurisdiccion ?? null,
      parsed.data.operacion.producto_servicio ?? null,
      parsed.data.operacion.tipo_operacion ?? null,
      parsed.data.operacion.senal_alerta,
      parsed.data.operacion.bien_inmueble ?? null,
      parsed.data.operacion.forma_pago ?? null,
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

    // Reemplazar valores de campos dinámicos
    db.prepare('DELETE FROM valor_campo_ros WHERE ros_id = ?').run(id);
    for (const c of parsed.data.campos) {
      const pertenece = db.prepare('SELECT 1 FROM campo_plantilla WHERE id = ? AND plantilla_id = ?')
        .get(c.campo_plantilla_id, parsed.data.plantilla_id);
      if (pertenece && (c.valor ?? '').trim() !== '') {
        db.prepare('INSERT INTO valor_campo_ros (id, ros_id, campo_plantilla_id, valor) VALUES (?, ?, ?, ?)')
          .run(randomUUID(), id, c.campo_plantilla_id, c.valor.trim());
      }
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

// DELETE — descartar un borrador (solo el sujeto obligado dueño, solo en estado borrador)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.user.rol !== 'sujeto_obligado') {
    return NextResponse.json({ error: 'Solo el sujeto obligado puede descartar borradores' }, { status: 403 });
  }

  const ros = db.prepare<[string], { numero_ros: string; estado: string; sujeto_obligado_id: string }>(
    'SELECT numero_ros, estado, sujeto_obligado_id FROM ros WHERE id = ?',
  ).get(id);
  if (!ros) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (ros.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden descartar borradores' }, { status: 400 });
  }
  if (session.user.sujetoObligadoId !== ros.sujeto_obligado_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Borra el ROS (las tablas dependientes tienen ON DELETE CASCADE)
  db.prepare('DELETE FROM ros WHERE id = ?').run(id);

  // Limpieza best-effort de los archivos del borrador
  try {
    const dir = join(UPLOADS_DIR, id);
    if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
  } catch { /* no bloquear por error de limpieza de archivos */ }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'ros', accion: 'descartar_borrador', resultado: 'exito',
    usuario_id: session.user.id, usuario_correo: session.user.email, rol: session.user.rol,
    recurso_afectado: ros.numero_ros, ip: ctx.ip, user_agent: ctx.user_agent,
    detalle: { id },
  });

  return NextResponse.json({ ok: true });
}
