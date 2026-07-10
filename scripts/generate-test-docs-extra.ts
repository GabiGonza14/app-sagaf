/**
 * Genera documentos de prueba para:
 *   - ROS Banco · Persona Jurídica  (prefix: bl_)
 *   - ROS Inmobiliaria / Promotora  (prefix: re_)
 *
 * Uso: npx tsx scripts/generate-test-docs-extra.ts
 * Salida: test-docs/banco-juridica/  y  test-docs/inmobiliaria/
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'test-docs');
const OUT_BL = join(ROOT, 'banco-juridica');
const OUT_RE = join(ROOT, 'inmobiliaria');
mkdirSync(OUT_BL, { recursive: true });
mkdirSync(OUT_RE, { recursive: true });

async function makePdf(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 60;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, font, size: 11, color: rgb(0, 0, 0) });
    y -= 18;
    if (y < 60) break;
  }
  return Buffer.from(await doc.save());
}

function save(dir: string, name: string, buf: Buffer) {
  const path = join(dir, name);
  writeFileSync(path, buf);
  console.log('  ✓', name);
}

// ─────────────────────────────────────────────────────────────────────────────
// BANCO · PERSONA JURÍDICA
// Empresa: TechCorp Solutions, S.A. | RUC: 155-423-1-2019
// Caso: movimientos inusuales en cuenta corporativa, múltiples transferencias
//       sin respaldo de contratos comerciales verificables.
// ─────────────────────────────────────────────────────────────────────────────

async function genBancoJuridica() {
  console.log('\n[banco-juridica/]');

  // dr_bl_1 — Contrato de los Servicios Bancarios
  save(OUT_BL, 'bl_1_contrato_servicios_bancarios.pdf', await makePdf([
    'CONTRATO DE SERVICIOS BANCARIOS - PERSONA JURÍDICA',
    'Banco Nacional de Panamá',
    '',
    'Entre: Banco Nacional de Panamá (en adelante "El Banco")',
    'Y: TechCorp Solutions, S.A., RUC: 155-423-1-2019',
    '   Representada por: Ing. Miguel Ángel Herrera Ríos, cédula 8-745-231',
    '   (en adelante "El Cliente Corporativo")',
    '',
    'OBJETO DEL CONTRATO:',
    'El Banco provee servicios bancarios corporativos incluyendo:',
    '  - Cuenta corriente corporativa',
    '  - Servicios de transferencias nacionales e internacionales',
    '  - Línea de crédito corporativa',
    '  - Servicios de nómina',
    '',
    'CLÁUSULA DE CUMPLIMIENTO:',
    'El Cliente se compromete a cumplir con la Ley 23 de 2015 y la Ley 81 de',
    '2019, informando oportunamente el origen lícito de todos los fondos.',
    '',
    'Firma del Representante Legal: _______________________',
    'Firma del Banco: _______________________',
    'Fecha: 12 de marzo de 2023',
  ]));

  // dr_bl_2 — Documentos de Apertura
  save(OUT_BL, 'bl_2_documentos_apertura.pdf', await makePdf([
    'DOCUMENTOS DE APERTURA DE CUENTA CORPORATIVA',
    'Banco Nacional de Panamá',
    '',
    'Razón Social: TechCorp Solutions, S.A.',
    'RUC: 155-423-1-2019',
    'Tipo de cuenta: Cuenta Corriente Corporativa',
    'Número de cuenta asignado: 001-123-456789',
    'Fecha de apertura: 15 de marzo de 2023',
    'Sucursal: Banconal Vía España',
    '',
    'Actividad económica declarada: Servicios de tecnología y consultoría',
    'Origen de fondos declarado: Ingresos por contratos de servicios TI',
    'Movimiento mensual estimado: USD 150,000',
    '',
    'Oficial que procesó la apertura: Lic. Carmen Torres',
    'Revisado por: Departamento de Cumplimiento Corporativo',
    'Nivel de riesgo KYC inicial: Medio',
  ]));

  // dr_bl_3 — Identificación del Representante Legal, Dignatarios, Directores...
  save(OUT_BL, 'bl_3_identificacion_representante_dignatarios.pdf', await makePdf([
    'IDENTIFICACIÓN DE REPRESENTANTE LEGAL, DIGNATARIOS Y ACCIONISTAS',
    'TechCorp Solutions, S.A. | RUC: 155-423-1-2019',
    '',
    'REPRESENTANTE LEGAL:',
    '  Nombre: Ing. Miguel Ángel Herrera Ríos',
    '  Cédula: 8-745-231',
    '  Cargo: Presidente / Director General',
    '  Fecha de nombramiento: 01 de enero de 2019',
    '',
    'DIGNATARIOS:',
    '  Vicepresidente: Lic. Sandra Juárez Morales | Cédula: 6-712-890',
    '  Secretaria: Lic. Ana Lucía Castillo | Cédula: 8-902-345',
    '  Tesorero: CPA. Roberto Salinas Núñez | Cédula: 4-233-671',
    '',
    'DIRECTORES:',
    '  Director A: Mr. John K. Williams | Pasaporte USA: 556789012',
    '  Director B: Ing. Luis Fernando Molina | Cédula: 8-777-001',
    '',
    'ACCIONISTAS (100% del capital):',
    '  TechHolding International Ltd. (BVI) — 70% de acciones',
    '  Miguel Ángel Herrera Ríos — 30% de acciones',
    '',
    'BENEFICIARIOS FINALES IDENTIFICADOS:',
    '  Mr. John K. Williams (titular último de TechHolding International Ltd.)',
    '  Ing. Miguel Ángel Herrera Ríos',
  ]));

  // dr_bl_4 — Debida Diligencia de personas vinculadas
  save(OUT_BL, 'bl_4_debida_diligencia_vinculadas.pdf', await makePdf([
    'DEBIDA DILIGENCIA DE PERSONAS VINCULADAS A LA PERSONA JURÍDICA',
    'Know Your Customer (KYC) Corporativo — TechCorp Solutions, S.A.',
    '',
    'Fecha de realización: 10 de marzo de 2023',
    'Oficial de Cumplimiento: Lic. Roberto Mendoza',
    '',
    'REPRESENTANTE LEGAL — Ing. Miguel Ángel Herrera Ríos:',
    '  PEP: No | OFAC: Negativo | ONU: Negativo | GAFI: Negativo',
    '  Origen de fondos: Dividendos y salario de la empresa',
    '  Nivel de riesgo individual: Bajo',
    '',
    'DIRECTOR — Mr. John K. Williams:',
    '  PEP: No | OFAC: Negativo | ONU: Negativo | GAFI: Negativo',
    '  Residencia: Delaware, Estados Unidos',
    '  Nivel de riesgo individual: Medio (jurisdicción offshore)',
    '',
    'ACCIONISTA — TechHolding International Ltd.:',
    '  Jurisdicción: British Virgin Islands (BVI) — lista gris GAFI',
    '  Estructura de propiedad verificada hasta beneficiario final: Sí',
    '  Nivel de riesgo: Alto (estructura offshore en jurisdicción sensible)',
    '',
    'Conclusión: Se requiere enhanced due diligence por estructura accionaria',
    'con componente offshore en BVI. Se recomienda monitoreo reforzado.',
    'Resultado de DD corporativo: APROBADO CON CONDICIONES',
  ]));

  // dr_bl_5 — Perfiles de Ingresos y Egresos transaccionales
  save(OUT_BL, 'bl_5_perfiles_ingresos_egresos.pdf', await makePdf([
    'PERFILES DE INGRESOS Y EGRESOS TRANSACCIONALES',
    'TechCorp Solutions, S.A. | Cuenta: 001-123-456789',
    'Período: Marzo 2023 — Enero 2025',
    '',
    'INGRESOS PROMEDIO MENSUAL (declarados al momento de apertura):',
    '  Contratos de servicios TI nacionales:    USD  80,000',
    '  Contratos de servicios TI internacionales: USD  70,000',
    '  Total esperado:                           USD 150,000',
    '',
    'INGRESOS REALES OBSERVADOS (últimos 6 meses):',
    '  Transferencias recibidas promedio/mes:    USD 890,000',
    '  Origen declarado: Pagos de clientes',
    '  Monto vs perfil inicial: +493% del declarado -- INUSUAL',
    '',
    'EGRESOS REALES OBSERVADOS (últimos 6 meses):',
    '  Transferencias internacionales enviadas:  USD 750,000/mes',
    '  Destinos: Panamá, BVI, Hong Kong, Dubai',
    '  Nómina pagada:                            USD  12,000/mes',
    '  Gastos operativos locales:                USD   8,000/mes',
    '',
    'OBSERVACIÓN: Significativa discrepancia entre perfil declarado en',
    'apertura y movimientos reales. Posible estructuración de fondos.',
    'Caso escalado a Comité de Cumplimiento el 15 de enero de 2025.',
  ]));

  // dr_bl_6 — Pacto social / documento constitutivo
  save(OUT_BL, 'bl_6_pacto_social_poderes.pdf', await makePdf([
    'PACTO SOCIAL Y ESCRITURA DE CONSTITUCIÓN',
    'TechCorp Solutions, S.A.',
    'Notaría Segunda del Circuito de Panamá',
    '',
    'Escritura Pública No. 4521 del 5 de enero de 2019',
    'Inscrita en el Registro Público de Panamá',
    'Ficha: 155-423 | Rollo: 89234 | Imagen: 012',
    '',
    'Denominación social: TechCorp Solutions, Sociedad Anónima',
    'Capital social autorizado: USD 10,000',
    'Acciones: 100 acciones comunes sin valor nominal',
    'Objeto social: Prestación de servicios de tecnología de la información,',
    '  consultoría, desarrollo de software y actividades conexas.',
    'Duración: Indefinida',
    '',
    'PODERES VIGENTES:',
    '  Poder General Amplísimo a favor de:',
    '  Ing. Miguel Ángel Herrera Ríos | Cédula: 8-745-231',
    '  Fecha de otorgamiento: 06 de enero de 2019',
    '  Notaría Segunda del Circuito de Panamá — Escritura 4525/2019',
    '',
    'Certificación del Registro Público: Vigente al 01 de enero de 2025.',
  ]));

  // dr_bl_7 — Aviso de Operación / Licencia Comercial
  save(OUT_BL, 'bl_7_aviso_operacion_licencia.pdf', await makePdf([
    'AVISO DE OPERACIÓN — LICENCIA COMERCIAL',
    'Ministerio de Comercio e Industrias — República de Panamá',
    '',
    'Se certifica que la empresa:',
    'TechCorp Solutions, S.A. | RUC: 155-423-1-2019',
    '',
    'Ha cumplido con el registro de Aviso de Operación conforme a la',
    'Ley No. 5 de 11 de enero de 2007 y se encuentra habilitada para',
    'ejercer actividades comerciales en la República de Panamá.',
    '',
    'Aviso de Operación No.: AO-2019-45213',
    'Actividad comercial: Servicios de Tecnología e Informática',
    'Código CIIU: 6209 — Otras actividades de tecnología de la información',
    'Fecha de emisión: 20 de enero de 2019',
    'Vigencia: Anual (renovado hasta: 31 de diciembre de 2025)',
    'Estado: VIGENTE',
    '',
    'Firma del Director General de Comercio Interior: ________________',
    'Sello del Ministerio de Comercio e Industrias',
  ]));

  // dr_bl_8 — Declaraciones de Rentas
  save(OUT_BL, 'bl_8_declaraciones_renta.pdf', await makePdf([
    'DECLARACIONES DE RENTA — PERSONA JURÍDICA',
    'Dirección General de Ingresos (DGI) — República de Panamá',
    '',
    'Contribuyente: TechCorp Solutions, S.A.',
    'RUC: 155-423-1-2019',
    '',
    'PERÍODO FISCAL 2023:',
    '  Ingresos brutos declarados:        USD 1,350,000',
    '  Costos y gastos deducibles:        USD   920,000',
    '  Renta neta gravable:               USD   430,000',
    '  Impuesto sobre la renta pagado:    USD    94,600',
    '  ITBMS pagado:                      USD    75,420',
    '',
    'PERÍODO FISCAL 2024 (estimado):',
    '  Ingresos brutos declarados:        USD 5,280,000  (incremento 291%)',
    '  Costos y gastos deducibles:        USD 4,850,000',
    '  Renta neta gravable:               USD   430,000',
    '  Impuesto estimado:                 USD    94,600',
    '',
    'OBSERVACIÓN DGI: El incremento en ingresos 2024 vs 2023 supera el 200%.',
    'Se emite esta constancia a solicitud del contribuyente para uso bancario.',
    '',
    'Sello y firma autorizada de la DGI: _______________________',
    'Fecha de emisión: 10 de enero de 2025',
  ]));

  // dr_bl_9 — Dignatarios y Directores y actualizaciones
  save(OUT_BL, 'bl_9_dignatarios_directores_actualizacion.pdf', await makePdf([
    'ACTUALIZACIÓN DE DIGNATARIOS Y DIRECTORES',
    'TechCorp Solutions, S.A. | RUC: 155-423-1-2019',
    'Registro Público de Panamá — Certificación de Directores',
    '',
    'JUNTA DIRECTIVA VIGENTE (actualizada al 01 de enero de 2025):',
    '',
    '  Presidente / Director General:',
    '    Ing. Miguel Ángel Herrera Ríos | Cédula: 8-745-231',
    '    Electo: Asamblea General del 05-01-2019 | Vigente',
    '',
    '  Vicepresidente:',
    '    Lic. Sandra Juárez Morales | Cédula: 6-712-890',
    '    Electa: Asamblea General del 05-01-2023 | Vigente',
    '',
    '  Director A:',
    '    Mr. John K. Williams | Pasaporte USA: 556789012',
    '    Electo: Asamblea General del 05-01-2019 | Vigente',
    '',
    '  Director B:',
    '    Ing. Luis Fernando Molina | Cédula: 8-777-001',
    '    Electo: Asamblea General del 05-01-2023 | Vigente',
    '',
    'CAMBIOS DESDE APERTURA:',
    '  2023-01-05: Renovación de Vicepresidente (anterior: Lic. Pedro Gómez)',
    '  2023-01-05: Incorporación de nuevo Director B (Ing. Luis F. Molina)',
    '',
    'Certificación emitida por Notaría Segunda del Circuito de Panamá.',
  ]));

  // dr_bl_10 — Estados Financieros
  save(OUT_BL, 'bl_10_estados_financieros.pdf', await makePdf([
    'ESTADOS FINANCIEROS AUDITADOS',
    'TechCorp Solutions, S.A.',
    'Período: 01 de enero al 31 de diciembre de 2024',
    'Preparados por: Deloitte & Touche Panamá',
    '',
    'BALANCE GENERAL AL 31 DE DICIEMBRE DE 2024:',
    '  ACTIVOS',
    '    Efectivo y equivalentes:      USD  1,250,000',
    '    Cuentas por cobrar:           USD  3,890,000',
    '    Activos fijos netos:          USD    120,000',
    '    TOTAL ACTIVOS:                USD  5,260,000',
    '',
    '  PASIVOS',
    '    Cuentas por pagar:            USD  4,100,000',
    '    Deuda bancaria:               USD    500,000',
    '    TOTAL PASIVOS:                USD  4,600,000',
    '',
    '  PATRIMONIO:                     USD    660,000',
    '',
    'ESTADO DE RESULTADOS 2024:',
    '  Ingresos por servicios:         USD  5,280,000',
    '  Costos operativos:              USD  4,850,000',
    '  Utilidad neta:                  USD    430,000',
    '',
    'Nota del auditor: La empresa muestra alto apalancamiento (87% deuda).',
    'Los auditores no pudieron verificar el 40% de las facturas de clientes.',
    'Opinión: Con salvedades.',
  ]));

  // dr_bl_11 — Información sobre Beneficiarios Finales
  save(OUT_BL, 'bl_11_info_beneficiarios_finales.pdf', await makePdf([
    'INFORMACIÓN SOBRE BENEFICIARIOS FINALES',
    'Registro de Beneficiarios Finales — Ley 52 de 2016',
    'TechCorp Solutions, S.A. | RUC: 155-423-1-2019',
    '',
    'En cumplimiento de la Ley 52 de 27 de octubre de 2016 y el',
    'Decreto 54 de 2015, se declaran los siguientes beneficiarios finales:',
    '',
    'BENEFICIARIO FINAL #1:',
    '  Nombre: Mr. John K. Williams',
    '  Documento: Pasaporte USA No. 556789012',
    '  Residencia: 1234 Oak Street, Wilmington, Delaware, USA',
    '  Porcentaje de control: 70% (vía TechHolding International Ltd. - BVI)',
    '  Fecha de declaración: 20 de marzo de 2023',
    '  PEP: No | Lista OFAC: Negativo | Lista ONU: Negativo',
    '',
    'BENEFICIARIO FINAL #2:',
    '  Nombre: Ing. Miguel Ángel Herrera Ríos',
    '  Cédula: 8-745-231',
    '  Dirección: Calle 50, Torre Global Piso 12, Ciudad de Panamá',
    '  Porcentaje de control: 30% (acciones directas)',
    '  Fecha de declaración: 20 de marzo de 2023',
    '  PEP: No | Lista OFAC: Negativo | Lista ONU: Negativo',
    '',
    'Declaración firmada ante el Agente Residente:',
    'Firma del Agente Residente: _______________________',
  ]));

  // dr_bl_12 — Identificación de Beneficiarios Finales
  save(OUT_BL, 'bl_12_identificacion_beneficiarios_finales.pdf', await makePdf([
    'COPIAS DE IDENTIFICACIÓN DE BENEFICIARIOS FINALES',
    'TechCorp Solutions, S.A.',
    '',
    'DOCUMENTO #1 — Mr. John K. Williams:',
    '  Tipo: Pasaporte de los Estados Unidos de América',
    '  Número: 556789012',
    '  Fecha de nacimiento: 14 de julio de 1965',
    '  Lugar de nacimiento: Boston, Massachusetts, USA',
    '  Fecha de expedición: 10 de mayo de 2020',
    '  Fecha de vencimiento: 09 de mayo de 2030',
    '  Visa panameña: Permiso de Residente Permanente No. VP-2021-00234',
    '',
    'DOCUMENTO #2 — Ing. Miguel Ángel Herrera Ríos:',
    '  Tipo: Cédula de Identidad Personal — República de Panamá',
    '  Número: 8-745-231',
    '  Fecha de nacimiento: 22 de octubre de 1978',
    '  Lugar de nacimiento: Santiago de Veraguas, Panamá',
    '  Fecha de expedición: 05 de noviembre de 2021',
    '  Fecha de vencimiento: 05 de noviembre de 2026',
    '',
    'Autenticados por Notaría Segunda del Circuito de Panamá.',
    'Sello notarial: _______________________',
  ]));

  // dr_bl_13 — Comunicaciones de descarte de la inusualidad
  save(OUT_BL, 'bl_13_comunicaciones_descarte.pdf', await makePdf([
    'COMUNICACIONES DE DESCARTE DE LA INUSUALIDAD',
    'Banco Nacional de Panamá | Departamento de Cumplimiento Corporativo',
    '',
    'Expediente: TechCorp Solutions S.A. | RUC: 155-423-1-2019',
    'Analista: Lic. Roberto Mendoza | Fecha inicio: 08 de enero de 2025',
    '',
    '--- Solicitud de explicación al cliente (08-01-2025) ---',
    'Se notificó al Representante Legal la necesidad de explicar el incremento',
    'en volumen transaccional. Plazo otorgado: 5 días hábiles.',
    '',
    '--- Respuesta del cliente (10-01-2025) ---',
    'El Representante Legal indicó que los fondos corresponden a proyectos de',
    'transformación digital para empresas en Asia y Medio Oriente. No presentó',
    'contratos firmados ni facturas que soporten dichos proyectos.',
    '',
    '--- Consulta a listas restrictivas (12-01-2025) ---',
    'OFAC: Negativo | ONU: Negativo | GAFI high-risk countries: BVI (destino)',
    '',
    '--- Reunión del Comité de Cumplimiento (14-01-2025) ---',
    'El Comité determinó que las justificaciones presentadas son insuficientes.',
    'No existe sustento documental para el 490% de incremento en ingresos.',
    'Destinos de fondos incluyen jurisdicciones de alto riesgo (BVI, Dubai).',
    '',
    'DECISIÓN: Escalar como Reporte de Operación Sospechosa ante la UAF.',
    'Firma del Oficial de Cumplimiento Senior: _______________________',
  ]));

  // dr_bl_14 — Estado de cuenta (2 últimos años)
  save(OUT_BL, 'bl_14_estado_cuenta_2_anos.pdf', await makePdf([
    'ESTADO DE CUENTA — 2 ÚLTIMOS AÑOS',
    'Banco Nacional de Panamá',
    'Cliente: TechCorp Solutions, S.A. | Cuenta: 001-123-456789',
    'Período: Enero 2023 — Enero 2025',
    '',
    'RESUMEN ANUAL 2023:',
    '  Créditos totales:   USD  1,820,000',
    '  Débitos totales:    USD  1,654,000',
    '  Saldo promedio:     USD    234,500',
    '  No. transacciones:  287',
    '',
    'RESUMEN ANUAL 2024:',
    '  Créditos totales:   USD 10,680,000  (+487% vs 2023 - INUSUAL)',
    '  Débitos totales:    USD 10,450,000',
    '  Saldo promedio:     USD    890,000',
    '  No. transacciones:  1,342',
    '',
    'ÚLTIMAS 10 TRANSACCIONES (diciembre 2024 — enero 2025):',
    '  15-01-2025: CR USD 1,200,000 — TechHolding International BVI',
    '  14-01-2025: DB USD 1,100,000 — Wire transfer Dubai, EAU',
    '  10-01-2025: CR USD   890,000 — Remitente desconocido, Hong Kong',
    '  09-01-2025: DB USD   800,000 — Wire transfer BVI',
    '  05-01-2025: CR USD   750,000 — Pacific Trade Ltd., Singapur',
    '  ...',
    '',
    'Generado por el sistema bancario el 20 de enero de 2025.',
    'Este documento tiene valor probatorio para fines de cumplimiento.',
  ]));

  // dr_bl_15 — Volante de depósitos y retiros (15º requerido en seed)
  save(OUT_BL, 'bl_15_volante_depositos_retiros.pdf', await makePdf([
    'VOLANTE DE DEPÓSITOS Y RETIROS DE CUENTA',
    'Banco Nacional de Panamá',
    'TechCorp Solutions, S.A. | Cuenta: 001-123-456789',
    'Período: Octubre 2024 — Enero 2025',
    '',
    'DEPÓSITOS:',
    '  Fecha       | Monto USD   | Origen',
    '  ------------|-------------|------------------------------------',
    '  15-01-2025  | 1,200,000   | TechHolding Int. (BVI)',
    '  10-01-2025  |   890,000   | Pacific Remit Ltd. (HK)',
    '  05-01-2025  |   750,000   | Pacific Trade Ltd. (SG)',
    '  28-12-2024  | 1,100,000   | Khalifa Trading FZE (Dubai)',
    '  15-12-2024  |   980,000   | TechHolding Int. (BVI)',
    '  01-12-2024  |   750,000   | Pacific Trade Ltd. (SG)',
    '',
    'RETIROS:',
    '  Fecha       | Monto USD   | Destino',
    '  ------------|-------------|------------------------------------',
    '  14-01-2025  | 1,100,000   | Wire — Dubai, Emiratos Árabes',
    '  09-01-2025  |   800,000   | Wire — BVI, Islas Vírgenes',
    '  20-12-2024  |   900,000   | Wire — Hong Kong',
    '  10-12-2024  |   780,000   | Wire — Dubai, Emiratos Árabes',
    '',
    'Total depósitos período: USD 5,670,000',
    'Total retiros período:   USD 3,580,000',
    'Diferencia neta:         USD 2,090,000 (saldo acumulado no justificado)',
  ]));

  console.log('  ✅ Banco · Persona Jurídica completado (14 docs requeridos)');
}

// ─────────────────────────────────────────────────────────────────────────────
// INMOBILIARIA / PROMOTORA
// Caso: Compra de apartamento de lujo USD 380,000. El comprador no acredita
//       ingresos suficientes; fondos provienen de depósitos en efectivo.
// ─────────────────────────────────────────────────────────────────────────────

async function genInmobiliaria() {
  console.log('\n[inmobiliaria/]');

  // dr_re_1 — Contrato de Promesa de Compra Venta
  save(OUT_RE, 're_1_contrato_promesa_compra_venta.pdf', await makePdf([
    'CONTRATO DE PROMESA DE COMPRA VENTA',
    'Inmobiliaria Istmo, S.A.',
    '',
    'PROMITENTE VENDEDOR:',
    '  Inmobiliaria Istmo, S.A. | RUC: 155-789-1-2020',
    '  Representada por: Lic. Patricia Vásquez | Cédula: 8-901-234',
    '  Cargo: Representante Legal',
    '',
    'PROMITENTE COMPRADOR:',
    '  Nombre: José Ramón Peñaloza Díaz',
    '  Cédula: 9-712-456',
    '  Dirección: Calle 74, Edificio Costa del Sol, Apto 4B, Panamá',
    '  Teléfono: +507 6321-0099',
    '',
    'BIEN INMUEBLE OBJETO DEL CONTRATO:',
    '  Inmueble: Apartamento 14C, Torre Pacífico, Av. Balboa, Panamá',
    '  Finca: 40123 | Tomo: 3421 | Folio: 089',
    '  Área: 120 m² | Vista al mar | Piso 14',
    '',
    'PRECIO TOTAL: USD 380,000',
    '',
    'FORMA DE PAGO ACORDADA:',
    '  Depósito inicial (cuota prima):  USD  76,000 (20%) — al firmar',
    '  Pagos parciales:                 USD 104,000 (27%) — en 12 meses',
    '  Balance a financiar:             USD 200,000 (53%) — banco o contado',
    '',
    'Fecha de firma: 10 de diciembre de 2024',
    'Firma del Vendedor: ___________________',
    'Firma del Comprador: __________________',
    'Notariado por: Notaría Tercera del Circuito de Panamá',
  ]));

  // dr_re_2 — Debida Diligencia del Cliente Comprador
  save(OUT_RE, 're_2_debida_diligencia_comprador.pdf', await makePdf([
    'FORMULARIO DE DEBIDA DILIGENCIA — CLIENTE COMPRADOR',
    'Know Your Customer (KYC) | Inmobiliaria Istmo, S.A.',
    '',
    'DATOS DEL COMPRADOR:',
    '  Nombre completo: José Ramón Peñaloza Díaz',
    '  Cédula: 9-712-456',
    '  Fecha de nacimiento: 03 de agosto de 1985',
    '  Ocupación declarada: Comerciante independiente',
    '  Empresa/Negocio: Distribuidora JRP, S.A. (no registrada en MEF)',
    '  Dirección: Calle 74, Edificio Costa del Sol, Apto 4B, Panamá',
    '',
    'ORIGEN DE FONDOS DECLARADO:',
    '  Ingresos por comercio de mercancías varias: USD 25,000/mes',
    '  Ahorros acumulados: USD 180,000',
    '  Préstamo de familiar (no documentado): USD 200,000',
    '',
    'VERIFICACIÓN DE LISTAS:',
    '  OFAC: Negativo | ONU: Negativo | INTERPOL: Negativo',
    '  PEP: No declarado | Familiares PEP: No declarado',
    '',
    'RESULTADO DE LA DEBIDA DILIGENCIA:',
    '  Capacidad económica para compra de USD 380,000: NO VERIFICADA',
    '  Origen de fondos suficientemente justificado: NO',
    '  Nivel de riesgo asignado: ALTO',
    '  Oficial de Cumplimiento: Lic. Patricia Vásquez',
    '  Fecha: 12 de diciembre de 2024',
    '  RECOMENDACIÓN: Presentar ROS ante la UAF.',
  ]));

  // dr_re_3 — Identificación del Comprador
  save(OUT_RE, 're_3_identificacion_comprador.pdf', await makePdf([
    'IDENTIFICACIÓN PERSONAL DEL COMPRADOR',
    'Copia Autenticada — Para uso en gestión inmobiliaria',
    '',
    'CÉDULA DE IDENTIDAD PERSONAL — REPÚBLICA DE PANAMÁ',
    '',
    'Nombre: José Ramón Peñaloza Díaz',
    'Cédula: 9-712-456',
    'Fecha de nacimiento: 03 de agosto de 1985',
    'Lugar de nacimiento: Chitré, Herrera, Panamá',
    'Fecha de expedición: 15 de marzo de 2023',
    'Fecha de vencimiento: 15 de marzo de 2028',
    '',
    'Copia autenticada por Notaría Tercera del Circuito de Panamá.',
    'La presente es fiel copia del documento original de identidad.',
    '',
    'NOTA: El comprador no presentó pasaporte ni documento adicional.',
    'La cédula se encuentra vigente al momento de la transacción.',
    '',
    'Firma del Notario: _______________________',
    'Sello Notarial',
  ]));

  // dr_re_4 — Perfil transaccional del comprador
  save(OUT_RE, 're_4_perfil_transaccional_comprador.pdf', await makePdf([
    'PERFIL TRANSACCIONAL DEL COMPRADOR',
    'Inmobiliaria Istmo, S.A. — Análisis de Capacidad Económica',
    '',
    'Comprador: José Ramón Peñaloza Díaz | Cédula: 9-712-456',
    'Bien: Apartamento 14C, Torre Pacífico | Precio: USD 380,000',
    '',
    'ANÁLISIS DE FUENTES DE FONDOS:',
    '',
    '  Pago #1 — Depósito inicial (10-12-2024):',
    '    Monto: USD 76,000',
    '    Forma: Depósito en efectivo en Banco General, Sucursal El Dorado',
    '    Referencia: 4 depósitos de USD 19,000 en 4 días consecutivos',
    '    OBSERVACIÓN: Posible estructuración (smurfing)',
    '',
    '  Pago #2 — Abono parcial (20-12-2024):',
    '    Monto: USD 55,000',
    '    Forma: Cheque de gerencia emitido por cuenta de tercero',
    '    Titular del cheque: "Distribuciones Globales S.A." (empresa desconocida)',
    '',
    '  Pago #3 — Abono parcial (05-01-2025):',
    '    Monto: USD 49,000',
    '    Forma: Transferencia bancaria desde cuenta en Banco Pichincha Ecuador',
    '',
    'INGRESOS DECLARADOS VS PRECIO:',
    '  Ingreso mensual declarado: USD 25,000',
    '  Precio del bien: USD 380,000 (equivale a 15.2 meses de ingresos)',
    '  Los fondos ingresados no son consistentes con el perfil declarado.',
    '',
    'Elaborado por: Lic. Patricia Vásquez | Oficial de Cumplimiento',
  ]));

  // dr_re_5 — Detalle del bien inmueble
  save(OUT_RE, 're_5_detalle_bien_inmueble.pdf', await makePdf([
    'DETALLE DEL BIEN OBJETO DEL CONTRATO',
    'Inmobiliaria Istmo, S.A.',
    '',
    'DATOS REGISTRALES:',
    '  Finca: 40123 | Tomo: 3421 | Folio: 089 | Asiento: 234',
    '  Provincia: Panamá | Distrito: Panamá | Corregimiento: Bella Vista',
    '  Inscripción en Registro Público: Vigente',
    '',
    'DESCRIPCIÓN DEL INMUEBLE:',
    '  Tipo: Apartamento residencial de lujo',
    '  Ubicación: Torre Pacífico, Piso 14, Apto 14C',
    '  Dirección: Avenida Balboa, Ciudad de Panamá',
    '  Área total: 120 m² (aprox. 1,291 sq ft)',
    '  Habitaciones: 2 recámaras | 2 baños | 1 parqueo',
    '  Vista: Frente al mar (Bahía de Panamá)',
    '  Estado: Terminado, listo para entregar',
    '',
    'VALORACIÓN:',
    '  Precio de venta: USD 380,000',
    '  Avalúo bancario (Banco General, 2024): USD 362,000',
    '  Precio por m²: USD 3,166',
    '  Referencia de mercado en la zona: USD 2,800 - USD 3,500/m²',
    '',
    'CARGAS Y GRAVÁMENES:',
    '  Hipoteca: Ninguna (libre de gravamen)',
    '  Litigios pendientes: Ninguno',
    '  Impuesto de inmueble: Al día',
    '',
    'Certificación del Registro Público: 05 de diciembre de 2024.',
  ]));

  // dr_re_6 — Forma de pago del Bien Inmueble
  save(OUT_RE, 're_6_forma_pago_bien_inmueble.pdf', await makePdf([
    'FORMA DE PAGO DEL BIEN INMUEBLE',
    'Inmobiliaria Istmo, S.A.',
    'Expediente de Compra: Torre Pacífico, Apto 14C',
    '',
    'Comprador: José Ramón Peñaloza Díaz | Cédula: 9-712-456',
    'Precio total acordado: USD 380,000',
    '',
    'DETALLE DE PAGOS REALIZADOS Y PROGRAMADOS:',
    '',
    '  PAGOS REALIZADOS:',
    '  Cuota prima (10-12-2024): USD  76,000 — EFECTIVO (4 depósitos)',
    '  Abono 1   (20-12-2024):   USD  55,000 — Cheque gerencia tercero',
    '  Abono 2   (05-01-2025):   USD  49,000 — Transferencia intl. (Ecuador)',
    '  Total recibido:           USD 180,000 (47.4% del precio)',
    '',
    '  PAGOS PENDIENTES:',
    '  Balance:                  USD 200,000 (52.6%)',
    '  Forma prevista: Préstamo hipotecario (en gestión) O pago de contado',
    '  Fecha límite de cancelación total: 10 de junio de 2025',
    '',
    'OBSERVACIONES DEL OFICIAL DE CUMPLIMIENTO:',
    '  - El 47% del precio fue pagado en efectivo/cheque de tercero/intl.',
    '  - Los pagos en efectivo fueron divididos en montos menores a USD 20K.',
    '  - No se presentó comprobante de préstamo bancario aprobado.',
    '  - La procedencia de los USD 200,000 pendientes es desconocida.',
    '',
    'Firma del Oficial de Cumplimiento: _______________________ | 15-01-2025',
  ]));

  // dr_re_7 — Sustento de procedencia de fondos
  save(OUT_RE, 're_7_sustento_procedencia_fondos.pdf', await makePdf([
    'SUSTENTO DE PROCEDENCIA DE FONDOS',
    'Inmobiliaria Istmo, S.A. — Departamento de Cumplimiento',
    '',
    'Comprador: José Ramón Peñaloza Díaz | Cédula: 9-712-456',
    'Referencia: Compra Apto 14C, Torre Pacífico | USD 380,000',
    '',
    'DOCUMENTACIÓN SOLICITADA AL COMPRADOR (10-12-2024):',
    '  1. Estados de cuenta bancarios (últimos 6 meses)',
    '  2. Declaraciones de renta (años 2022, 2023)',
    '  3. Contratos comerciales o facturas de ventas',
    '  4. Justificación del préstamo de familiar (USD 200,000)',
    '',
    'DOCUMENTACIÓN RECIBIDA DEL COMPRADOR (15-12-2024):',
    '  [OK] Fotocopia de cedula',
    '  [NO] Estados de cuenta: NO PRESENTO',
    '  [NO] Declaraciones de renta: NO PRESENTO (no declarante DGI)',
    '  [NO] Contratos comerciales: PRESENTO facturas sin RUC verificable',
    '  [NO] Sustento del prestamo: Carta manuscrita sin notariar de familiar',
    '',
    'EVALUACIÓN DEL OFICIAL DE CUMPLIMIENTO:',
    '  Los documentos presentados son insuficientes para verificar el origen',
    '  lícito de los fondos. Las facturas presentadas no están registradas',
    '  en el sistema tributario panameño (DGI). El comprador no es',
    '  contribuyente activo registrado en la DGI.',
    '',
    '  Indicadores de alerta detectados:',
    '  [X] Pago en efectivo fraccionado (posible estructuracion)',
    '  [X] Uso de cheque de tercera persona juridica',
    '  [X] Fondos provenientes del exterior sin justificacion',
    '  [X] Incapacidad de acreditar ingresos licitos suficientes',
    '  [X] El comprador no figura como contribuyente activo en DGI',
    '',
    'RESOLUCIÓN: Se determina presentar ROS ante la UAF.',
    'Firma: Lic. Patricia Vásquez | Oficial de Cumplimiento | 20-01-2025',
  ]));

  console.log('  ✅ Inmobiliaria completado (7 docs requeridos)');
}

async function main() {
  console.log('Generando test-docs adicionales...');
  await genBancoJuridica();
  await genInmobiliaria();
  console.log('\n✅ Completado.');
  console.log('\nUso:');
  console.log('  test-docs/banco-juridica/bl_*.pdf  → ROS Banco · Persona Jurídica');
  console.log('  test-docs/inmobiliaria/re_*.pdf    → ROS Inmobiliaria / Promotora');
}

main().catch(console.error);
