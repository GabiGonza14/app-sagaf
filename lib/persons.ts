// lib/persons.ts — Mock de directorio nacional para verificación Ley 81 (RF-06)
// IMPORTANTE: En producción, esto sería un servicio gubernamental (Tribunal
// Electoral / Registro Público). El portal público solo recibe `nombre`.
import { db } from './db';

export interface PersonLookupResult {
  found: boolean;
  nombre?: string;
}

// Para la VISTA UAF interna autorizada (RNF-02) puede incluir más campos.
export interface PersonInternalResult extends PersonLookupResult {
  tipo_documento?: string;
  direccion?: string;
  telefono?: string;
  actividad_economica?: string;
  nacionalidad?: string;
}

interface PersonaMockRow {
  identificador: string;
  tipo_documento: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  actividad_economica: string | null;
  nacionalidad: string | null;
}

const stmtById = db.prepare<[string], PersonaMockRow>('SELECT * FROM persona_mock WHERE identificador = ?');

function tryVariants(raw: string): PersonaMockRow | undefined {
  const candidates = new Set<string>();
  const trimmed = raw.trim();
  candidates.add(trimmed);
  candidates.add(trimmed.toUpperCase());
  candidates.add(trimmed.replace(/\s+/g, ''));
  candidates.add(trimmed.replace(/\s+/g, '').toUpperCase());
  candidates.add(trimmed.replace(/-/g, ''));
  for (const c of candidates) {
    const found = stmtById.get(c);
    if (found) return found;
  }
  return undefined;
}

/**
 * Verificación pública (RF-06): SOLO retorna `found` + `nombre`.
 * Cumple Ley 81/2019: NO autocompleta datos sensibles en el portal público.
 */
export function verifyPublic(raw: string): PersonLookupResult {
  const row = tryVariants(raw);
  if (!row) return { found: false };
  return { found: true, nombre: row.nombre };
}

/**
 * Lookup interno — solo para roles UAF autorizados (RNF-02).
 * NUNCA exponer este resultado completo al portal público.
 */
export function lookupInternal(raw: string): PersonInternalResult {
  const row = tryVariants(raw);
  if (!row) return { found: false };
  return {
    found: true,
    nombre: row.nombre,
    tipo_documento: row.tipo_documento,
    direccion: row.direccion ?? undefined,
    telefono: row.telefono ?? undefined,
    actividad_economica: row.actividad_economica ?? undefined,
    nacionalidad: row.nacionalidad ?? undefined,
  };
}
