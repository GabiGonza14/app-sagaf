import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { TopBar } from '@/components/TopBar';
import { SupervisionForm } from './SupervisionForm';
import { FEATURES } from '@/lib/features';

export default async function NuevaSupervisionPage() {
  if (!FEATURES.SUPERVISION_SO) redirect('/portal');

  const session = await getSession();
  const soId = session!.user.sujetoObligadoId!;
  const so = db.prepare<[string], { tipo: string }>(
    'SELECT tipo FROM sujeto_obligado WHERE id = ?',
  ).get(soId);

  return (
    <>
      <TopBar
        eyebrow="Atención a supervisión"
        title="Registrar comunicación de supervisión"
        description="Suba el oficio (PDF). El OCR prellena número, fechas, tipo y periodo. Revise antes de registrar."
      />
      <SupervisionForm soTipo={so?.tipo ?? 'bank'} />
      <p className="small" style={{ marginTop: 12 }}>
        <Link href="/portal/supervision">← Volver a supervisión</Link>
      </p>
    </>
  );
}
