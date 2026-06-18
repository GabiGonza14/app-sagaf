'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        style={{ ...(props.style || {}), paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: 'absolute',
          right: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: '#94a3b8',
          lineHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        tabIndex={-1}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
  );
}
