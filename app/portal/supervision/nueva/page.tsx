import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { SupervisionForm } from './SupervisionForm';
import { FEATURES } from '@/lib/features';

export default function NuevaSupervisionPage() {
  if (!FEATURES.SUPERVISION_SO) redirect('/portal');

  return (
    <>
      <TopBar
        eyebrow="Atención a supervisión"
        title="Registrar comunicación de supervisión"
        description="Suba el oficio recibido (SBP, ISRNNF u otro). El sistema extraerá texto con OCR para facilitar el registro. Los modelos referenciales están en la documentación del proyecto."
      />
      <SupervisionForm />
      <p className="small" style={{ marginTop: 12 }}>
        <Link href="/portal/supervision">← Volver a supervisión</Link>
      </p>
    </>
  );
}
