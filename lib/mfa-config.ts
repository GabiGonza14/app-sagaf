/**
 * MFA obligatorio por defecto. Solo desarrollo local:
 *   MFA_REQUIRED=false en .env.local
 * Nunca desactivar en producción.
 */
export function isMfaRequired(): boolean {
  return process.env.MFA_REQUIRED !== 'false';
}
