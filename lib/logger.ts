// lib/logger.ts — Logger mínimo y seguro, condicionado por entorno (BL-001).
//
// Reglas de uso:
//  • En producción solo se emiten `warn` y `error`. `debug`/`info` quedan
//    silenciados salvo que se active `SAGAF_DEBUG=1`.
//  • NUNCA registrar datos sensibles: contraseñas, secretos o códigos MFA (TOTP),
//    cédulas/RUC, correos ni identificadores personales en claro (Ley 81).
//  • La trazabilidad de negocio (quién hizo qué) va por `lib/audit.ts`, no aquí.
//  • Edge-safe: solo usa `console` y `process.env` (sin dependencias de Node),
//    por lo que puede importarse desde middleware/auth.config.

type Level = 'debug' | 'info' | 'warn' | 'error';

const isProd = process.env.NODE_ENV === 'production';
const verbose = process.env.SAGAF_DEBUG === '1' || !isProd;

function shouldEmit(level: Level): boolean {
  if (level === 'warn' || level === 'error') return true;
  return verbose;
}

function emit(level: Level, scope: string, msg: string, meta?: Record<string, unknown>): void {
  if (!shouldEmit(level)) return;
  const tag = `[${scope}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta) fn(tag, msg, meta);
  else fn(tag, msg);
}

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, meta) => emit('debug', scope, msg, meta),
    info: (msg, meta) => emit('info', scope, msg, meta),
    warn: (msg, meta) => emit('warn', scope, msg, meta),
    error: (msg, meta) => emit('error', scope, msg, meta),
  };
}
