// lib/supervision/aplicar-alcance.ts — Une parse OCR + catálogo → campos del formulario de paquete
import { sugerenciaPaquete, type SugerenciaPaquete } from './catalogo';
import { labelTipoComunicacion } from './constants';
import type { OficioParse } from './parse-oficio';

export interface ComunicacionContext {
  numero_oficio?: string | null;
  asunto?: string | null;
  fecha_limite_respuesta?: string | null;
  fecha_oficio?: string | null;
  organismo?: string;
}

export interface AlcanceFormSugerido {
  alcance_tipo: 'periodo' | 'lista_ros' | 'muestra';
  fecha_desde?: string;
  fecha_hasta?: string;
  lista_ros?: string[];
  tamano_muestra?: number;
  nivel_contenido: SugerenciaPaquete['nivel_contenido'];
  items_solicitados: string[];
  fundamento_alcance?: string;
  notas_regulatorio?: string;
  incluir_documentos: boolean;
  incluir_log: boolean;
  incluir_partes: boolean;
  incluir_riesgo: boolean;
  incluir_subsanaciones: boolean;
  incluir_indice_cumplimiento: boolean;
}

function fallbackPeriodoDesdeOficio(fechaOficio?: string | null): { desde: string; hasta: string } | undefined {
  if (!fechaOficio) return undefined;
  const iso = fechaOficio.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const year = iso.slice(0, 4);
  return { desde: `${year}-01-01`, hasta: iso };
}

function buildFundamento(
  alcance_tipo: AlcanceFormSugerido['alcance_tipo'],
  parse: OficioParse,
  cat: SugerenciaPaquete,
  tipoComunicacion: string,
  ctx?: ComunicacionContext,
): string {
  const ros = parse.lista_ros ?? [];
  if (parse.periodo) {
    return `El oficio solicita información de ROS recibidos entre ${parse.periodo.desde} y ${parse.periodo.hasta}. Este paquete limita los expedientes a ese rango de fechas de recepción en SAGAF.`;
  }
  if (ros.length > 0) {
    return `El oficio cita expedientes específicos (${ros.join(', ')}). El paquete incluye únicamente esos ROS y la evidencia asociada en el sistema.`;
  }
  if (alcance_tipo === 'muestra') {
    return `Muestra representativa de ROS según ${labelTipoComunicacion(tipoComunicacion)}. ${cat.resumen}`;
  }
  if (alcance_tipo === 'periodo' && ctx?.fecha_oficio) {
    const fb = fallbackPeriodoDesdeOficio(ctx.fecha_oficio);
    if (fb) {
      return `Requerimiento de tipo «${labelTipoComunicacion(tipoComunicacion)}». Se incluyen ROS recibidos desde ${fb.desde} hasta ${fb.hasta} (periodo sugerido según fecha del oficio; ajústelo si el PDF indica otro rango).`;
    }
  }
  return `${cat.resumen} Alcance definido para atender el oficio${ctx?.numero_oficio ? ` ${ctx.numero_oficio}` : ''}.`;
}

function buildNotas(ctx?: ComunicacionContext): string | undefined {
  if (!ctx?.numero_oficio) return undefined;
  const partes = [
    `Entrega en respuesta al oficio ${ctx.numero_oficio}.`,
  ];
  if (ctx.fecha_limite_respuesta) {
    partes.push(`Plazo de respuesta: ${ctx.fecha_limite_respuesta.slice(0, 10)}.`);
  }
  if (ctx.asunto) {
    partes.push(`Referencia: ${ctx.asunto.slice(0, 160)}.`);
  }
  partes.push('Documentación complementaria fuera de SAGAF se anexa por el canal formal del regulador.');
  return partes.join(' ');
}

export function aplicarAlcanceDesdeOficio(
  parse: OficioParse,
  tipoComunicacion: string,
  soTipo: string,
  ctx?: ComunicacionContext,
): AlcanceFormSugerido {
  const cat = sugerenciaPaquete(tipoComunicacion, soTipo);
  const ros = parse.lista_ros ?? [];

  let alcance_tipo = cat.alcance_tipo;
  if (ros.length > 0) alcance_tipo = 'lista_ros';
  else if (parse.periodo?.desde && parse.periodo?.hasta) alcance_tipo = 'periodo';

  const items = [
    ...(parse.items_solicitados ?? []),
    ...cat.items.filter((i) => !(parse.items_solicitados ?? []).some((p) => p.includes(i.slice(0, 20)))),
  ];

  let fecha_desde = parse.periodo?.desde;
  let fecha_hasta = parse.periodo?.hasta;
  if (alcance_tipo === 'periodo' && !fecha_desde) {
    const fb = fallbackPeriodoDesdeOficio(ctx?.fecha_oficio);
    if (fb) {
      fecha_desde = fb.desde;
      fecha_hasta = fb.hasta;
    }
  }

  return {
    alcance_tipo,
    fecha_desde,
    fecha_hasta,
    lista_ros: ros.length > 0 ? ros : undefined,
    tamano_muestra: cat.tamano_muestra,
    nivel_contenido: cat.nivel_contenido,
    items_solicitados: items,
    fundamento_alcance: buildFundamento(alcance_tipo, parse, cat, tipoComunicacion, ctx),
    notas_regulatorio: buildNotas(ctx),
    incluir_documentos: cat.incluir_documentos,
    incluir_log: cat.incluir_log,
    incluir_partes: cat.incluir_partes,
    incluir_riesgo: cat.incluir_riesgo,
    incluir_subsanaciones: cat.incluir_subsanaciones,
    incluir_indice_cumplimiento: cat.incluir_indice_cumplimiento,
  };
}
