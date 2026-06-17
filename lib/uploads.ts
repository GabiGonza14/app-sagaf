// lib/uploads.ts — Ubicación de los archivos cargados (RNF-05, Ley 81).
//
// IMPORTANTE: por defecto los archivos se guardan FUERA de `public/`, de modo
// que Next.js NO los sirva estáticamente sin autenticación. El único acceso es
// vía `GET /api/documentos/[id]/file`, que valida pertenencia y audita la descarga.
// En despliegue, sobrescribir con la variable de entorno UPLOADS_DIR (montada en
// un volumen persistente).
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './var/uploads';
