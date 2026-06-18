// lib/persons.ts — Verificación de identidad (RF-06)
// Busca en parte_involucrada de la BD. Solo retorna `nombre` (Ley 81/2019).
import { db } from '@/lib/db';

export interface PersonLookupResult {
  found: boolean;
  nombre?: string;
}

function normalizeId(id: string): string {
  return id.trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Verificación pública (RF-06): SOLO retorna `found` + `nombre`.
 * Busca en parte_involucrada comparando identificador normalizado.
 * Si se encuentra, el primer nombre registrado se reutiliza.
 * Cumple Ley 81/2019: NO autocompleta datos sensibles en el portal público.
 */
export function verifyPublic(raw: string): PersonLookupResult {
  const rows = db.prepare(`
    SELECT DISTINCT identificador, nombre_visible
    FROM parte_involucrada
    WHERE nombre_visible IS NOT NULL AND nombre_visible != ''
  `).all() as Array<{ identificador: string; nombre_visible: string }>;

  const needle = normalizeId(raw);
  for (const row of rows) {
    if (normalizeId(row.identificador) === needle) {
      return { found: true, nombre: row.nombre_visible };
    }
  }
  return { found: false };
}
