// lib/supervision/reporte-pdf.ts — Informe PDF formal de respuesta a supervisión
import { readFileSync, existsSync } from 'node:fs';
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

export interface PaqueteManifest {
  manifiesto: {
    version: string;
    solicitud: string;
    generado: string;
    hash_algoritmo: string;
  };
  respuesta: {
    titulo: string;
    responsable: { nombre?: string; cargo?: string; correo?: string };
    items_atendidos: string[];
    fundamento_alcance: string | null;
    notas_para_regulator: string | null;
  };
  oficio: {
    numero: string | null;
    tipo: string;
    tipo_id?: string;
    asunto: string | null;
    organismo: string;
    fecha_oficio: string | null;
    plazo_respuesta: string | null;
  } | null;
  entidad_reportante: { nombre?: string; tipo?: string; sector?: string; organismo_supervisor?: string } | null;
  alcance: {
    tipo: string;
    fecha_desde?: string | null;
    fecha_hasta?: string | null;
    ros_incluidos: number;
    numeros_ros: string[];
  };
  nivel_contenido: string;
  contenido_incluido: Record<string, boolean>;
  expedientes: Array<{
    numero_ros: string;
    estado: string;
    fecha_recepcion: string;
    detalle: Record<string, unknown> | null;
  }>;
  trazabilidad: Array<Record<string, unknown>>;
  nota_legal: string;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 52;
const FOOTER_TOP = 56;
const BODY = 10;
const SMALL = 8.5;
const LH = 14;
const LH_SM = 12;

const C = {
  ink: rgb(0.07, 0.1, 0.16),
  inkSoft: rgb(0.2, 0.24, 0.3),
  muted: rgb(0.42, 0.46, 0.52),
  line: rgb(0.78, 0.82, 0.86),
  lineLight: rgb(0.9, 0.92, 0.94),
  brand: rgb(0.05, 0.24, 0.48),
  brandLight: rgb(0.93, 0.96, 0.99),
  white: rgb(1, 1, 1),
  zebra: rgb(0.98, 0.99, 1),
  accent: rgb(0.12, 0.45, 0.38),
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return iso;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function scalarString(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function fmtMonto(monto: unknown, moneda: unknown): string {
  if (monto == null || monto === '') return '—';
  const n = Number(monto);
  const cur = scalarString(moneda) ?? 'USD';
  const montoStr = scalarString(monto);
  if (Number.isNaN(n)) return montoStr ?? '—';
  return `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function labelAlcance(tipo: string): string {
  const map: Record<string, string> = {
    periodo: 'Por periodo de recepción de ROS',
    lista_ros: 'Lista explícita de expedientes citados',
    muestra: 'Muestra aleatoria representativa',
  };
  return map[tipo] ?? tipo;
}

function labelOrganismo(o: string): string {
  const map: Record<string, string> = {
    sbp: 'Superintendencia de Bancos de Panamá',
    isrnnf: 'Intendencia de Seguros y Reaseguros No Financieros',
    otro: 'Otro organismo supervisor',
  };
  return map[o] ?? o.toUpperCase();
}

function labelNivel(n: string): string {
  const map: Record<string, string> = {
    metadatos: 'Metadatos básicos',
    resumido: 'Resumen operativo',
    completo: 'Detalle completo',
  };
  return map[n] ?? n;
}

function labelEstadoRos(e: string): string {
  const map: Record<string, string> = {
    borrador: 'Borrador',
    en_revision: 'En revisión interna',
    enviado_uaf: 'Enviado a UAF',
    subsanacion: 'En subsanación',
    cerrado: 'Cerrado',
    archivado: 'Archivado',
  };
  return map[e] ?? e.replace(/_/g, ' ');
}

function fmtPct(v: unknown): string {
  if (v == null || typeof v === 'object') return '—';
  return `${v}%`;
}

function str(v: unknown, max = 500): string {
  const raw = scalarString(v);
  if (raw == null) return '—';
  const s = raw.trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function appendWordLine(
  font: PDFFont,
  lines: string[],
  line: string,
  word: string,
  maxWidth: number,
  size: number,
): string {
  const test = line ? `${line} ${word}` : word;
  if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
    lines.push(line);
    return word;
  }
  return test;
}

function wrapParagraph(font: PDFFont, para: string, maxWidth: number, size: number): string[] {
  const words = para.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    line = appendWordLine(font, lines, line, word, maxWidth, size);
  }
  if (line) lines.push(line);
  return lines;
}

function wrapLines(font: PDFFont, text: string, maxWidth: number, size: number): string[] {
  const lines = text.split('\n').flatMap((para) => wrapParagraph(font, para, maxWidth, size));
  return lines.length ? lines : ['—'];
}

interface DrawLinesOpts {
  page: PDFPage;
  font: PDFFont;
  lines: string[];
  x: number;
  y: number;
  size: number;
  color: RGB;
  lineHeight?: number;
}

function drawLines(opts: DrawLinesOpts): number {
  const { page, font, lines, x, y, size, color, lineHeight = LH } = opts;
  let cy = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cy, font, size, color });
    cy -= lineHeight;
  }
  return cy;
}

async function embedReportFonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  const regPath = join(process.cwd(), 'assets', 'fonts', 'NotoSans-Regular.ttf');
  const boldPath = join(process.cwd(), 'assets', 'fonts', 'NotoSans-Bold.ttf');
  if (existsSync(regPath) && existsSync(boldPath)) {
    doc.registerFontkit(fontkit);
    const regular = await doc.embedFont(readFileSync(regPath));
    const bold = await doc.embedFont(readFileSync(boldPath));
    return { regular, bold };
  }
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

class ReportePdfWriter {
  private doc: PDFDocument;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private page!: PDFPage;
  private y = 0;
  private pageNum = 0;
  private manifest!: PaqueteManifest;
  private hash = '';
  private sectionNum = 0;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  async init(manifest: PaqueteManifest, hash: string) {
    this.manifest = manifest;
    this.hash = hash;
    const fonts = await embedReportFonts(this.doc);
    this.font = fonts.regular;
    this.fontBold = fonts.bold;
    this.renderCover();
  }

  private bottomLimit() {
    return FOOTER_TOP + 20;
  }

  private newContentPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNum += 1;
    const entidad = str(this.manifest.entidad_reportante?.nombre, 48);

    this.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.brand });
    this.page.drawText(entidad, {
      x: MARGIN, y: PAGE_H - 22, font: this.fontBold, size: 10, color: C.white,
    });
    this.page.drawText('Informe de respuesta a supervisión', {
      x: MARGIN, y: PAGE_H - 38, font: this.font, size: 8, color: rgb(0.82, 0.88, 0.96),
    });
    this.page.drawText(this.manifest.manifiesto.solicitud, {
      x: PAGE_W - MARGIN - 100, y: PAGE_H - 28, font: this.fontBold, size: 9, color: C.white,
    });

    this.y = PAGE_H - HEADER_H - 28;
    this.drawFooter();
  }

  private drawFooter() {
    this.page.drawLine({
      start: { x: MARGIN, y: FOOTER_TOP },
      end: { x: PAGE_W - MARGIN, y: FOOTER_TOP },
      thickness: 0.5,
      color: C.line,
    });
    const left = `SAGAF · ${this.manifest.manifiesto.solicitud} · Generado ${fmtDateTime(this.manifest.manifiesto.generado)}`;
    const right = `Página ${this.pageNum}`;
    this.page.drawText(left, { x: MARGIN, y: FOOTER_TOP - 14, font: this.font, size: 7, color: C.muted });
    const rw = this.font.widthOfTextAtSize(right, 7);
    this.page.drawText(right, { x: PAGE_W - MARGIN - rw, y: FOOTER_TOP - 14, font: this.font, size: 7, color: C.muted });
    this.page.drawText(`Integridad SHA-256: ${this.hash.slice(0, 24)}…`, {
      x: MARGIN, y: FOOTER_TOP - 26, font: this.font, size: 6.5, color: C.muted,
    });
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < this.bottomLimit()) this.newContentPage();
  }

  private renderCover() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNum = 1;
    const m = this.manifest;
    const entidad = str(m.entidad_reportante?.nombre, 80);

    this.page.drawRectangle({ x: 0, y: PAGE_H - 100, width: PAGE_W, height: 100, color: C.brand });
    this.page.drawText(entidad, {
      x: MARGIN, y: PAGE_H - 48, font: this.fontBold, size: 16, color: C.white,
    });
    this.page.drawText('Sistema de Gestión de Análisis Financiero — SAGAF', {
      x: MARGIN, y: PAGE_H - 68, font: this.font, size: 9, color: rgb(0.82, 0.88, 0.96),
    });

    let y = PAGE_H - 150;
    this.page.drawText('INFORME DE RESPUESTA', {
      x: MARGIN, y, font: this.fontBold, size: 20, color: C.ink,
    });
    y -= 28;
    y = drawLines({
      page: this.page,
      font: this.fontBold,
      lines: wrapLines(this.fontBold, m.respuesta.titulo, CONTENT_W, 13),
      x: MARGIN,
      y,
      size: 13,
      color: C.inkSoft,
      lineHeight: 18,
    });

    y -= 24;
    this.page.drawRectangle({
      x: MARGIN, y: y - 118, width: CONTENT_W, height: 128,
      color: C.brandLight, borderColor: C.line, borderWidth: 1,
    });

    const boxRows: [string, string][] = [
      ['N.º de solicitud', m.manifiesto.solicitud],
      ['Fecha de generación', fmtDateTime(m.manifiesto.generado)],
      ['Organismo supervisor', m.oficio ? labelOrganismo(m.oficio.organismo) : '—'],
      ['Oficio de referencia', m.oficio?.numero ?? '—'],
      ['Plazo de respuesta', fmtDate(m.oficio?.plazo_respuesta)],
      ['Expedientes ROS incluidos', String(m.alcance.ros_incluidos)],
    ];
    let by = y - 16;
    for (const [label, value] of boxRows) {
      this.page.drawText(label, { x: MARGIN + 14, y: by, font: this.fontBold, size: 9, color: C.muted });
      this.page.drawText(str(value, 70), { x: MARGIN + 200, y: by, font: this.font, size: 10, color: C.ink });
      by -= 18;
    }

    y -= 150;
    this.page.drawText('Responsable de la entrega', {
      x: MARGIN, y, font: this.fontBold, size: 9, color: C.muted,
    });
    y -= 16;
    this.page.drawText(str(m.respuesta.responsable.nombre), {
      x: MARGIN, y, font: this.fontBold, size: 11, color: C.ink,
    });
    y -= 14;
    this.page.drawText(`${str(m.respuesta.responsable.cargo)} · ${str(m.respuesta.responsable.correo)}`, {
      x: MARGIN, y, font: this.font, size: 9, color: C.inkSoft,
    });

    this.page.drawText(
      'Documento generado electrónicamente. El manifiesto JSON adjunto contiene el detalle estructurado para auditoría.',
      { x: MARGIN, y: 72, font: this.font, size: 8, color: C.muted },
    );
  }

  private sectionTitle(title: string) {
    this.sectionNum += 1;
    const label = `${this.sectionNum}. ${title}`;
    this.ensureSpace(40);
    this.page.drawRectangle({
      x: MARGIN, y: this.y - 6, width: CONTENT_W, height: 22, color: C.brand,
    });
    this.page.drawText(label, {
      x: MARGIN + 10, y: this.y, font: this.fontBold, size: 11, color: C.white,
    });
    this.y -= 34;
  }

  private subsection(title: string) {
    this.ensureSpace(24);
    this.page.drawText(title, { x: MARGIN, y: this.y, font: this.fontBold, size: 10, color: C.brand });
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.75,
      color: C.accent,
    });
    this.y -= 16;
  }

  private infoGrid(rows: [string, string][], colLabel = 155) {
    for (const [label, value] of rows) {
      this.ensureSpace(20);
      const lines = wrapLines(this.font, str(value, 800), CONTENT_W - colLabel - 8, BODY);
      const blockH = Math.max(16, lines.length * LH_SM + 4);
      this.ensureSpace(blockH);

      this.page.drawText(label, {
        x: MARGIN, y: this.y, font: this.fontBold, size: 9, color: C.muted,
      });
      drawLines({ page: this.page, font: this.font, lines, x: MARGIN + colLabel, y: this.y, size: BODY, color: C.ink, lineHeight: LH_SM });
      this.y -= blockH + 2;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 4 },
        end: { x: PAGE_W - MARGIN, y: this.y + 4 },
        thickness: 0.25,
        color: C.lineLight,
      });
      this.y -= 6;
    }
  }

  private numberedList(items: string[]) {
    items.forEach((item, i) => {
      const prefix = `${i + 1}. `;
      const lines = wrapLines(this.font, item, CONTENT_W - 22, BODY);
      this.ensureSpace(lines.length * LH + 8);
      this.page.drawText(prefix, { x: MARGIN, y: this.y, font: this.fontBold, size: BODY, color: C.brand });
      this.y = drawLines({ page: this.page, font: this.font, lines, x: MARGIN + 18, y: this.y, size: BODY, color: C.ink, lineHeight: LH });
      this.y -= 6;
    });
    this.y -= 4;
  }

  private prose(text: string) {
    const lines = wrapLines(this.font, text, CONTENT_W, BODY);
    this.ensureSpace(lines.length * LH + 8);
    this.y = drawLines({ page: this.page, font: this.font, lines, x: MARGIN, y: this.y, size: BODY, color: C.ink, lineHeight: LH });
    this.y -= 12;
  }

  private table(columns: { label: string; width: number; align?: 'left' | 'right' }[], rows: string[][]) {
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    const scale = CONTENT_W / totalW;
    const cols = columns.map((c) => ({ ...c, width: c.width * scale }));
    let x0 = MARGIN;

    const colX = cols.map((c) => {
      const x = x0;
      x0 += c.width;
      return x;
    });

    this.ensureSpace(22);
    const headY = this.y;
    this.page.drawRectangle({
      x: MARGIN, y: headY - 4, width: CONTENT_W, height: 18, color: C.brandLight,
    });
    for (let i = 0; i < cols.length; i++) {
      this.page.drawText(cols[i].label, {
        x: colX[i] + 4, y: headY, font: this.fontBold, size: SMALL, color: C.muted,
      });
    }
    this.y -= 22;

    rows.forEach((row, ri) => {
      const cellLines = row.map((cell, i) =>
        wrapLines(this.font, str(cell, 120), cols[i].width - 8, SMALL));
      const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowH = rowLines * LH_SM + 8;
      this.ensureSpace(rowH);

      if (ri % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN, y: this.y - rowH + 10, width: CONTENT_W, height: rowH, color: C.zebra,
        });
      }

      for (let i = 0; i < cols.length; i++) {
        const lines = cellLines[i];
        let cy = this.y;
        for (const ln of lines.slice(0, 4)) {
          const tw = this.font.widthOfTextAtSize(ln, SMALL);
          const tx = cols[i].align === 'right'
            ? colX[i] + cols[i].width - tw - 4
            : colX[i] + 4;
          this.page.drawText(ln, { x: tx, y: cy, font: this.font, size: SMALL, color: C.ink });
          cy -= LH_SM;
        }
      }

      this.page.drawLine({
        start: { x: MARGIN, y: this.y - rowH + 8 },
        end: { x: PAGE_W - MARGIN, y: this.y - rowH + 8 },
        thickness: 0.3,
        color: C.lineLight,
      });
      this.y -= rowH;
    });
    this.y -= 8;
  }

  private renderExpedienteDetail(exp: PaqueteManifest['expedientes'][0], index: number) {
    const det = exp.detalle ?? {};
    this.ensureSpace(80);
    if (index > 0) this.y -= 4;

    const barH = 22;
    this.page.drawRectangle({
      x: MARGIN, y: this.y - 6, width: CONTENT_W, height: barH, color: C.brand,
    });
    this.page.drawText(`Expediente ${index + 1} de ${this.manifest.expedientes.length}`, {
      x: MARGIN + 10, y: this.y, font: this.font, size: 8, color: rgb(0.82, 0.88, 0.96),
    });
    this.page.drawText(exp.numero_ros, {
      x: MARGIN + 10, y: this.y - 10, font: this.fontBold, size: 11, color: C.white,
    });
    this.y -= barH + 12;

    this.infoGrid([
      ['Estado del ROS', labelEstadoRos(exp.estado)],
      ['Fecha de recepción', fmtDate(exp.fecha_recepcion)],
      ['Fecha de detección', fmtDate(det.fecha_deteccion as string)],
      ['Monto reportado', fmtMonto(det.monto, det.moneda)],
      ['Señal de alerta', str(det.senal_alerta, 120)],
      ['Producto / servicio', str(det.producto_servicio, 120)],
      ['Forma de pago', str(det.forma_pago, 80)],
      ['Jurisdicción', str(det.jurisdiccion, 80)],
      ['Índice documentación obligatoria', fmtPct(det.indice_documentacion_obligatoria_pct)],
    ]);

    if (det.descripcion) {
      this.subsection('Narrativa de la operación sospechosa');
      this.prose(str(det.descripcion, 1200));
    }

    const riesgo = det.clasificacion_riesgo as { nivel?: string; puntaje?: number; justificacion?: string } | null;
    if (riesgo?.nivel) {
      this.subsection('Clasificación de riesgo UAF');
      this.infoGrid([
        ['Nivel', str(riesgo.nivel)],
        ['Puntaje', riesgo.puntaje != null ? String(riesgo.puntaje) : '—'],
        ['Justificación', str(riesgo.justificacion, 400)],
      ]);
    }

    const docs = Array.isArray(det.documentos) ? det.documentos as Record<string, unknown>[] : [];
    if (docs.length > 0) {
      this.subsection(`Documentación adjunta (${docs.length})`);
      this.table(
        [
          { label: 'Documento requerido', width: 140 },
          { label: 'Archivo', width: 130 },
          { label: 'Estado', width: 70 },
          { label: 'Fecha carga', width: 72 },
        ],
        docs.map((d) => [
          str(d.documento_requerido, 60),
          str(d.nombre_archivo, 50),
          str(d.estado, 20),
          fmtDate(d.fecha_carga as string),
        ]),
      );
    }

    const partes = Array.isArray(det.partes) ? det.partes as Record<string, unknown>[] : [];
    if (partes.length > 0) {
      this.subsection(`Partes involucradas (${partes.length})`);
      this.table(
        [
          { label: 'Rol', width: 90 },
          { label: 'Tipo', width: 70 },
          { label: 'Identificador', width: 100 },
          { label: 'Nombre visible', width: 130 },
        ],
        partes.map((p) => [
          str(p.rol_en_operacion, 40),
          str(p.tipo_persona, 30),
          str(p.identificador_enmascarado, 40),
          str(p.nombre_visible, 50),
        ]),
      );
    }

    const subs = Array.isArray(det.subsanaciones) ? det.subsanaciones as Record<string, unknown>[] : [];
    if (subs.length > 0) {
      this.subsection(`Subsanaciones (${subs.length})`);
      this.table(
        [
          { label: 'Motivo', width: 160 },
          { label: 'Estado', width: 70 },
          { label: 'Solicitud', width: 72 },
          { label: 'Límite', width: 72 },
        ],
        subs.map((s) => [
          str(s.motivo, 80),
          str(s.estado, 20),
          fmtDate(s.fecha_solicitud as string),
          fmtDate(s.fecha_limite as string),
        ]),
      );
    }

    this.y -= 8;
  }

  renderAll() {
    const m = this.manifest;
    this.newContentPage();

    this.sectionTitle('Identificación del oficio');
    if (m.oficio) {
      this.infoGrid([
        ['Organismo supervisor', labelOrganismo(m.oficio.organismo)],
        ['Número de oficio', str(m.oficio.numero)],
        ['Tipo de comunicación', str(m.oficio.tipo)],
        ['Asunto', str(m.oficio.asunto)],
        ['Fecha del oficio', fmtDate(m.oficio.fecha_oficio)],
        ['Plazo de respuesta', fmtDate(m.oficio.plazo_respuesta)],
      ]);
    } else {
      this.prose('No hay oficio vinculado en el sistema.');
    }

    this.sectionTitle('Alcance y criterios de inclusión');
    const incl = m.contenido_incluido;
    const evidencias = [
      incl.documentos && 'Metadatos de documentos adjuntos',
      incl.trazabilidad && 'Trazabilidad de acciones en el sistema',
      incl.partes && 'Partes involucradas (identificadores enmascarados)',
      incl.riesgo && 'Clasificación de riesgo UAF',
      incl.subsanaciones && 'Historial de subsanaciones',
      incl.indice_cumplimiento && 'Índice de cumplimiento documental',
    ].filter(Boolean) as string[];

    this.infoGrid([
      ['Modalidad de alcance', labelAlcance(m.alcance.tipo)],
      ['Periodo de recepción ROS',
        m.alcance.tipo === 'periodo'
          ? `${fmtDate(m.alcance.fecha_desde)} al ${fmtDate(m.alcance.fecha_hasta)}`
          : 'No aplica'],
      ['Total expedientes', String(m.alcance.ros_incluidos)],
      ['Nivel de contenido', labelNivel(m.nivel_contenido)],
      ['Evidencias incluidas', evidencias.join(' · ') || '—'],
    ]);

    this.sectionTitle('Ítems del oficio atendidos');
    if (m.respuesta.items_atendidos.length > 0) {
      this.numberedList(m.respuesta.items_atendidos);
    } else {
      this.prose('No se consignaron ítems específicos.');
    }

    this.sectionTitle('Fundamento del alcance');
    this.prose(m.respuesta.fundamento_alcance ?? 'No consignado.');

    if (m.respuesta.notas_para_regulator) {
      this.sectionTitle('Notas para el regulador');
      this.prose(m.respuesta.notas_para_regulator);
    }

    this.sectionTitle('Resumen de expedientes ROS');
    this.table(
      [
        { label: 'N.º ROS', width: 108 },
        { label: 'Estado', width: 88 },
        { label: 'Recepción', width: 68 },
        { label: 'Monto', width: 88, align: 'right' },
        { label: 'Índice', width: 48, align: 'right' },
        { label: 'Riesgo', width: 56 },
        { label: 'Docs', width: 36, align: 'right' },
      ],
      m.expedientes.map((exp) => {
        const det = exp.detalle ?? {};
        const riesgo = (det.clasificacion_riesgo as { nivel?: string } | null)?.nivel;
        const docs = Array.isArray(det.documentos) ? det.documentos.length : 0;
        return [
          exp.numero_ros,
          labelEstadoRos(exp.estado),
          fmtDate(exp.fecha_recepcion),
          fmtMonto(det.monto, det.moneda),
          fmtPct(det.indice_documentacion_obligatoria_pct),
          riesgo ?? '—',
          String(docs),
        ];
      }),
    );

    this.sectionTitle('Detalle por expediente');
    this.prose(
      'A continuación se presenta la información de cada ROS incluido en el alcance, conforme al nivel de contenido seleccionado y a las evidencias marcadas en el paquete.',
    );
    m.expedientes.forEach((exp, i) => this.renderExpedienteDetail(exp, i));

    if (m.trazabilidad.length > 0) {
      this.sectionTitle('Trazabilidad de acciones (resumen)');
      this.prose(`Se registraron ${m.trazabilidad.length} eventos de auditoría sobre los expedientes incluidos. Se listan los más recientes:`);
      this.table(
        [
          { label: 'Fecha y hora', width: 100 },
          { label: 'Usuario', width: 110 },
          { label: 'Módulo', width: 56 },
          { label: 'Acción', width: 80 },
          { label: 'Recurso', width: 90 },
        ],
        m.trazabilidad.slice(0, 40).map((ev) => [
          fmtDateTime(str(ev.fecha_hora_servidor, 30)),
          str(ev.usuario_correo, 40),
          str(ev.modulo, 20),
          str(ev.accion, 30),
          str(ev.recurso_afectado, 30),
        ]),
      );
    }

    this.ensureSpace(60);
    this.subsection('Declaración');
    this.page.drawRectangle({
      x: MARGIN, y: this.y - 52, width: CONTENT_W, height: 58,
      borderColor: C.line, borderWidth: 0.75, color: C.zebra,
    });
    drawLines({
      page: this.page,
      font: this.font,
      lines: wrapLines(this.font, m.nota_legal, CONTENT_W - 24, SMALL),
      x: MARGIN + 12,
      y: this.y - 10,
      size: SMALL,
      color: C.muted,
      lineHeight: LH_SM,
    });
    this.y -= 70;
  }
}

export async function generateReportePdf(manifest: PaqueteManifest, hashSha256: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Respuesta supervisión ${manifest.manifiesto.solicitud}`);
  doc.setAuthor(manifest.respuesta.responsable.nombre ?? 'SAGAF');
  doc.setSubject(manifest.respuesta.titulo);
  doc.setCreator('SAGAF — Módulo de supervisión');

  const writer = new ReportePdfWriter(doc);
  await writer.init(manifest, hashSha256);
  writer.renderAll();

  return Buffer.from(await doc.save());
}

export function pdfPathFromJsonPath(jsonPath: string): string {
  return jsonPath.replace(/\.json$/i, '.pdf');
}

export function pdfNombreFromJsonNombre(jsonNombre: string): string {
  return jsonNombre.replace(/\.json$/i, '.pdf');
}
