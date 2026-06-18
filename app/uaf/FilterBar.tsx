'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Filter, SlidersHorizontal, ChevronDown } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

interface Props {
  initial: {
    q: string; tipo: string; riesgo: string; estado: string;
    sector: string; montoMin: string; montoMax: string; jurisdiccion: string;
    completitud: string; fechaDesde: string; fechaHasta: string; ordenar: string;
  };
  sectores: string[];
}

interface RosSuggestion {
  id: string;
  numero_ros: string;
  sujeto_nombre: string;
  estado: string;
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

  const [suggestions, setSuggestions] = useState<RosSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
    setSuggestions([]);
    setShowDropdown(false);
    router.push('/uaf');
  }

  // Autocomplete debounce
  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ros/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results ?? []);
          setShowDropdown((data.results ?? []).length > 0);
        }
      } catch {
        // Silenciar errores de red
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelectSuggestion(s: RosSuggestion) {
    setShowDropdown(false);
    setSuggestions([]);
    router.push(`/uaf/ros/${s.id}`);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      setShowDropdown(false);
      applyFilters();
    }
  }

  const hasActiveFilters =
    q || tipo || riesgo || estado || sector || montoMin || montoMax ||
    jurisdiccion || completitud || fechaDesde || fechaHasta || ordenar;

  return (
    <div className="filter-bar">
      {/* Búsqueda principal con autocomplete */}
      <div className="filter-search-row">
        <div className="filter-search-wrapper" ref={dropdownRef}>
          <div className="filter-search-input-wrap">
            <Search size={16} className="filter-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar ROS, entidad…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => q.trim().length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
              className="filter-search-input"
            />
            {q && (
              <button type="button" className="filter-clear-btn" onClick={() => { setQ(''); setSuggestions([]); setShowDropdown(false); searchRef.current?.focus(); }}>
                <X size={14} />
              </button>
            )}
            {loading && <span className="filter-loading" />}
          </div>

          {showDropdown && (
            <div className="filter-dropdown">
              {suggestions.length === 0 ? (
                <div className="filter-dropdown-empty">Sin coincidencias</div>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="filter-dropdown-item"
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <div className="filter-dropdown-item-main">
                      <span className="filter-dropdown-ros">{s.numero_ros}</span>
                      <span className="filter-dropdown-entity">{s.sujeto_nombre}</span>
                    </div>
                    <span className={`filter-dropdown-status ${s.estado}`}>{s.estado.replace('_', ' ')}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="filter-actions">
          <button type="button" className="btn primary" onClick={applyFilters}>
            <Filter size={16} />
            Filtrar
          </button>
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
          {hasActiveFilters && (
            <button type="button" className="btn ghost" onClick={clear}>
              <X size={16} />
              Limpiar
            </button>
          )}
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
              {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <label className="filter-label">Monto mínimo (USD)</label>
            <input type="number" placeholder="0" value={montoMin} onChange={(e) => setMontoMin(e.target.value)} min={0} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Monto máximo (USD)</label>
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
            <label className="filter-label">&nbsp;</label>
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
