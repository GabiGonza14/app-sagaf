'use client';
import CustomSelect from '@/components/CustomSelect';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tipo: string;
  sector: string;
  estado: string;
  fd: string;
  fh: string;
}

export function ReportesFilterForm({ tipo: initTipo, sector: initSector, estado: initEstado, fd: initFd, fh: initFh }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState(initTipo);
  const [sector, setSector] = useState(initSector);
  const [estado, setEstado] = useState(initEstado);
  const [fd, setFd] = useState(initFd);
  const [fh, setFh] = useState(initFh);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (tipo)   sp.set('tipo', tipo);
    if (sector) sp.set('sector', sector);
    if (estado) sp.set('estado', estado);
    if (fd)     sp.set('fecha_desde', fd);
    if (fh)     sp.set('fecha_hasta', fh);
    router.push(`/uaf/reportes?${sp.toString()}`);
  }

  return (
    <form onSubmit={apply} className="card" style={{ padding: 16 }}>
      <div className="form-grid" style={{ gap: 10 }}>
        <div className="field">
          <label>Tipo de reporte</label>
          <CustomSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="operativo">Operativo</option>
            <option value="documental">Documental</option>
            <option value="estadistico">Estadístico</option>
            <option value="inteligencia">Inteligencia financiera</option>
          </CustomSelect>
        </div>
        <div className="field">
          <label>Sector</label>
          <CustomSelect value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Todos</option>
            <option value="financiero">Financiero</option>
            <option value="no_financiero">No financiero</option>
            <option value="actividad_profesional">Actividad profesional</option>
          </CustomSelect>
        </div>
        <div className="field">
          <label>Estado del ROS</label>
          <CustomSelect value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="recibido">Recibido</option>
            <option value="en_analisis">En análisis</option>
            <option value="revision_documental">Revisión documental</option>
            <option value="subsanacion">Subsanación</option>
            <option value="escalado">Escalado</option>
            <option value="vinculado">Vinculado</option>
            <option value="cerrado">Cerrado</option>
          </CustomSelect>
        </div>
        <div className="field">
          <label>Desde</label>
          <input type="date" value={fd} onChange={(e) => setFd(e.target.value)} />
        </div>
        <div className="field">
          <label>Hasta</label>
          <input type="date" value={fh} onChange={(e) => setFh(e.target.value)} />
        </div>
      </div>
    </form>
  );
}
