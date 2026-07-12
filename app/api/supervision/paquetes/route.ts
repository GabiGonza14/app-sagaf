// /api/supervision/paquetes — Solicitudes y generación de paquetes de supervisión
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, extractRequestContext } from '@/lib/audit';
import { db } from '@/lib/db';
import { nextNumeroSolicitud, resolveRosAlcance, validarAlcance } from '@/lib/supervision/alcance';
import { requireSupervisionSo } from '@/lib/supervision/auth';
import { detallePaqueteSchema } from '@/lib/supervision/detalle';
import { buildPaquete } from '@/lib/supervision/paquete-builder';
import { buildPaquetePreview } from '@/lib/supervision/preview';

const bodySchema = z.object({
  comunicacion_id: z.string().optional(),
  alcance_tipo: z.enum(['periodo', 'lista_ros', 'muestra']),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  lista_ros: z.array(z.string()).optional(),
  tamano_muestra: z.number().int().min(1).max(20).optional(),
  nivel_contenido: z.enum(['metadatos', 'resumido', 'completo']).default('metadatos'),
  incluir_documentos: z.boolean().default(false),
  incluir_log: z.boolean().default(false),
  titulo_respuesta: z.string().max(200).optional(),
  items_solicitados: z.array(z.string()).optional(),
  items_solicitados_texto: z.string().optional(),
  fundamento_alcance: z.string().max(2000).optional(),
  notas_regulatorio: z.string().max(2000).optional(),
  responsable_nombre: z.string().max(120).optional(),
  responsable_cargo: z.string().max(120).optional(),
  incluir_partes: z.boolean().optional(),
  incluir_riesgo: z.boolean().optional(),
  incluir_subsanaciones: z.boolean().optional(),
  incluir_indice_cumplimiento: z.boolean().optional(),
  solo_preview: z.boolean().default(false),
  generar: z.boolean().default(false),
});

function buildDetalle(data: z.infer<typeof bodySchema>) {
  const itemsFromText = (data.items_solicitados_texto ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const items = [...(data.items_solicitados ?? []), ...itemsFromText];

  return detallePaqueteSchema.parse({
    titulo_respuesta: data.titulo_respuesta,
    items_solicitados: items,
    fundamento_alcance: data.fundamento_alcance,
    notas_regulatorio: data.notas_regulatorio,
    responsable_nombre: data.responsable_nombre,
    responsable_cargo: data.responsable_cargo ?? 'Oficial de Cumplimiento',
    incluir_partes: data.incluir_partes ?? false,
    incluir_riesgo: data.incluir_riesgo ?? false,
    incluir_subsanaciones: data.incluir_subsanaciones ?? false,
    incluir_indice_cumplimiento: data.incluir_indice_cumplimiento ?? true,
  });
}

function toPreviewInput(
  soId: string,
  data: z.infer<typeof bodySchema>,
  semilla: string | null,
  detalle: ReturnType<typeof buildDetalle>,
) {
  return {
    sujeto_obligado_id: soId,
    alcance_tipo: data.alcance_tipo,
    fecha_desde: data.fecha_desde,
    fecha_hasta: data.fecha_hasta,
    lista_ros: data.lista_ros ? JSON.stringify(data.lista_ros) : null,
    tamano_muestra: data.tamano_muestra,
    semilla_muestra: semilla,
    incluir_log: data.incluir_log,
    incluir_documentos: data.incluir_documentos,
    detalle,
  };
}

export async function GET() {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const soId = guard.session.user.sujetoObligadoId;

  const items = db.prepare(
    `SELECT s.id, s.numero_solicitud, s.estado, s.alcance_tipo, s.nivel_contenido, s.fecha_creacion,
            c.numero_oficio, c.tipo_comunicacion, p.id AS paquete_id,
            (SELECT COUNT(*) FROM entrega_paquete e WHERE e.paquete_id = p.id) AS entregas
       FROM solicitud_paquete s
       LEFT JOIN comunicacion_supervision c ON c.id = s.comunicacion_id
       LEFT JOIN paquete_generado p ON p.solicitud_id = s.id
      WHERE s.sujeto_obligado_id = ?
      ORDER BY s.fecha_creacion DESC`,
  ).all(soId);

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const guard = await requireSupervisionSo();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { session } = guard;
  const soId = session.user.sujetoObligadoId;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const detalle = buildDetalle(parsed.data);
  const semilla = parsed.data.alcance_tipo === 'muestra' ? randomUUID().slice(0, 16) : null;
  const alcance = {
    sujeto_obligado_id: soId,
    alcance_tipo: parsed.data.alcance_tipo,
    fecha_desde: parsed.data.fecha_desde,
    fecha_hasta: parsed.data.fecha_hasta,
    lista_ros: parsed.data.lista_ros ? JSON.stringify(parsed.data.lista_ros) : null,
    tamano_muestra: parsed.data.tamano_muestra,
    semilla_muestra: semilla,
  };
  const alcanceErr = validarAlcance(alcance);
  if (alcanceErr) {
    return NextResponse.json({ error: alcanceErr }, { status: 400 });
  }

  const preview = buildPaquetePreview(toPreviewInput(soId, parsed.data, semilla, detalle));
  if (preview.ros === 0) {
    return NextResponse.json({ error: 'El alcance no incluye ningún ROS' }, { status: 400 });
  }

  if (parsed.data.solo_preview) {
    return NextResponse.json({ preview });
  }

  if (parsed.data.comunicacion_id) {
    const com = db.prepare(
      `SELECT id FROM comunicacion_supervision WHERE id = ? AND sujeto_obligado_id = ?`,
    ).get(parsed.data.comunicacion_id, soId);
    if (!com) {
      return NextResponse.json({ error: 'Comunicación no encontrada' }, { status: 400 });
    }
  }

  const id = randomUUID();
  const numero = nextNumeroSolicitud();

  db.prepare(
    `INSERT INTO solicitud_paquete
      (id, numero_solicitud, comunicacion_id, sujeto_obligado_id, solicitante_id,
       alcance_tipo, fecha_desde, fecha_hasta, lista_ros, tamano_muestra, semilla_muestra,
       nivel_contenido, incluir_documentos, incluir_log, detalle_json, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')`,
  ).run(
    id,
    numero,
    parsed.data.comunicacion_id ?? null,
    soId,
    session.user.id,
    parsed.data.alcance_tipo,
    parsed.data.fecha_desde ?? null,
    parsed.data.fecha_hasta ?? null,
    parsed.data.lista_ros ? JSON.stringify(parsed.data.lista_ros) : null,
    parsed.data.tamano_muestra ?? null,
    semilla,
    parsed.data.nivel_contenido,
    parsed.data.incluir_documentos ? 1 : 0,
    parsed.data.incluir_log ? 1 : 0,
    JSON.stringify(detalle),
  );

  let build = null;
  if (parsed.data.generar) {
    db.prepare(`UPDATE solicitud_paquete SET estado = 'aprobada' WHERE id = ?`).run(id);
    build = await buildPaquete(id, session.user.id);
  }

  const ctx = extractRequestContext(req);
  audit({
    modulo: 'supervision',
    accion: parsed.data.generar ? 'generar_paquete' : 'crear_solicitud_paquete',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    recurso_afectado: numero,
    detalle: { ros: preview.ros, generado: Boolean(build) },
    criticidad: 'alta',
  });

  return NextResponse.json({
    id,
    numero_solicitud: numero,
    preview,
    paquete: build,
  });
}
