import { describe, expect, it } from 'vitest';
import { validarAlcance, type AlcanceInput } from '@/lib/supervision/alcance';

const base: AlcanceInput = {
  sujeto_obligado_id: 'so-1',
  alcance_tipo: 'periodo',
};

describe('validarAlcance', () => {
  it('exige lista de ROS', () => {
    expect(validarAlcance({ ...base, alcance_tipo: 'lista_ros', lista_ros: '[]' })).toContain('al menos un');
  });

  it('valida tamaño de muestra', () => {
    expect(validarAlcance({ ...base, alcance_tipo: 'muestra', tamano_muestra: 0 })).toContain('muestra');
  });

  it('acepta periodo válido', () => {
    expect(validarAlcance({
      ...base,
      fecha_desde: '2026-01-01',
      fecha_hasta: '2026-06-30',
    })).toBeNull();
  });
});
