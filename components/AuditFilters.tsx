'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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
  const [v, setV] = useState<AuditFilterValues>(initial);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) {
      if (val) sp.set(k, val);
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function clear() {
    setV({ q: '', modulo: '', rol: '', resultado: '', criticidad: '', desde: '', hasta: '' });
    router.push(pathname);
  }

  return (
    <form onSubmit={apply} className="form-grid" style={{ marginBottom: 16 }}>
      <div className="field">
        <label htmlFor="af-q">Buscar (correo · acción · recurso · detalle)</label>
        <input id="af-q" value={v.q} onChange={(e) => setV({ ...v, q: e.target.value })} placeholder="ej: admin@uaf.gob.pa" />
      </div>
      <div className="field">
        <label htmlFor="af-modulo">Módulo</label>
        <select id="af-modulo" value={v.modulo} onChange={(e) => setV({ ...v, modulo: e.target.value })}>
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
        </select>
      </div>
      <div className="field">
        <label htmlFor="af-rol">Rol</label>
        <select id="af-rol" value={v.rol} onChange={(e) => setV({ ...v, rol: e.target.value })}>
          <option value="">Todos</option>
          <option value="sujeto_obligado">Sujeto obligado</option>
          <option value="analista">Analista</option>
          <option value="supervisor">Supervisor</option>
          <option value="auditor">Auditor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="af-resultado">Resultado</label>
        <select id="af-resultado" value={v.resultado} onChange={(e) => setV({ ...v, resultado: e.target.value })}>
          <option value="">Cualquiera</option>
          <option value="exito">Éxito</option>
          <option value="fallo">Fallo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="af-criticidad">Criticidad</label>
        <select id="af-criticidad" value={v.criticidad} onChange={(e) => setV({ ...v, criticidad: e.target.value })}>
          <option value="">Cualquiera</option>
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="af-desde">Desde</label>
        <input id="af-desde" type="date" value={v.desde} onChange={(e) => setV({ ...v, desde: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="af-hasta">Hasta</label>
        <input id="af-hasta" type="date" value={v.hasta} onChange={(e) => setV({ ...v, hasta: e.target.value })} />
      </div>
      <div className="field full" style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn primary">Aplicar filtros</button>
        <button type="button" className="btn ghost" onClick={clear}>Limpiar</button>
      </div>
    </form>
  );
}
