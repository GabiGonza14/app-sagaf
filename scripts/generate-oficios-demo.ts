/**
 * Genera oficios de supervisión con formato institucional (pruebas SAGAF).
 * Uso: pnpm docs:oficios-demo
 * Salida: test-docs/supervision/
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from 'pdf-lib';

const OUT = join(process.cwd(), 'test-docs', 'supervision');
mkdirSync(OUT, { recursive: true });

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface OficioSpec {
  filename: string;
  organismoLabel: string;
  organismoSub: string;
  direccion: string;
  telefono: string;
  web: string;
  numeroOficio: string;
  asunto: string;
  fechaOficio: string;
  fechaOficioTexto: string;
  plazoRespuesta: string;
  plazoTexto: string;
  destinatario: string;
  cargoDestinatario: string;
  entidad: string;
  cuerpo: string[];
  firmaNombre: string;
  firmaCargo: string;
  copias: string[];
  tipoSagaf: string;
  organismoSagaf: string;
}

const SPECS: OficioSpec[] = [
  {
    filename: 'SBP-01-requerimiento-inicial-PLAFT.pdf',
    organismoLabel: 'SUPERINTENDENCIA DE BANCOS DE PANAMÁ',
    organismoSub: 'República de Panamá',
    direccion: 'Edificio Torre Banistmo, Calle 50, Ciudad de Panamá',
    telefono: 'Tel. (507) 500-0000 · www.superbancos.gob.pa',
    web: 'Dirección de Supervisión Bancaria — División de Cumplimiento Normativo',
    numeroOficio: 'SBP-DSB-2026-004821',
    asunto: 'Requerimiento inicial de información — Inspección ordinaria Programa PLA/FT',
    fechaOficio: '2026-07-05',
    fechaOficioTexto: 'Ciudad de Panamá, 5 de julio de 2026',
    plazoRespuesta: '2026-07-25',
    plazoTexto: 'veinte (20) días hábiles contados a partir de la notificación del presente oficio',
    destinatario: 'Lic. Oficial de Cumplimiento',
    cargoDestinatario: 'Banco Nacional de Panamá',
    entidad: 'Banco Nacional de Panamá',
    tipoSagaf: 'requerimiento_inicial',
    organismoSagaf: 'sbp',
    cuerpo: [
      'De nuestra consideración:',
      '',
      'En el marco de la inspección ordinaria programada al Banco Nacional de Panamá, y en ejercicio de las facultades conferidas por la Ley 42 de 23 de abril de 2001, reformada, y demás normativa aplicable en materia de prevención de lavado de activos, financiamiento del terrorismo y financiamiento de la proliferación de armas de destrucción masiva, se solicita la siguiente información:',
      '',
      '1. Listado de Reportes de Operaciones Sospechosas (ROS) recibidos entre el 01-ene-2026 y el 30-jun-2026, con indicación de estado de tramitación y porcentaje de documentación obligatoria cargada en los sistemas de control interno.',
      '2. Matriz de riesgos LA/FT/FPADM vigente, debidamente aprobada por el órgano competente, con fecha de última actualización.',
      '3. Manual de prevención de lavado de activos y financiamiento del terrorismo — última versión aprobada.',
      '4. Organigrama del área de cumplimiento, con designación y funciones del Oficial de Cumplimiento.',
      '5. Indicadores de monitoreo transaccional y alertas gestionadas durante el periodo citado.',
      '',
      'La información deberá remitirse por los canales formales establecidos para comunicaciones con esta Superintendencia, adjuntando índice de documentos y citando el número de oficio en todo envío.',
      '',
      'Plazo de respuesta: veinte (20) días hábiles.',
    ],
    firmaNombre: 'Lic. María Elena Castillo de Gracia',
    firmaCargo: 'Directora de Supervisión Bancaria',
    copias: ['Expediente de inspección ordinaria 2026', 'División de Cumplimiento Normativo — Archivo'],
  },
  {
    filename: 'SBP-02-requerimiento-complementario-ROS.pdf',
    organismoLabel: 'SUPERINTENDENCIA DE BANCOS DE PANAMÁ',
    organismoSub: 'República de Panamá',
    direccion: 'Edificio Torre Banistmo, Calle 50, Ciudad de Panamá',
    telefono: 'Tel. (507) 500-0000 · www.superbancos.gob.pa',
    web: 'Dirección de Supervisión Bancaria — División de Cumplimiento Normativo',
    numeroOficio: 'SBP-DSB-2026-004977',
    asunto: 'Requerimiento complementario — Expedientes ROS citados en informe preliminar',
    fechaOficio: '2026-07-10',
    fechaOficioTexto: 'Ciudad de Panamá, 10 de julio de 2026',
    plazoRespuesta: '2026-07-20',
    plazoTexto: 'diez (10) días hábiles',
    destinatario: 'Lic. Oficial de Cumplimiento',
    cargoDestinatario: 'Banco Nacional de Panamá',
    entidad: 'Banco Nacional de Panamá',
    tipoSagaf: 'requerimiento_complementario',
    organismoSagaf: 'sbp',
    cuerpo: [
      'Referencia: Oficio SBP-DSB-2026-004821 del 5 de julio de 2026.',
      '',
      'Complementando el requerimiento inicial de información, y con fundamento en el informe preliminar de la inspección ordinaria, se solicita información adicional sobre los siguientes expedientes:',
      '',
      '   • ROS-2026-000002 — Depósitos fraccionados en efectivo',
      '   • ROS-2026-000003 — Cliente PEP con transacciones atípicas',
      '   • ROS-2026-000005 — Subsanación documental pendiente',
      '',
      'Para cada expediente se requiere:',
      '   a) Narrativa de la investigación interna y decisión de reporte a la UAF.',
      '   b) Evidencia documental de debida diligencia reforzada aplicada.',
      '   c) Trazabilidad de aprobaciones internas hasta el envío del ROS.',
      '',
      'El alcance de la respuesta debe limitarse estrictamente a los expedientes citados. Cualquier información adicional deberá justificarse por escrito.',
    ],
    firmaNombre: 'Lic. María Elena Castillo de Gracia',
    firmaCargo: 'Directora de Supervisión Bancaria',
    copias: ['Expediente ROS — Inspección 2026', 'Área de Análisis de Riesgos'],
  },
  {
    filename: 'UAF-01-requerimiento-informacion-complementaria.pdf',
    organismoLabel: 'UNIDAD DE ANÁLISIS FINANCIERO',
    organismoSub: 'Consejo Nacional de Seguridad Pública — República de Panamá',
    direccion: 'Ciudad del Saber, Clayton, Ciudad de Panamá',
    telefono: 'Tel. (507) 288-5000 · www.uaf.gob.pa',
    web: 'Dirección de Inteligencia Financiera — Área de Análisis Operativo',
    numeroOficio: 'UAF-DINF-2026-11832',
    asunto: 'Solicitud de información complementaria sobre ROS en análisis',
    fechaOficio: '2026-07-08',
    fechaOficioTexto: 'Ciudad de Panamá, 8 de julio de 2026',
    plazoRespuesta: '2026-07-18',
    plazoTexto: 'diez (10) días hábiles',
    destinatario: 'Oficial de Cumplimiento',
    cargoDestinatario: 'Banco Nacional de Panamá',
    entidad: 'Banco Nacional de Panamá',
    tipoSagaf: 'requerimiento_complementario',
    organismoSagaf: 'otro',
    cuerpo: [
      'Referencia: ROS-2026-000002 — en análisis por esta Unidad.',
      '',
      'En virtud de las facultades otorgadas por la Ley 23 de 2015 y el Decreto Ejecutivo que regula el funcionamiento de la UAF, se solicita al sujeto obligado remitir la siguiente información complementaria:',
      '',
      '1. Ampliación de la narrativa de la operación reportada, incluyendo origen y destino de los fondos involucrados.',
      '2. Estados de cuenta que sustenten el perfil transaccional declarado para el cliente reportado.',
      '3. Confirmación escrita sobre la vigencia o terminación de la relación comercial con el cliente.',
      '',
      'La respuesta deberá enviarse por el canal institucional autorizado, citando en el asunto el número de oficio y el número de ROS.',
    ],
    firmaNombre: 'Lic. Roberto Andrés Méndez',
    firmaCargo: 'Director de Inteligencia Financiera',
    copias: ['Expediente de análisis ROS-2026-000002', 'Archivo institucional UAF'],
  },
];

async function loadFonts(doc: PDFDocument) {
  const reg = join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf');
  const bold = join(process.cwd(), 'assets', 'fonts', 'NotoSans-Bold.ttf');
  if (existsSync(reg) && existsSync(bold)) {
    doc.registerFontkit(fontkit);
    return {
      regular: await doc.embedFont(readFileSync(reg)),
      bold: await doc.embedFont(readFileSync(bold)),
    };
  }
  return {
    regular: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
}

function wrap(font: PDFFont, text: string, maxW: number, size: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: RGB,
  lh: number,
): number {
  let cy = y;
  for (const ln of lines) {
    if (ln === '') {
      cy -= lh * 0.55;
      continue;
    }
    page.drawText(ln, { x, y: cy, font, size, color });
    cy -= lh;
  }
  return cy;
}

async function buildOficioPdf(spec: OficioSpec): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const { regular: font, bold: fontBold } = await loadFonts(doc);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ink = rgb(0.06, 0.08, 0.12);
  const muted = rgb(0.35, 0.38, 0.42);
  const brand = rgb(0.04, 0.18, 0.38);

  // Membrete
  page.drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_W, height: 3, color: brand });
  y -= 20;
  page.drawText(spec.organismoLabel, { x: MARGIN, y, font: fontBold, size: 13, color: brand });
  y -= 14;
  page.drawText(spec.organismoSub, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 12;
  page.drawText(spec.direccion, { x: MARGIN, y, font, size: 8, color: muted });
  y -= 11;
  page.drawText(spec.telefono, { x: MARGIN, y, font, size: 8, color: muted });
  y -= 11;
  page.drawText(spec.web, { x: MARGIN, y, font: fontBold, size: 8, color: muted });
  y -= 22;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.75,
    color: rgb(0.75, 0.78, 0.82),
  });
  y -= 28;

  const ensure = (need: number) => {
    if (y - need < MARGIN + 60) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Fecha y número
  y = drawLines(page, font, wrap(font, spec.fechaOficioTexto, CONTENT_W, 10), MARGIN, y, 10, ink, 13);
  y -= 16;
  page.drawText(`Oficio N° ${spec.numeroOficio}`, { x: MARGIN, y, font: fontBold, size: 10, color: ink });
  y -= 14;
  const [y0, m0, d0] = spec.fechaOficio.split('-');
  const [y1, m1, d1] = spec.plazoRespuesta.split('-');
  page.drawText(`Fecha del oficio: ${d0}/${m0}/${y0}`, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 12;
  page.drawText(`Plazo de respuesta: ${d1}/${m1}/${y1}`, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 18;

  // Destinatario
  page.drawText('Señores', { x: MARGIN, y, font, size: 10, color: ink });
  y -= 13;
  page.drawText(spec.destinatario, { x: MARGIN, y, font: fontBold, size: 10, color: ink });
  y -= 13;
  page.drawText(spec.cargoDestinatario, { x: MARGIN, y, font, size: 10, color: ink });
  y -= 13;
  page.drawText('Presente.-', { x: MARGIN, y, font, size: 10, color: ink });
  y -= 20;

  // Asunto
  page.drawText('ASUNTO:', { x: MARGIN, y, font: fontBold, size: 10, color: ink });
  y = drawLines(page, fontBold, wrap(fontBold, spec.asunto, CONTENT_W - 70, 10), MARGIN + 70, y, 10, ink, 13);
  y -= 16;

  // Cuerpo
  for (const block of spec.cuerpo) {
    ensure(40);
    if (block === '') {
      y -= 8;
      continue;
    }
    const isItem = /^\d+\.|^[a-z]\)|^•/.test(block.trim());
    const f = isItem ? font : font;
    const indent = isItem ? 12 : 0;
    y = drawLines(page, f, wrap(f, block, CONTENT_W - indent, 10.5), MARGIN + indent, y, 10.5, ink, 14);
    y -= 4;
  }

  y -= 12;
  ensure(120);
  page.drawText('Sin otro particular, nos despedimos atentamente,', { x: MARGIN, y, font, size: 10.5, color: ink });
  y -= 36;

  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: MARGIN + 200, y: y + 8 },
    thickness: 0.5,
    color: ink,
  });
  y -= 8;
  page.drawText(spec.firmaNombre, { x: MARGIN, y, font: fontBold, size: 10, color: ink });
  y -= 13;
  page.drawText(spec.firmaCargo, { x: MARGIN, y, font, size: 9.5, color: muted });
  y -= 13;
  page.drawText(spec.organismoLabel, { x: MARGIN, y, font, size: 9, color: muted });
  y -= 24;

  page.drawText('c.c.:', { x: MARGIN, y, font: fontBold, size: 8.5, color: muted });
  y -= 12;
  for (const cc of spec.copias) {
    page.drawText(`     • ${cc}`, { x: MARGIN, y, font, size: 8.5, color: muted });
    y -= 11;
  }

  // Pie de página en todas las páginas
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${spec.numeroOficio}  ·  Página ${i + 1} de ${pages.length}`, {
      x: MARGIN,
      y: 40,
      font,
      size: 7.5,
      color: muted,
    });
  });

  return Buffer.from(await doc.save());
}

async function main() {
  const manifest: string[] = [
    '# Oficios de prueba — Módulo de supervisión SAGAF',
    '',
    '| Archivo | Organismo en SAGAF | Tipo |',
    '|---------|-------------------|------|',
  ];

  for (const spec of SPECS) {
    const buf = await buildOficioPdf(spec);
    const path = join(OUT, spec.filename);
    writeFileSync(path, buf);
    manifest.push(`| ${spec.filename} | ${spec.organismoSagaf} | ${spec.tipoSagaf} |`);
    console.log(`✓ ${path}`);
  }

  writeFileSync(join(OUT, 'README.md'), [
    ...manifest,
    '',
    '## Uso en SAGAF',
    '1. Login OC: `cumplimiento@banconacional.com.pa` / `password123`',
    '2. `/portal/supervision/nueva` → subir PDF → validar vista del documento → registrar',
    '3. Detalle del oficio: `/portal/supervision/[id]` — visor PDF integrado',
    '',
    'Regenerar: `pnpm docs:oficios-demo`',
  ].join('\n'), 'utf8');

  console.log(`\nListo. Carpeta: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
