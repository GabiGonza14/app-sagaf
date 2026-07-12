// lib/supervision/detalle.ts — Metadatos de la solicitud de paquete (JSON en BD)
import { z } from 'zod';

export const detallePaqueteSchema = z.object({
  titulo_respuesta: z.string().max(200).optional(),
  items_solicitados: z.array(z.string()).default([]),
  fundamento_alcance: z.string().max(2000).optional(),
  notas_regulatorio: z.string().max(2000).optional(),
  responsable_nombre: z.string().max(120).optional(),
  responsable_cargo: z.string().max(120).optional(),
  incluir_partes: z.boolean().default(false),
  incluir_riesgo: z.boolean().default(false),
  incluir_subsanaciones: z.boolean().default(false),
  incluir_indice_cumplimiento: z.boolean().default(true),
});

export type DetallePaquete = z.infer<typeof detallePaqueteSchema>;

export function parseDetalleJson(raw: string | null | undefined): DetallePaquete {
  if (!raw) return detallePaqueteSchema.parse({});
  try {
    return detallePaqueteSchema.parse(JSON.parse(raw));
  } catch {
    return detallePaqueteSchema.parse({});
  }
}
