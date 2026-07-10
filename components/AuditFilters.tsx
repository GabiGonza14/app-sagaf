'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

export interface AuditFilterValues {
  q: string;
  modulo: string;
  rol: string;
  resultado: string;
  criticidad: string;
  desde: string;
  hasta: string;
}

interface Props {
  initial: AuditFilterValues;
  modulosDisponibles?: string[];
}

const MODULO_LABEL: Record<string, string> = {
  autenticacion: 'Autenticación',
  ros:           'ROS',
  admin:         'Administración',
  documentos:    'Documentos',
  reportes:      'Reportes',
  vinculos:      'Vínculos',
  auditoria:     'Auditoría',
  system:        'Sistema',
};

export function AuditFilters({ initial, modulosDisponibles }: Readonly<Props>) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(initial.q);
  const [modulo, setModulo] = useState(initial.modulo);
  const [rol, setRol] = useState(initial.rol);
  const [resultado, setResultado] = useState(initial.resultado);
  const [criticidad, setCriticidad] = useState(initial.criticidad);
  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const initialMount = useRef(true);

  const buildQuery = useCallback(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (modulo) sp.set('modulo', modulo);
    if (rol) sp.set('rol', rol);
    if (resultado) sp.set('resultado', resultado);
    if (criticidad) sp.set('criticidad', criticidad);
    if (desde) sp.set('desde', desde);
    if (hasta) sp.set('hasta', hasta);
    return sp;
  }, [q, modulo, rol, resultado, criticidad, desde, hasta]);

  const navigate = useCallback(() => {
    const sp = buildQuery();
    router.push(`${pathname}?${sp.toString()}`);
  }, [buildQuery, router, pathname]);

  const clear = useCallback(() => {
    setQ(''); setModulo(''); setRol(''); setResultado('');
    setCriticidad(''); setDesde(''); setHasta('');
    router.push(pathname);
  }, [router, pathname]);

  useEffect(() => {
    if (initialMount.current) { initialMount.current = false; return; }
    const timer = setTimeout(() => navigate(), 400);
    return () => clearTimeout(timer);
  }, [q, modulo, rol, resultado, criticidad, desde, hasta, navigate]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') navigate();
  }

  const hasActiveFilters = modulo || rol || resultado || criticidad || desde || hasta;

  return (
    <div className="filter-bar">
      <div className="filter-search-row">
        <div className="filter-search-wrapper">
          <div className="filter-search-input-wrap">
            <Search size={16} className="filter-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por correo, acción, recurso, detalle…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
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
          {(q || hasActiveFilters) && (
            <button type="button" className="btn ghost" onClick={clear}>
              <X size={16} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label">Módulo</label>
            <CustomSelect value={modulo} onChange={(e) => setModulo(e.target.value)}>
              <option value="">Todos</option>
              {modulosDisponibles
                ? modulosDisponibles.map((m) => (
                    <option key={m} value={m}>{MODULO_LABEL[m] ?? m}</option>
                  ))
                : (
                  <>
                    <option value="autenticacion">Autenticación</option>
                    <option value="ros">ROS</option>
                    <option value="documentos">Documentos</option>
                    <option value="admin">Administración</option>
                    <option value="auditoria">Auditoría</option>
                    <option value="system">Sistema</option>
                  </>
                )}
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Rol</label>
            <CustomSelect value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos</option>
              <option value="sujeto_obligado">Sujeto obligado</option>
              <option value="analista">Analista</option>
              <option value="supervisor">Supervisor</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Resultado</label>
            <CustomSelect value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="exito">Éxito</option>
              <option value="fallo">Fallo</option>
              <option value="bloqueado">Bloqueado</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Criticidad</label>
            <CustomSelect value={criticidad} onChange={(e) => setCriticidad(e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </CustomSelect>
          </div>

          <div className="filter-group">
            <label className="filter-label">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>

          <div className="filter-group">
            <label className="filter-label">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
