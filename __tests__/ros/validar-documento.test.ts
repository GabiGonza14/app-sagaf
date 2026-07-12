import { describe, expect, it } from 'vitest';
import { categorizarDocumento } from '@/lib/ros/documento-categoria';
import { extractIdentificadores, matchPartesEnTexto } from '@/lib/ros/parse-documento';
import { validarContenidoConPartes, validarHashDuplicado } from '@/lib/ros/validar-documento';

describe('categorizarDocumento', () => {
  it('clasifica identidad', () => {
    expect(categorizarDocumento('Documento de identidad personal (Cédula y/o pasaporte)')).toBe('identidad');
  });

  it('clasifica diligencia', () => {
    expect(categorizarDocumento('Debida Diligencia del Cliente incluyendo actualizaciones')).toBe('diligencia');
  });

  it('clasifica otros slots', () => {
    expect(categorizarDocumento('Estado de cuenta de los 2 últimos años en PDF y Excel')).toBe('otro');
  });
});

describe('parse-documento', () => {
  it('extrae cédulas panameñas del texto', () => {
    const ids = extractIdentificadores('Cliente identificado con cédula 8-888-888 y pasaporte vigente.');
    expect(ids).toContain('8-888-888');
  });

  it('coincide identificador de parte en texto', () => {
    const match = matchPartesEnTexto(
      'REPÚBLICA DE PANAMÁ Cédula No. 8-888-888 Nombre: JUAN PÉREZ GONZÁLEZ',
      [{ identificador: '8-888-888', nombre_visible: 'Juan Pérez González' }],
    );
    expect(match.identificadores_coincidentes).toContain('8-888-888');
  });

  it('coincide por nombre en diligencia', () => {
    const match = matchPartesEnTexto(
      'Informe de Debida Diligencia ampliada para MARIA RODRIGUEZ LOPEZ, cliente desde 2020.',
      [{ identificador: '8-123-456', nombre_visible: 'Maria Rodriguez Lopez' }],
    );
    expect(match.nombres_coincidentes.length).toBeGreaterThan(0);
  });
});

describe('validar-documento', () => {
  it('bloquea hash duplicado', () => {
    const r = validarHashDuplicado({ slotNombre: 'Cédula', archivoNombre: 'id.pdf' });
    expect(r.block).toBe(true);
    expect(r.error).toContain('idéntico');
  });

  it('bloquea identidad sin cédula de partes', () => {
    const r = validarContenidoConPartes(
      'Documento de identidad personal (Cédula y/o pasaporte)',
      [{ identificador: '8-888-888', nombre_visible: 'Juan Pérez' }],
      'Documento genérico del banco sin identificación del cliente.',
    );
    expect(r.block).toBe(true);
    expect(r.error).toContain('identidad');
  });

  it('advierte diligencia sin coincidencia', () => {
    const r = validarContenidoConPartes(
      'Debida Diligencia del Cliente incluyendo actualizaciones',
      [{ identificador: '8-888-888', nombre_visible: 'Juan Pérez' }],
      'Plantilla institucional sin datos del cliente investigado.',
    );
    expect(r.block).toBe(false);
    expect(r.contentWarning).toContain('Debida Diligencia');
  });

  it('acepta identidad con cédula coincidente', () => {
    const r = validarContenidoConPartes(
      'Documento de identidad personal (Cédula y/o pasaporte)',
      [{ identificador: '8-888-888', nombre_visible: 'Juan Pérez' }],
      'Cédula de identidad personal 8-888-888',
    );
    expect(r.block).toBe(false);
    expect(r.detectado?.partes_coincidentes).toContain('8-888-888');
  });
});
