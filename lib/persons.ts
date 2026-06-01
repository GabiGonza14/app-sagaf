// lib/persons.ts — Directorio nacional ficticio para verificación Ley 81 (RF-06)
// En producción esto sería una llamada al Tribunal Electoral / Registro Público.
// El portal público SOLO recibe `nombre` tras verificación.
import directorioRaw from './directorio-nacional.json';

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

interface DirectorioEntry {
  identificador: string;
  tipo_documento: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  actividad_economica?: string;
  nacionalidad?: string;
  [key: string]: unknown;
}

const directorio = directorioRaw as DirectorioEntry[];

function tryVariants(raw: string): DirectorioEntry | undefined {
  const candidates = new Set<string>();
  const trimmed = raw.trim();
  candidates.add(trimmed);
  candidates.add(trimmed.toUpperCase());
  candidates.add(trimmed.replace(/\s+/g, ''));
  candidates.add(trimmed.replace(/\s+/g, '').toUpperCase());
  candidates.add(trimmed.replace(/-/g, ''));
  for (const c of candidates) {
    const found = directorio.find((e) => e.identificador === c);
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
    direccion: row.direccion,
    telefono: row.telefono,
    actividad_economica: row.actividad_economica,
    nacionalidad: row.nacionalidad,
  };
}
