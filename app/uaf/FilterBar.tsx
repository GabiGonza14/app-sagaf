'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
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
  }

  function clear() {
    setQ(''); setTipo(''); setRiesgo(''); setEstado('');
    setSector(''); setMontoMin(''); setMontoMax(''); setJurisdiccion('');
    setCompletitud(''); setFechaDesde(''); setFechaHasta(''); setOrdenar('');
    router.push('/uaf');
  }

  return (
    <form onSubmit={applyFilters} className="search-line">
      <input placeholder="Buscar ROS, entidad…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="">Todos los tipos</option>
        <option value="bank">Banco</option>
        <option value="realestate">Inmobiliaria</option>
      </select>
      <select value={sector} onChange={(e) => setSector(e.target.value)}>
        <option value="">Todos los sectores económicos</option>
        {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={riesgo} onChange={(e) => setRiesgo(e.target.value)}>
        <option value="">Cualquier riesgo</option>
        <option value="alto">Alto</option>
        <option value="medio">Medio</option>
        <option value="bajo">Bajo</option>
      </select>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="">Cualquier estado</option>
        <option value="recibido">Recibido</option>
        <option value="en_analisis">En análisis</option>
        <option value="revision_documental">Revisión documental</option>
        <option value="subsanacion">Subsanación</option>
        <option value="escalado">Escalado</option>
        <option value="vinculado">Vinculado</option>
        <option value="cerrado">Cerrado</option>
      </select>
      <input type="number" placeholder="Monto mínimo (USD)" value={montoMin} onChange={(e) => setMontoMin(e.target.value)} min={0} />
      <input type="number" placeholder="Monto máximo (USD)" value={montoMax} onChange={(e) => setMontoMax(e.target.value)} min={0} />
      <input placeholder="Jurisdicción" value={jurisdiccion} onChange={(e) => setJurisdiccion(e.target.value)} />
      <select value={completitud} onChange={(e) => setCompletitud(e.target.value)}>
        <option value="">Cualquier completitud</option>
        <option value="completo">Completo (100%)</option>
        <option value="incompleto">Incompleto</option>
        <option value="con_observados">Con observados</option>
      </select>
      <input type="date" placeholder="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
      <input type="date" placeholder="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
      <select value={ordenar} onChange={(e) => setOrdenar(e.target.value)}>
        <option value="fecha_recepcion_desc">Recibido (más reciente)</option>
        <option value="fecha_recepcion_asc">Recibido (más antiguo)</option>
        <option value="monto_desc">Monto (mayor)</option>
        <option value="monto_asc">Monto (menor)</option>
        <option value="riesgo_desc">Riesgo (alto primero)</option>
        <option value="riesgo_asc">Riesgo (bajo primero)</option>
      </select>
      <button type="submit" className="btn primary">Filtrar</button>
      <button type="button" className="btn ghost" onClick={clear}>Limpiar</button>
    </form>
  );
}
