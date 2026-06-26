/**
 * Genera documentos de prueba para el flujo ROS Banco · Persona Natural.
 * Crea PDFs con contenido relevante, PDFs con contenido incorrecto,
 * e imágenes PNG con texto (para probar OCR).
 *
 * Uso: npx tsx scripts/generate-test-docs.ts
 * Salida: test-docs/
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'test-docs');
mkdirSync(OUT, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function makePng(lines: string[]): Buffer {
  const canvas = createCanvas(794, 1123); // A4 a 96dpi
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 794, 1123);
  ctx.fillStyle = '#000000';
  ctx.font = '16px sans-serif';
  let y = 60;
  for (const line of lines) {
    ctx.fillText(line, 50, y);
    y += 24;
  }
  return canvas.toBuffer('image/png') as Buffer;
}

function save(name: string, buf: Buffer) {
  const path = join(OUT, name);
  writeFileSync(path, buf);
  console.log('✓', name);
}

// ── Documentos CORRECTOS (deben pasar la validación de contenido) ─────────────

async function genCorrectos() {
  // 1. Documentos de Apertura de la Cuenta
  save('1_apertura_cuenta.pdf', await makePdf([
    'DOCUMENTOS DE APERTURA DE CUENTA',
    'Banco Nacional de Panama',
    'Formulario de Apertura de Cuenta de Ahorro / Corriente',
    '',
    'Nombre del cliente: Carlos Eduardo Martinez',
    'Cedula de identidad: 8-987-654',
    'Tipo de cuenta: Cuenta corriente personal',
    'Fecha de apertura: 15 de enero de 2025',
    'Sucursal: Panama Centro',
    '',
    'El presente documento certifica la apertura de la cuenta bancaria',
    'con todos los requisitos de debida diligencia cumplidos segun',
    'las normas internas del banco y la regulacion de la UAF.',
    '',
    'Firma del oficial de cuenta: _______________________',
    'Aprobado por: Departamento de Cumplimiento',
  ]));

  // 2. Contrato de Servicios Bancarios
  save('2_contrato_servicios_bancarios.pdf', await makePdf([
    'CONTRATO DE SERVICIOS BANCARIOS',
    '',
    'Entre: Banco Nacional de Panama (en adelante "El Banco")',
    'Y: Carlos Eduardo Martinez, cedula 8-987-654',
    '   (en adelante "El Cliente")',
    '',
    'CLAUSULAS DEL CONTRATO:',
    '1. El Banco provee servicios bancarios de deposito, retiro,',
    '   transferencia y credito conforme a la ley bancaria panameña.',
    '2. El Cliente se compromete a informar el origen licito de los fondos.',
    '3. Ambas partes acuerdan cumplir con la Ley 23 de 2015 sobre',
    '   prevencion del lavado de activos y financiamiento del terrorismo.',
    '',
    'Firma del Cliente: _______________________',
    'Firma del Banco:   _______________________',
    'Fecha: 15 de enero de 2025',
  ]));

  // 3. Documento de identidad (Cédula)
  save('3_cedula_identidad.pdf', await makePdf([
    'DOCUMENTO DE IDENTIDAD PERSONAL',
    'Cedula de Identidad Personal - Republica de Panama',
    '',
    'Nombre: Carlos Eduardo Martinez Rios',
    'Cedula: 8-987-654',
    'Fecha de nacimiento: 12 de marzo de 1980',
    'Lugar de nacimiento: Panama, Republica de Panama',
    'Fecha de expedicion: 01 de febrero de 2022',
    'Fecha de vencimiento: 01 de febrero de 2027',
    '',
    'Copia autenticada por Notario Publico',
    'La presente copia es fiel y exacta del documento original de identidad.',
    'Cedula valida para identificacion personal segun ley panameña.',
  ]));

  // 4. Debida Diligencia del Cliente
  save('4_debida_diligencia.pdf', await makePdf([
    'FORMULARIO DE DEBIDA DILIGENCIA DEL CLIENTE',
    'Know Your Customer (KYC) - Actualizacion',
    '',
    'Datos del Cliente:',
    '  Nombre completo: Carlos Eduardo Martinez Rios',
    '  Cedula: 8-987-654',
    '  Ocupacion: Ingeniero Civil independiente',
    '  Direccion: Calle 50, Edificio Torre Global, Apto 12, Panama',
    '  Telefono: +507 6000-0000',
    '',
    'Debida diligencia realizada por: Lic. Roberto Mendoza',
    'Cargo: Oficial de Cumplimiento',
    'Fecha de actualizacion: 10 de enero de 2025',
    '',
    'PEP (Persona Expuesta Politicamente): No',
    'Origen de fondos declarado: Honorarios profesionales',
    'Nivel de riesgo asignado: Medio',
    'Resultado de la debida diligencia: Aprobado',
  ]));

  // 5. Perfil Transaccional del Cliente
  save('5_perfil_transaccional.pdf', await makePdf([
    'PERFIL TRANSACCIONAL DEL CLIENTE',
    'Banco Nacional de Panama - Departamento de Cumplimiento',
    '',
    'Cliente: Carlos Eduardo Martinez | Cedula: 8-987-654',
    'Periodo analizado: Enero 2024 - Enero 2025',
    '',
    'Resumen de transacciones:',
    '  Depositos mensuales promedio: USD 8,500',
    '  Retiros mensuales promedio:   USD 6,200',
    '  Transferencias recibidas:     USD 3,000 / mes',
    '  Transferencias enviadas:      USD 1,500 / mes',
    '',
    'Patron transaccional: Consistente con perfil de profesional independiente.',
    'No se observan transacciones inusuales en el historial.',
    'Saldo promedio mensual: USD 15,000',
    '',
    'Elaborado por: Sistema de monitoreo transaccional automatico',
    'Revisado por: Lic. Roberto Mendoza, Oficial de Cumplimiento',
  ]));

  // 6. Perfil de Ingresos y Egresos
  save('6_perfil_ingresos_egresos.pdf', await makePdf([
    'PERFIL DE INGRESOS Y EGRESOS DECLARADOS',
    '',
    'Cliente: Carlos Eduardo Martinez Rios',
    'Cedula: 8-987-654',
    'Actividad economica: Consultoria de ingenieria civil',
    '',
    'INGRESOS DECLARADOS (mensuales):',
    '  Honorarios por consultoria:       USD 9,000',
    '  Alquileres de propiedad:          USD 1,500',
    '  Total ingresos declarados:        USD 10,500',
    '',
    'EGRESOS DECLARADOS (mensuales):',
    '  Gastos operativos de negocio:     USD 2,500',
    '  Gastos personales y familiares:   USD 3,500',
    '  Inversiones y ahorro:             USD 2,000',
    '  Total egresos declarados:         USD 8,000',
    '',
    'El perfil de ingresos y egresos es consistente con la actividad',
    'economica declarada y el movimiento de la cuenta bancaria.',
  ]));

  // 7. Comunicaciones internas para descartar hechos inusuales
  save('7_comunicaciones_internas.pdf', await makePdf([
    'COMUNICACIONES INTERNAS - DESCARTE DE HECHOS INUSUALES',
    'Banco Nacional de Panama | Departamento de Cumplimiento',
    '',
    'Asunto: Analisis de operacion inusual - Cliente 8-987-654',
    'De: Lic. Roberto Mendoza, Oficial de Cumplimiento',
    'Para: Comite de Cumplimiento',
    'Fecha: 20 de enero de 2025',
    '',
    'Se identifica transferencia entrante por USD 450,000 proveniente',
    'de Dubai, Emiratos Arabes Unidos. Se procede a investigar.',
    '',
    'Acciones tomadas:',
    '1. Contacto al cliente para solicitar justificacion comercial.',
    '2. Revision del perfil transaccional historico.',
    '3. Consulta de listas internacionales OFAC, ONU y GAFI.',
    '4. Analisis del perfil de riesgo del cliente.',
    '',
    'Resultado: El cliente no pudo justificar la operacion de forma',
    'satisfactoria. Se eleva el caso al Oficial de Cumplimiento Senior.',
    'Recomendacion: Presentar ROS ante la UAF.',
  ]));

  // 8. Comunicaciones enviadas y recibidas sobre gestiones de descarte
  save('8_comunicaciones_descarte.pdf', await makePdf([
    'COMUNICACIONES ENVIADAS Y RECIBIDAS - GESTIONES DE DESCARTE',
    '',
    'Expediente: Cliente Carlos Eduardo Martinez | 8-987-654',
    '',
    '--- Correo enviado al cliente (18-01-2025) ---',
    'Estimado Sr. Martinez, por medio de la presente le solicitamos',
    'documentacion que justifique la transferencia recibida el 15/01/2025',
    'por USD 450,000. Favor presentar en un plazo de 5 dias habiles.',
    '',
    '--- Respuesta del cliente (20-01-2025) ---',
    'Estimado Banco, adjunto constancia de contrato comercial. Sin embargo,',
    'la documentacion no es suficiente para sustentar el monto.',
    '',
    '--- Comunicacion interna (21-01-2025) ---',
    'Tras analizar la respuesta del cliente y la documentacion presentada,',
    'el Comite de Cumplimiento determina que la operacion no puede ser',
    'descartada. Se procede con la presentacion del ROS ante la UAF.',
    '',
    'Firma: Lic. Roberto Mendoza | Oficial de Cumplimiento',
  ]));

  // Condicional: Constancia de Ingresos
  save('cond_constancia_ingresos.pdf', await makePdf([
    'CONSTANCIA DE INGRESOS',
    'Declaracion de Renta - Direccion General de Ingresos (DGI)',
    'Republica de Panama',
    '',
    'Se certifica que el contribuyente:',
    'Nombre: Carlos Eduardo Martinez Rios',
    'Cedula: 8-987-654',
    'RUC: 8-987-654-0-2020',
    '',
    'Ha declarado ingresos durante el periodo fiscal 2024:',
    '  Ingresos por servicios profesionales:  USD 108,000',
    '  Deducciones permitidas:                USD  18,000',
    '  Renta gravable:                        USD  90,000',
    '  Impuesto sobre la renta pagado:        USD  19,800',
    '',
    'Esta constancia es emitida por la DGI para fines bancarios y',
    'de cumplimiento con la normativa anti lavado de dinero.',
    '',
    'Sello y firma de la DGI: _______________________',
  ]));

  // Condicional: Carta de Trabajo
  save('cond_carta_trabajo.pdf', await makePdf([
    'CARTA DE TRABAJO',
    '',
    'Panama, 10 de enero de 2025',
    '',
    'A quien corresponda:',
    '',
    'Por medio de la presente hacemos constar que el señor',
    'Carlos Eduardo Martinez Rios, portador de la cedula 8-987-654,',
    'labora en nuestra empresa como Ingeniero Civil Senior',
    'desde el 01 de marzo de 2018 hasta la fecha.',
    '',
    'Su salario mensual es de USD 5,500 mas beneficios de ley.',
    'El empleado cuenta con contrato indefinido a tiempo completo.',
    '',
    'Esta carta se expide a solicitud del interesado para fines bancarios.',
    '',
    'Atentamente,',
    'Constructora Delta, S.A.',
    'Firma del Gerente de RRHH: _______________________',
  ]));

  console.log('\n✅ PDFs correctos generados.');
}

// ── Documentos INCORRECTOS (deben disparar advertencia de contenido) ──────────

async function genIncorrectos() {
  // PDF completamente irrelevante subido en lugar del documento de identidad
  save('INCORRECTO_menu_restaurante.pdf', await makePdf([
    'MENU DEL DIA - RESTAURANTE EL BUEN SABOR',
    '',
    'Almuerzo ejecutivo - Precio: USD 8.50',
    '',
    'Entrada: Sopa del dia (pollo o res)',
    'Plato principal (elegir uno):',
    '  - Arroz con pollo y ensalada',
    '  - Filete de pescado al vapor',
    '  - Carne guisada con patacones',
    'Postre: Flan de caramel o fruta del dia',
    'Bebida: Refresco natural o agua',
    '',
    'Horario de atencion: Lunes a viernes 11:00 am - 3:00 pm',
    'Tel: 507-222-3344',
  ]));

  // Imagen PNG: texto relevante (para probar OCR en imagenes correctas)
  save('img_cedula_escaneada.png', makePng([
    'CEDULA DE IDENTIDAD PERSONAL',
    'Republica de Panama',
    '',
    'Nombre: Carlos Eduardo Martinez',
    'Cedula: 8-987-654',
    'Fecha nacimiento: 12/03/1980',
    'Expedicion: 01/02/2022',
    'Vencimiento: 01/02/2027',
    '',
    'Documento de identidad valido',
    'Copia para uso bancario',
  ]));

  // Imagen PNG: contenido incorrecto (foto genérica sin texto relevante)
  save('INCORRECTO_imagen_paisaje.png', makePng([
    'Fotografia de paisaje',
    'Tomada en la playa',
    'Vacaciones 2024',
    '',
    'Archivo personal - no es documento oficial',
  ]));

  // PDF "duplicado" — mismo contenido que el doc 3 pero con nombre diferente
  // para probar que el sistema detecta el nombre duplicado
  save('DUPLICADO_cedula_copia2.pdf', await makePdf([
    'DOCUMENTO DE IDENTIDAD PERSONAL (COPIA 2)',
    'Esta es una copia adicional del mismo documento de identidad.',
    'Cedula: 8-987-654',
    'Si subes este archivo Y el anterior con el mismo nombre,',
    'el sistema deberia advertirte del nombre duplicado.',
  ]));

  console.log('✅ Documentos incorrectos/de prueba generados.');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generando documentos de prueba en test-docs/\n');
  await genCorrectos();
  await genIncorrectos();
  console.log(`\nTotal: ${8 + 2 + 4} archivos en ${OUT}`);
  console.log('\nGuia de uso:');
  console.log('  1-8_*.pdf        → subir en su sección correspondiente (deben pasar)');
  console.log('  cond_*.pdf       → documentos condicionales (opcionales en el form)');
  console.log('  img_*.png        → imágenes con texto, prueban OCR (deben pasar)');
  console.log('  INCORRECTO_*.pdf/png → deben generar advertencia de contenido');
  console.log('  DUPLICADO_*.pdf  → subir dos veces con mismo nombre para probar bloqueo');
}

main().catch(console.error);
