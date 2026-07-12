import { describe, it, expect } from 'vitest';
import { parseOficioText, plazoFromDiasHabiles } from '@/lib/supervision/parse-oficio';

const SBP_INICIAL = `
SUPERINTENDENCIA DE BANCOS DE PANAMÁ
Oficio No. SBP-DSB-2026-004821
Asunto: Requerimiento inicial de información — Inspección ordinaria Programa PLA/FT
Fecha: 2026-07-05
Plazo de respuesta: 2026-07-25
1. Listado de ROS recibidos entre el 01-ene-2026 y el 30-jun-2026
`;

const SBP_COMP = `
Oficio No. SBP-DSB-2026-004977
Asunto: Requerimiento complementario — Expedientes ROS citados
• ROS-2026-000002
• ROS-2026-000003
• ROS-2026-000005
`;

describe('parseOficioText', () => {
  it('extrae oficio SBP inicial con periodo', () => {
    const p = parseOficioText(SBP_INICIAL);
    expect(p.numero_oficio).toBe('SBP-DSB-2026-004821');
    expect(p.organismo).toBe('sbp');
    expect(p.tipo_comunicacion).toBe('requerimiento_inicial');
    expect(p.fecha_oficio).toBe('2026-07-05');
    expect(p.fecha_limite_respuesta).toBe('2026-07-25');
    expect(p.periodo?.desde).toBe('2026-01-01');
    expect(p.periodo?.hasta).toBe('2026-06-30');
  });

  it('extrae periodo cuando las fechas están en líneas distintas', () => {
    const multiline = `
Oficio No. SBP-DSB-2026-004821
1. Listado de ROS recibidos entre el 01-ene-2026
   y el 30-jun-2026, con indicación de estado.
`;
    const p = parseOficioText(multiline);
    expect(p.periodo?.desde).toBe('2026-01-01');
    expect(p.periodo?.hasta).toBe('2026-06-30');
  });

  it('extrae lista ROS en complementario', () => {
    const p = parseOficioText(SBP_COMP);
    expect(p.tipo_comunicacion).toBe('requerimiento_complementario');
    expect(p.lista_ros).toEqual(['ROS-2026-000002', 'ROS-2026-000003', 'ROS-2026-000005']);
  });

  it('extrae fecha verbal y plazo en días hábiles (formato institucional)', () => {
    const oficial = `
SUPERINTENDENCIA DE BANCOS DE PANAMÁ
Ciudad de Panamá, 5 de julio de 2026
Oficio N° SBP-DSB-2026-004821
ASUNTO: Requerimiento inicial de información
Plazo de respuesta: veinte (20) días hábiles.
`;
    const p = parseOficioText(oficial);
    expect(p.fecha_oficio).toBe('2026-07-05');
    expect(p.fecha_limite_respuesta).toBe(plazoFromDiasHabiles('2026-07-05', 20));
  });

  it('extrae plazo con fecha verbal explícita', () => {
    const t = 'Plazo de respuesta: 25 de julio de 2026';
    const p = parseOficioText(`Fecha del oficio: 2026-07-05\n${t}`);
    expect(p.fecha_limite_respuesta).toBe('2026-07-25');
  });
});
