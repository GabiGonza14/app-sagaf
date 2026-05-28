// POST /api/personas/verify — RF-06: SOLO retorna {found, nombre}.
// NUNCA expone dirección, teléfono, actividad económica, etc. en el portal público.
// (Previene DEF-09 de la matriz de defectos.)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { verifyPublic } from '@/lib/persons';
import { audit, extractRequestContext } from '@/lib/audit';

const schema = z.object({
  identificador: z.string().min(3).max(60),
  // PB-04: se agrega 'vendedor' al contexto para soportar operaciones inmobiliarias completas
  contexto: z.enum(['ordenante', 'beneficiario', 'comprador', 'vendedor', 'cliente']).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 });
  }

  const ctx = extractRequestContext(req);
  const result = verifyPublic(parsed.data.identificador);

  audit({
    modulo: 'ros',
    accion: 'verificar_identidad',
    resultado: 'exito',
    usuario_id: session.user.id,
    usuario_correo: session.user.email,
    rol: session.user.rol,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
    detalle: {
      identificador_enmascarado: `***${parsed.data.identificador.slice(-3)}`,
      contexto: parsed.data.contexto ?? 'cliente',
      found: result.found,
    },
  });

  // IMPORTANTE: solo se devuelve nombre. NUNCA datos sensibles.
  return NextResponse.json({ found: result.found, nombre: result.nombre ?? null });
}
