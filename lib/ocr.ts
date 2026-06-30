// lib/ocr.ts — Extracción de texto + OCR real (RF-07)
//
// Pipeline por tipo de archivo:
//   PDF con capa de texto → pdfjs getTextContent (rápido, sin OCR)
//   PDF escaneado         → pdfjs renderiza páginas a PNG → Tesseract.js
//   JPG / PNG             → Tesseract.js directamente
//
// Se usa pdfjs-dist (NO pdf-parse) para leer la capa de texto: pdf-parse@1.x
// no entiende los object streams de PDFs modernos (los que genera pdf-lib y
// muchos PDFs reales) y lanzaba "Invalid PDF structure", forzando siempre el OCR.
//
// El worker de pdfjs se resuelve por ruta absoluta desde process.cwd(): bajo el
// bundle de Next.js, `await import('module').createRequire` NO existe (módulo
// shimmed por webpack), por eso la versión anterior fallaba con
// "createRequire is not a function".

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// ── Preprocesado para OCR ─────────────────────────────────────────────────────
// Documentos reales (cédulas) tienen fondos de seguridad (guilloché, hologramas)
// que Tesseract no vence: el texto se pierde entre las líneas finas del fondo.
// La técnica que sí funciona es SUSTRACCIÓN DE FONDO: se estima el fondo con un
// desenfoque grande (box blur) y se resta del gris original, dejando solo el
// texto sobre un gris uniforme. Verificado: pasa de 0 a 10/11 palabras leídas.

// Box blur separable (radio r) sobre un plano de grises Float32.
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / win;
      const xo = Math.max(0, x - r), xn = Math.min(w - 1, x + r + 1);
      acc += src[y * w + xn] - src[y * w + xo];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      const yo = Math.max(0, y - r), yn = Math.min(h - 1, y + r + 1);
      acc += tmp[yn * w + x] - tmp[yo * w + x];
    }
  }
  return out;
}

// Reescala a ~2000px de ancho, pasa a grises y resta el fondo.
async function preprocessForOcr(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const img = await loadImage(imageBuffer);
    const targetW = 2000;
    const scale = img.width > 0 ? targetW / img.width : 1;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(w, h);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = canvas.getContext('2d') as any;
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data as Uint8ClampedArray;

    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    const r = Math.max(10, Math.round(w / 90)); // ~22px @2000 → quita el guilloché
    const bg = boxBlur(gray, w, h, r);
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
      let v = 128 + (gray[p] - bg[p]);
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
    return canvas.toBuffer('image/png');
  } catch (e) {
    // Si el preprocesado falla, OCR sobre el original (mejor que romper).
    console.error('[OCR] preprocesado falló, uso original:', (e as Error).message);
    return imageBuffer;
  }
}

// ── Tesseract OCR ─────────────────────────────────────────────────────────────
let _worker: import('tesseract.js').Worker | null = null;
let _workerBusy = false;

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!_worker) {
    const { createWorker } = await import('tesseract.js');
    _worker = await createWorker(['spa', 'eng']);
    console.log('[OCR] Tesseract worker inicializado (spa+eng)');
  }
  return _worker;
}

async function runTesseract(imageBuffer: Buffer): Promise<string> {
  const img = await preprocessForOcr(imageBuffer);
  if (_workerBusy) {
    const { createWorker } = await import('tesseract.js');
    const tmp = await createWorker(['spa', 'eng']);
    try {
      const { data } = await tmp.recognize(img);
      return data.text ?? '';
    } finally {
      await tmp.terminate();
    }
  }
  _workerBusy = true;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(img);
    return data.text ?? '';
  } catch (e) {
    _worker = null;
    throw e;
  } finally {
    _workerBusy = false;
  }
}

// ── pdfjs ─────────────────────────────────────────────────────────────────────
let _workerSrcSet = false;

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!_workerSrcSet) {
    // Resolver el worker SIN createRequire (no disponible en el bundle de Next.js).
    const candidates = [
      join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
      join(process.cwd(), 'public', 'pdf.worker.min.mjs'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(p).href;
        console.log('[OCR] pdfjs workerSrc =', p);
        break;
      }
    }
    _workerSrcSet = true;
  }
  return pdfjsLib;
}

