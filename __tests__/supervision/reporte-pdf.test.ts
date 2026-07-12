import { describe, it, expect } from 'vitest';
import { generateReportePdf, type PaqueteManifest } from '@/lib/supervision/reporte-pdf';

const MANIFEST: PaqueteManifest = {
  manifiesto: {
    version: '1.0',
    solicitud: 'PKG-2026-00001',
    generado: '2026-07-11T18:00:00.000Z',
    hash_algoritmo: 'SHA-256',
  },
  respuesta: {
    titulo: 'Respuesta a requerimiento inicial — Inspección ordinaria PLA/FT 2026',
    responsable: { nombre: 'Lic. Oficial Demo', cargo: 'Oficial de Cumplimiento', correo: 'oc@banconacional.com.pa' },
    items_atendidos: [
      'Listado de ROS recibidos entre enero y junio 2026',
      'Índice de documentación obligatoria por expediente',
    ],
    fundamento_alcance:
      'El oficio solicita información de ROS recibidos entre 2026-01-01 y 2026-06-30. Este paquete limita los expedientes a ese rango.',
    notas_para_regulator:
      'Entrega en respuesta al oficio SBP-DSB-2026-004821. Plazo: 25/07/2026. Anexos físicos según canal formal.',
  },
  oficio: {
    numero: 'SBP-DSB-2026-004821',
    tipo: 'Requerimiento inicial de información',
    organismo: 'sbp',
    asunto: 'Requerimiento inicial — Inspección ordinaria Programa PLA/FT',
    fecha_oficio: '2026-07-05',
    plazo_respuesta: '2026-07-25',
  },
  entidad_reportante: { nombre: 'Banco Nacional de Panamá', tipo: 'bank', sector: 'Financiero' },
  alcance: {
    tipo: 'periodo',
    fecha_desde: '2026-01-01',
    fecha_hasta: '2026-06-30',
    ros_incluidos: 1,
    numeros_ros: ['ROS-2026-000002'],
  },
  nivel_contenido: 'resumido',
  contenido_incluido: {
    documentos: true,
    trazabilidad: false,
    partes: true,
    riesgo: true,
    subsanaciones: true,
    indice_cumplimiento: true,
  },
  expedientes: [{
    numero_ros: 'ROS-2026-000002',
    estado: 'enviado_uaf',
    fecha_recepcion: '2026-03-15',
    detalle: {
      fecha_deteccion: '2026-03-10',
      monto: 45000,
      moneda: 'USD',
      senal_alerta: 'Depósitos fraccionados en efectivo',
      producto_servicio: 'Cuenta de ahorros',
      descripcion: 'Cliente realiza múltiples depósitos en efectivo por debajo del umbral de reporte en un periodo de 15 días.',
      indice_documentacion_obligatoria_pct: 85,
      clasificacion_riesgo: { nivel: 'Alto', puntaje: 78, justificacion: 'Patrón transaccional atípico' },
      documentos: [
        {
          documento_requerido: 'Identificación del cliente',
          nombre_archivo: 'cedula_cliente.pdf',
          estado: 'cargado',
          fecha_carga: '2026-03-12',
        },
      ],
      partes: [
        {
          rol_en_operacion: 'Titular',
          tipo_persona: 'natural',
          identificador_enmascarado: '8-***-1234',
          nombre_visible: 'Cliente A.',
        },
      ],
      subsanaciones: [],
    },
  }],
  trazabilidad: [],
  nota_legal: 'Paquete de supervisión generado por el Sujeto Obligado. Uso exclusivo para atender requerimiento formal.',
};

describe('generateReportePdf', () => {
  it('genera un PDF multipágina con fuentes embebidas', async () => {
    const buf = await generateReportePdf(MANIFEST, 'a'.repeat(64));
    expect(buf.length).toBeGreaterThan(8000);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
