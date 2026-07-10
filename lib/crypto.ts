import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// Utiliza el AUTH_SECRET existente en .env o genera uno estático para desarrollo.
function getKey() {
  const secret = process.env.AUTH_SECRET || 'sagaf_super_secret_fallback_key_2026';
  // sha256 garantiza una llave de exactamente 32 bytes para aes-256-gcm
  return createHash('sha256').update(secret).digest();
}

/**
 * Cifra un texto usando AES-256-GCM. (BL-032)
 */
export function encryptString(text: string): string {
  if (!text) return text;
  const iv = randomBytes(12); // GCM recomienda 12 bytes
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Retorna iv:authTag:cifrado
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descifra un texto usando AES-256-GCM. 
 * Si el texto no parece estar cifrado (sin el formato), lo retorna tal cual 
 * para garantizar compatibilidad hacia atrás con secretos en texto plano (seed).
 */
export function decryptString(cipherText: string): string {
  if (!cipherText || !cipherText.includes(':')) {
    // Modo compatibilidad: si no está cifrado (ej. datos del seed), usar en texto plano
    return cipherText;
  }
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    console.error('Error al descifrar el dato (MFA Secret):', e);
    return ''; // Falla segura
  }
}
