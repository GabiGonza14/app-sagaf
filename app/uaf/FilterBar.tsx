'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

function formatSector(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
import { useRouter } from 'next/navigation';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

interface Props {
  initial: {
    q: string; tipo: string; riesgo: string; estado: string;
    sector: string; montoMin: string; montoMax: string; jurisdiccion: string;
    completitud: string; fechaDesde: string; fechaHasta: string; ordenar: string;
  };
  sectores: string[];
}

export function FilterBar({ initial, sectores }: Readonly<Props>) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [tipo, setTipo] = useState(initial.tipo);
  const [riesgo, setRiesgo] = useState(initial.riesgo);
  const [estado, setEstado] = useState(initial.estado);
  const [sector, setSector] = useState(initial.sector);
  const [montoMin, setMontoMin] = useState(initial.montoMin);
  const [montoMax, setMontoMax] = useState(initial.montoMax);
  const [jurisdiccion, setJurisdiccion] = useState(initial.jurisdiccion);
  const [completitud, setCompletitud] = useState(initial.completitud);
  const [fechaDesde, setFechaDesde] = useState(initial.fechaDesde);
  const [fechaHasta, setFechaHasta] = useState(initial.fechaHasta);
  const [ordenar, setOrdenar] = useState(initial.ordenar);

  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const buildQuery = useCallback(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (tipo) sp.set('tipo', tipo);
    if (riesgo) sp.set('riesgo', riesgo);
    if (estado) sp.set('estado', estado);
    if (sector) sp.set('sector', sector);
    if (montoMin) sp.set('montoMin', montoMin);
    if (montoMax) sp.set('montoMax', montoMax);
    if (jurisdiccion) sp.set('jurisdiccion', jurisdiccion);
    if (completitud) sp.set('completitud', completitud);
    if (fechaDesde) sp.set('fechaDesde', fechaDesde);
    if (fechaHasta) sp.set('fechaHasta', fechaHasta);
    if (ordenar) sp.set('ordenar', ordenar);
    return sp;
  }, [q, tipo, riesgo, estado, sector, montoMin, montoMax, jurisdiccion, completitud, fechaDesde, fechaHasta, ordenar]);

  function applyFilters() {
    const sp = buildQuery();
    router.push(`/uaf?${sp.toString()}`);
  }

  function clear() {
    setQ(''); setTipo(''); setRiesgo(''); setEstado('');
    setSector(''); setMontoMin(''); setMontoMax(''); setJurisdiccion('');
    setCompletitud(''); setFechaDesde(''); setFechaHasta(''); setOrdenar('');
    router.push('/uaf');
  }

  // Auto-filtrar la lista al escribir en el campo de búsqueda (debounce 350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (tipo) sp.set('tipo', tipo);
      if (riesgo) sp.set('riesgo', riesgo);
      if (estado) sp.set('estado', estado);
      if (sector) sp.set('sector', sector);
      if (montoMin) sp.set('montoMin', montoMin);
      if (montoMax) sp.set('montoMax', montoMax);
      if (jurisdiccion) sp.set('jurisdiccion', jurisdiccion);
      if (completitud) sp.set('completitud', completitud);
      if (fechaDesde) sp.set('fechaDesde', fechaDesde);
      if (fechaHasta) sp.set('fechaHasta', fechaHasta);
      if (ordenar) sp.set('ordenar', ordenar);
      router.push(`/uaf?${sp.toString()}`);
    }, 350);
    return () => clearTimeout(timer);
  // Solo reacciona a cambios en q para el auto-filtrado; los otros filtros usan "Aplicar filtros"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasActiveFilters =
    q || tipo || riesgo || estado || sector || montoMin || montoMax ||
    jurisdiccion || completitud || fechaDesde || fechaHasta || ordenar;

  return (
    <div className="filter-bar">
      <div className="filter-search-row">
        <div className="filter-search-wrapper">
          <div className="filter-search-input-wrap">
            <Search size={16} className="filter-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar ROS, entidad…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="filter-search-input"
            />
            {q && (
              <button type="button" className="filter-clear-btn" onClick={() => { setQ(''); searchRef.current?.focus(); }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

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
      </div>

      {/* Filtros secundarios */}
      {showFilters && (
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label">Tipo de entidad</label>
            <CustomSelect value={tipo} onChange={(e) => { setTipo(e.target.value); }}>
              <option value="">Todos los tipos</option>
              <option value="bank">Banco</option>
              <option value="realestate">Inmobiliaria</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Sector económico</label>
            <CustomSelect value={sector} onChange={(e) => { setSector(e.target.value); }}>
              <option value="">Todos los sectores</option>
              {sectores.map((s) => <option key={s} value={s}>{formatSector(s)}</option>)}
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Riesgo</label>
            <CustomSelect value={riesgo} onChange={(e) => { setRiesgo(e.target.value); }}>
              <option value="">Cualquier riesgo</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="bajo">Bajo</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Estado</label>
            <CustomSelect value={estado} onChange={(e) => { setEstado(e.target.value); }}>
              <option value="">Cualquier estado</option>
              <option value="recibido">Recibido</option>
              <option value="en_analisis">En análisis</option>
              <option value="revision_documental">Revisión documental</option>
              <option value="subsanacion">Subsanación</option>
              <option value="escalado">Escalado</option>
              <option value="vinculado">Vinculado</option>
              <option value="cerrado">Cerrado</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Monto mínimo ($)</label>
            <input type="number" placeholder="0" value={montoMin} onChange={(e) => setMontoMin(e.target.value)} min={0} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Monto máximo ($)</label>
            <input type="number" placeholder="Sin límite" value={montoMax} onChange={(e) => setMontoMax(e.target.value)} min={0} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Jurisdicción</label>
            <input placeholder="Ej. Panamá" value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Completitud</label>
            <CustomSelect value={completitud} onChange={(e) => { setCompletitud(e.target.value); }}>
              <option value="">Cualquier completitud</option>
              <option value="completo">Completo (100%)</option>
              <option value="incompleto">Incompleto</option>
              <option value="con_observados">Con observados</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Fecha desde</label>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Fecha hasta</label>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Ordenar por</label>
            <CustomSelect value={ordenar} onChange={(e) => { setOrdenar(e.target.value); }}>
              <option value="fecha_recepcion_desc">Recibido (más reciente)</option>
              <option value="fecha_recepcion_asc">Recibido (más antiguo)</option>
              <option value="monto_desc">Monto (mayor)</option>
              <option value="monto_asc">Monto (menor)</option>
              <option value="riesgo_desc">Riesgo (alto primero)</option>
              <option value="riesgo_asc">Riesgo (bajo primero)</option>
            </CustomSelect>
          </div>

          <div className="filter-group filter-group-actions">
            <div className="filter-group-actions-row">
              <button type="button" className="btn primary" onClick={applyFilters}>
                Aplicar filtros
              </button>
              <button type="button" className="btn ghost" onClick={clear}>
                Limpiar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
