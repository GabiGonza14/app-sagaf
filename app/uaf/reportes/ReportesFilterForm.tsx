'use client';
import { useState } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
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
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = !!(tipo || sector || estado || fd || fh);

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

  function clear() {
    setTipo(''); setSector(''); setEstado(''); setFd(''); setFh('');
    router.push('/uaf/reportes');
  }

  return (
    <div className="filter-bar">
      <div className="filter-actions">
        <button
          type="button"
          className={`btn ghost filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {hasActiveFilters && <span className="filter-badge-dot" />}
          <ChevronDown size={14} className={showFilters ? 'rotate-180' : ''} />
        </button>
      </div>

      {showFilters && (
        <form onSubmit={apply} className="filter-grid" style={{ marginTop: 12 }}>
          <div className="filter-group">
            <label className="filter-label">Tipo de reporte</label>
            <CustomSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="operativo">Operativo</option>
              <option value="documental">Documental</option>
              <option value="estadistico">Estadístico</option>
              <option value="inteligencia">Inteligencia financiera</option>
            </CustomSelect>
          </div>
          <div className="filter-group">
            <label className="filter-label">Sector</label>
            <CustomSelect value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">Todos</option>
              <option value="financiero">Financiero</option>
              <option value="no_financiero">No financiero</option>
              <option value="actividad_profesional">Actividad profesional</option>
            </CustomSelect>
          </div>
          <div className="filter-group">
            <label className="filter-label">Estado del ROS</label>
            <CustomSelect value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="recibido">Recibido</option>
              <option value="en_analisis">En análisis</option>
              <option value="en_revision_vinculo">En revisión de vínculo</option>
              <option value="revision_documental">Revisión documental</option>
              <option value="subsanacion">Subsanación</option>
              <option value="riesgo_clasificado">Riesgo clasificado</option>
              <option value="cerrado">Cerrado</option>
            </CustomSelect>
          </div>
          <div className="filter-group">
            <label className="filter-label">Desde</label>
            <input type="date" value={fd} onChange={(e) => setFd(e.target.value)} />
          </div>
          <div className="filter-group">
            <label className="filter-label">Hasta</label>
            <input type="date" value={fh} onChange={(e) => setFh(e.target.value)} />
          </div>
          <div className="filter-group filter-group-actions">
            <div className="filter-group-actions-row">
              <button type="submit" className="btn primary">Aplicar filtros</button>
              <button type="button" className="btn ghost" onClick={clear}>Limpiar todo</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
