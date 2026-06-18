'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordInput } from '@/components/PasswordInput';
import CustomSelect from '@/components/CustomSelect';
import { SuccessModal } from '@/components/SuccessModal';

interface Props {
  sujetos: Array<{ id: string; nombre: string }>;
  roles: Array<{ id: string; nombre: string }>;
}

export function NuevoUsuarioForm({ sujetos, roles }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const defaultRol = roles.find((r) => r.nombre === 'analista') ?? roles[0];
  const [rolId, setRolId] = useState(defaultRol?.id ?? '');
  const [sujetoId, setSujetoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState(false);

  const rolName = roles.find((r) => r.id === rolId)?.nombre;
  const requiresSujeto = rolName === 'sujeto_obligado';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiresSujeto && !sujetoId) {
      setError('Un usuario con rol "sujeto_obligado" debe estar asociado a una entidad.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, correo, password, rol_id: rolId,
          sujeto_obligado_id: requiresSujeto ? sujetoId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error creando usuario.'); return; }
      setNombre(''); setCorreo(''); setPassword(''); setSujetoId('');
      setSuccessModal(true);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
    <SuccessModal
      isOpen={successModal}
      title="Usuario creado"
      message="El nuevo usuario fue registrado correctamente en el sistema."
      onClose={() => setSuccessModal(false)}
    />
    <form onSubmit={onSubmit}>
      <div className="form-grid">
        <div className="field">
          <label>Nombre completo</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="field">
          <label>Correo institucional</label>
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </div>
        <div className="field">
          <label>Contraseña inicial</label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label>Rol</label>
          <CustomSelect value={rolId} onChange={(e) => setRolId(e.target.value)} required>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </CustomSelect>
        </div>
        {requiresSujeto && (
          <div className="field full">
            <label>Sujeto obligado asociado</label>
            <CustomSelect value={sujetoId} onChange={(e) => setSujetoId(e.target.value)} required>
              <option value="">— seleccione —</option>
              {sujetos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </CustomSelect>
          </div>
        )}
        {error && <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>}
        <div className="field full">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </form>
    </>
  );
}
