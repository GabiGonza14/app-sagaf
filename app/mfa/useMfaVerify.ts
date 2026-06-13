'use client';
import { useState } from 'react';

export function useMfaVerify() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(codeArg?: string): Promise<boolean> {
    const token = codeArg ?? code;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Código inválido');
        return false;
      }
      return true;
    } finally {
      setLoading(false);
    }
  }

  return { code, setCode, loading, error, verify };
}