// Lee un PDF: primero intenta la capa de texto; si no hay, renderiza a PNG y OCR.
// `source` distingue extracción confiable ('text-layer') de OCR ('ocr'): el OCR
// de fotos/escaneos reales es ruidoso, así que el caller NO debe hacer un match
// estricto de palabras clave sobre texto OCR (genera falsos positivos).
type PdfExtract = { text: string; source: 'text-layer' | 'ocr' };

async function extractFromPdf(pdfBuffer: Buffer): Promise<PdfExtract> {
  const pdfjsLib = await loadPdfjs();
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
  }).promise;

  // Capa 1: texto embebido (PDF digital) — rápido, sin OCR
  const textPages = Math.min(pdfDoc.numPages, 8);
  let layerText = '';
  for (let i = 1; i <= textPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    layerText += content.items
      .map((it) => (it as { str?: string }).str ?? '')
      .join(' ') + '\n';
  }
  if (layerText.replace(/\s/g, '').length > 10) {
    console.log('[OCR] pdfjs capa de texto:', JSON.stringify(layerText.slice(0, 120)));
    return { text: layerText.trim(), source: 'text-layer' };
  }

  // Capa 2: PDF escaneado → render a PNG → Tesseract
  console.log('[OCR] PDF sin capa de texto → render + Tesseract');
  const { createCanvas } = await import('@napi-rs/canvas');
  const numPages = Math.min(pdfDoc.numPages, 3);
  let ocrText = '';
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = canvas.getContext('2d') as any;
    // pdfjs v6 tipa `canvas` como obligatorio, pero en Node basta `canvasContext`
    // (verificado en runtime). Cast laxo para no alterar la llamada que sí funciona.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: context, viewport } as any).promise;
    const png = canvas.toBuffer('image/png');
    const pageText = await runTesseract(png);
    console.log(`[OCR] Pág ${i} Tesseract: "${pageText.slice(0, 80).replace(/\n/g, ' ')}"`);
    ocrText += ' ' + pageText;
  }
  return { text: ocrText.trim(), source: 'ocr' };
}

// ── API pública ───────────────────────────────────────────────────────────────
// `source` indica de dónde vino el texto: 'text-layer' (capa de texto del PDF,
// extracción fiable) u 'ocr' (Tesseract sobre imagen/escaneo, texto ruidoso).
export type ExtractResult =
  | { status: 'ok';    text: string; source: 'text-layer' | 'ocr' }
  | { status: 'empty'; text: '';     source: 'none' }
  | { status: 'error'; text: '';     source: 'none' };

export async function extractText(buffer: Buffer, mime: string): Promise<ExtractResult> {

  // Imágenes → Tesseract directo
  if (mime === 'image/jpeg' || mime === 'image/png') {
    try {
      console.log('[OCR] Imagen → Tesseract');
      const text = await runTesseract(buffer);
      console.log('[OCR] Resultado:', JSON.stringify(text.slice(0, 120)));
      return text.trim().length > 5
        ? { status: 'ok', text, source: 'ocr' }
        : { status: 'empty', text: '', source: 'none' };
    } catch (e) {
      console.error('[OCR] Tesseract imagen falló:', e);
      return { status: 'error', text: '', source: 'none' };
    }
  }

  if (mime !== 'application/pdf') return { status: 'ok', text: '', source: 'text-layer' };

  // PDF: capa de texto (pdfjs) y, si no hay, OCR sobre páginas renderizadas
  try {
    const { text, source } = await extractFromPdf(buffer);
    return text.length > 5
      ? { status: 'ok', text, source }
      : { status: 'empty', text: '', source: 'none' };
  } catch (e) {
    // El PDF no se pudo abrir/parsear: fail-open (status 'error' → sin advertencia)
    console.error('[OCR] extractFromPdf falló:', (e as Error).message);
    return { status: 'error', text: '', source: 'none' };
  }
}
