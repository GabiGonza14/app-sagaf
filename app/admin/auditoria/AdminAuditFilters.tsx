'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';

interface Props {
  initial: {
    accion: string;
    resultado: string;
    desde: string;
    hasta: string;
  };
}

export function AdminAuditFilters({ initial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState(initial);
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = v.accion || v.resultado || v.desde || v.hasta;

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (v.accion)    sp.set('accion', v.accion);
    if (v.resultado) sp.set('resultado', v.resultado);
    if (v.desde)     sp.set('desde', v.desde);
    if (v.hasta)     sp.set('hasta', v.hasta);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function clear() {
    setV({ accion: '', resultado: '', desde: '', hasta: '' });
    router.push(pathname);
  }

  return (
    <div className="filter-bar" style={{ marginBottom: 18 }}>
      <div className="filter-search-row">
        <div className="filter-actions" style={{ marginLeft: 'auto' }}>
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

      {showFilters && (
        <form onSubmit={apply} className="filter-grid" style={{ marginTop: 12 }}>
          <div className="filter-group">
            <label className="filter-label" htmlFor="aa-accion">Acción</label>
            <select id="aa-accion" value={v.accion} onChange={(e) => setV({ ...v, accion: e.target.value })}>
              <option value="">Todas</option>
              <option value="sujeto">Sujetos obligados</option>
              <option value="plantilla">Plantillas ROS</option>
              <option value="usuario">Usuarios y roles</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="aa-resultado">Resultado</label>
            <select id="aa-resultado" value={v.resultado} onChange={(e) => setV({ ...v, resultado: e.target.value })}>
              <option value="">Cualquiera</option>
              <option value="exito">Éxito</option>
              <option value="fallo">Fallo</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="aa-desde">Desde</label>
            <input id="aa-desde" type="date" value={v.desde} onChange={(e) => setV({ ...v, desde: e.target.value })} />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="aa-hasta">Hasta</label>
            <input id="aa-hasta" type="date" value={v.hasta} onChange={(e) => setV({ ...v, hasta: e.target.value })} />
          </div>

          <div className="filter-group-actions">
            <div className="filter-group-actions-row">
              <button type="submit" className="btn primary" style={{ padding: '8px 16px', minHeight: 38, fontSize: 12 }}>
                Aplicar filtros
              </button>
              <button type="button" className="btn ghost" style={{ padding: '8px 16px', minHeight: 38, fontSize: 12 }} onClick={clear}>
                Limpiar
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
