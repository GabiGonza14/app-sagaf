// lib/ros/documento-categoria.ts — Clasificación de slots de plantilla para reglas OCR

export type DocCategoria = 'identidad' | 'diligencia' | 'otro';

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Determina qué reglas de validación OCR aplican según el nombre del slot. */
export function categorizarDocumento(nombre: string): DocCategoria {
  const n = norm(nombre);

  if (/debida diligencia|diligencia del cliente|diligencia de personas|diligencia realizada/.test(n)) {
    return 'diligencia';
  }

  if (
    /identidad|identificaci[oó]n personal|identificaci[oó]n del representante|identificaci[oó]n de beneficiarios|documento de identidad|c[eé]dula|pasaporte|identificaci[oó]n personal/.test(n)
  ) {
    return 'identidad';
  }

  return 'otro';
}
