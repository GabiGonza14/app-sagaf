// lib/supervision/auth.ts — Guardas de sesión para APIs de supervisión
import { auth } from '@/auth';
import { FEATURES } from '@/lib/features';

export type SupervisionSession = {
  user: {
    id: string;
    email: string;
    rol: string;
    sujetoObligadoId: string;
  };
};

export async function requireSupervisionSo(): Promise<
  { ok: true; session: SupervisionSession } | { ok: false; status: number; error: string }
> {
  if (!FEATURES.SUPERVISION_SO) {
    return { ok: false, status: 404, error: 'Módulo no disponible' };
  }
  const session = await auth();
  if (!session?.user) {
    return { ok: false, status: 401, error: 'No autenticado' };
  }
  if (session.user.rol !== 'sujeto_obligado') {
    return { ok: false, status: 403, error: 'No autorizado' };
  }
  const soId = session.user.sujetoObligadoId;
  if (!soId) {
    return { ok: false, status: 400, error: 'Sin entidad' };
  }
  return {
    ok: true,
    session: {
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        rol: session.user.rol,
        sujetoObligadoId: soId,
      },
    },
  };
}
