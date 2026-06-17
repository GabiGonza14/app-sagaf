// lib/masking.test.ts — BL-053: Pruebas unitarias de enmascarado (Ley 81/2019)
// Cubre: maskIdentifier, maskEmail, maskAmount, maskDescriptionText, normalizeIdentifier

import { describe, it, expect } from 'vitest';
import {
  maskIdentifier,
  maskEmail,
  maskAmount,
  maskDescriptionText,
  normalizeIdentifier,
} from './masking';

// ─────────────────────────────────────────────────────────────────────────────
// maskIdentifier
// ─────────────────────────────────────────────────────────────────────────────
describe('maskIdentifier', () => {
  it('enmascara una cédula panameña estándar (N-NNN-NNNN)', () => {
    const result = maskIdentifier('8-123-4567');
    // El formato devuelto es ***-***-XYZ (últimos 3 alfanuméricos)
    expect(result).toMatch(/^\*\*\*-\*\*\*-\w{3}$/);
    // Los últimos 3 chars del identificador limpio (81234567) son '567'
    expect(result).toBe('***-***-567');
  });

  it('enmascara una cédula de formato largo (N-NNNN-NNNN)', () => {
    const result = maskIdentifier('4-1234-56789');
    expect(result).toBe('***-***-789');
  });

  it('enmascara un pasaporte con letras y números', () => {
    const result = maskIdentifier('PA123456');
    // Últimos 3: '456'
    expect(result).toBe('***-***-456');
  });

  it('devuelve *** para null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskIdentifier(null as any)).toBe('***');
  });

  it('devuelve *** para undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskIdentifier(undefined as any)).toBe('***');
  });

  it('devuelve *** para cadena vacía', () => {
    expect(maskIdentifier('')).toBe('***');
  });

  it('devuelve *** para un identificador demasiado corto (≤3 chars limpios)', () => {
    expect(maskIdentifier('123')).toBe('***');
    expect(maskIdentifier('AB')).toBe('***');
  });

  it('no filtra datos: el resultado nunca contiene el identificador completo', () => {
    const id = '8-123-4567';
    const result = maskIdentifier(id);
    // La parte sin guiones es '81234567'; el resultado no debe contenerla
    expect(result).not.toContain('81234567');
    expect(result).not.toContain('8-123-4567');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// maskEmail
// ─────────────────────────────────────────────────────────────────────────────
describe('maskEmail', () => {
  it('enmascara un email normal mostrando solo los 2 primeros chars del usuario', () => {
    expect(maskEmail('test@uaf.gob.pa')).toBe('te***@uaf.gob.pa');
  });

  it('enmascara un email de usuario largo', () => {
    expect(maskEmail('cumplimiento@banconacional.com.pa')).toBe('cu***@banconacional.com.pa');
  });

  it('enmascara email con usuario corto (≤2 chars)', () => {
    // Usuario 'ab' → ** (caso especial)
    expect(maskEmail('ab@dominio.com')).toBe('**@dominio.com');
  });

  it('maneja un email con un solo carácter en usuario', () => {
    expect(maskEmail('a@test.com')).toBe('**@test.com');
  });

  it('devuelve ***@*** para null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskEmail(null as any)).toBe('***@***');
  });

  it('devuelve ***@*** para undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskEmail(undefined as any)).toBe('***@***');
  });

  it('devuelve ***@*** para cadena sin @', () => {
    expect(maskEmail('noesunemail')).toBe('***@***');
  });

  it('preserva el dominio completo (Ley 81: el dominio no es dato personal)', () => {
    const result = maskEmail('analista@uaf.gob.pa');
    expect(result).toContain('@uaf.gob.pa');
  });

  it('no filtra datos: el resultado nunca expone el usuario completo', () => {
    const email = 'cumplimiento@banconacional.com.pa';
    const result = maskEmail(email);
    expect(result).not.toContain('cumplimiento');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// maskAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('maskAmount', () => {
  it('el auditor ve *** (Ley 81: sin acceso a montos)', () => {
    expect(maskAmount(1234567.89, 'auditor')).toBe('***');
  });

  it('el analista ve el monto formateado en USD', () => {
    const result = maskAmount(1234567.89, 'analista');
    // Debe contener el número formateado
    expect(result).toContain('1,234,567.89');
    expect(result).toContain('$');
  });

  it('el supervisor ve el monto formateado en USD', () => {
    const result = maskAmount(50000, 'supervisor');
    expect(result).toContain('50,000.00');
  });

  it('el sujeto obligado ve el monto completo de su propio ROS', () => {
    const result = maskAmount(999.99, 'sujeto_obligado');
    expect(result).toContain('999.99');
  });

  it('formatea correctamente un monto cero', () => {
    const result = maskAmount(0, 'analista');
    expect(result).toContain('0.00');
  });

  it('formatea correctamente montos grandes', () => {
    const result = maskAmount(1000000000, 'supervisor');
    expect(result).toContain('1,000,000,000.00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// maskDescriptionText
// ─────────────────────────────────────────────────────────────────────────────
describe('maskDescriptionText', () => {
  it('enmascara cédulas en formato N-NNN-NNNN dentro de texto libre', () => {
    const texto = 'El cliente 8-123-4567 realizó la operación';
    const result = maskDescriptionText(texto);
    expect(result).not.toContain('8-123-4567');
    expect(result).toContain('***-***-');
  });

  it('enmascara múltiples cédulas en el mismo texto', () => {
    const texto = 'Partes: 3-456-7890 y 5-678-9012';
    const result = maskDescriptionText(texto);
    expect(result).not.toContain('3-456-7890');
    expect(result).not.toContain('5-678-9012');
  });

  it('enmascara patrones RUC dentro de texto', () => {
    const texto = 'Empresa RUC-155123456-2-2018 involucrada';
    const result = maskDescriptionText(texto);
    expect(result).not.toContain('155123456');
  });

  it('devuelve cadena vacía para null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskDescriptionText(null as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(maskDescriptionText(undefined as any)).toBe('');
  });

  it('no modifica texto sin identificadores', () => {
    const texto = 'Una transacción sospechosa fue detectada en enero de 2026';
    expect(maskDescriptionText(texto)).toBe(texto);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeIdentifier (DEF-10 anti-búsquedas fallidas por formato)
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeIdentifier', () => {
  it('convierte a mayúsculas', () => {
    expect(normalizeIdentifier('pa123abc')).toBe('PA123ABC');
  });

  it('elimina espacios internos', () => {
    expect(normalizeIdentifier('8 123 4567')).toBe('81234567');
  });

  it('elimina ceros iniciales', () => {
    expect(normalizeIdentifier('0081234')).toBe('81234');
  });

  it('trim de espacios externos', () => {
    expect(normalizeIdentifier('  ABC123  ')).toBe('ABC123');
  });

  it('normaliza un RUC complejo', () => {
    const result = normalizeIdentifier(' ruc-123456-7-2020 ');
    expect(result).toBe('RUC-123456-7-2020');
  });
});
