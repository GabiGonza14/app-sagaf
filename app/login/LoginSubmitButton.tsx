'use client';
import { useFormStatus } from 'react-dom';

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="btn primary"
      disabled={pending}
      style={{
        width: '100%',
        justifyContent: 'center',
        marginTop: 12,
        minHeight: 48,
        fontSize: 15,
      }}
    >  {pending ? 'Verificando credenciales…' : 'Continuar con MFA'}
    </button>
  );
}
