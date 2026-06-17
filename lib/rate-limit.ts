// lib/rate-limit.ts (BL-035: Prevención de fuerza bruta)

interface RateLimitRecord {
  count: number;
  expires: number;
}

// Memoria volátil para MVP. En prod real usar Redis.
const store = new Map<string, RateLimitRecord>();

/**
 * Verifica si una IP ha excedido el límite de intentos.
 * @param ip Dirección IP del cliente
 * @param maxAttempts Número máximo de intentos permitidos en la ventana
 * @param windowMs Tamaño de la ventana en milisegundos (ej. 60000 para 1 min)
 * @returns { ok: boolean, remaining: number }
 */
export function checkRateLimit(ip: string, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = store.get(ip);

  // Limpieza periódica de IPs expiradas para evitar fuga de memoria
  if (Math.random() < 0.05) {
    for (const [key, val] of store.entries()) {
      if (val.expires < now) store.delete(key);
    }
  }

  if (!record || record.expires < now) {
    store.set(ip, { count: 1, expires: now + windowMs });
    return { ok: true, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    return { ok: false, remaining: 0 };
  }

  record.count++;
  return { ok: true, remaining: maxAttempts - record.count };
}

/**
 * Resetea el contador para una IP (útil después de un login exitoso).
 */
export function clearRateLimit(ip: string) {
  store.delete(ip);
}
