'use client';
import { useFormStatus } from 'react-dom';

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn primary" type="submit" disabled={pending} style={{ width: '100%' }}>
      {pending ? 'Verificando credenciales…' : 'Continuar con MFA'}
    </button>
  );
}
