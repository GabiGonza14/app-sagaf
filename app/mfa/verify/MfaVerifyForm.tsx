'use client';
import { useState } from 'react';

interface Props {
  readonly qr: string | null;
}

export function MfaVerifyForm({ qr }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[CLIENT] MFA Verify — Submit iniciado, código:', code);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      console.log('[CLIENT] MFA Verify — Respuesta HTTP status:', res.status);
      const data = await res.json();
      console.log('[CLIENT] MFA Verify — Data recibida:', data);
      if (!res.ok) {
        console.log('[CLIENT] MFA Verify — Error:', data.error ?? 'Código inválido');
        setError(data.error ?? 'Código inválido');
        return;
      }
      console.log('[CLIENT] MFA Verify — OK, redirigiendo a /');
      // El JWT ya fue actualizado por /api/mfa/verify con mfaVerified=true
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr', alignItems: 'start' }}>
        {qr && (
          <div className="qr-box">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR para MFA" width={240} height={240} />
          </div>
        )}


      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="code">Código de 6 dígitos</label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="code-input"
              placeholder="000000"
              autoFocus
              required
            />
          </div>
          {error && (
            <div className="client-status error" style={{ gridColumn: '1 / -1' }}>
              {error}
            </div>
          )}
          <div className="field full">
            <button className="btn primary" type="submit" disabled={loading || code.length !== 6} style={{ width: '100%' }}>
              {loading ? 'Verificando…' : 'Validar acceso'}
            </button>
          </div>
        </div>

        <div className="notice" style={{ marginTop: 14, fontSize: 12.5 }}>
          El código rota cada 30 segundos. Si tu dispositivo no está sincronizado con la hora correcta, podría fallar.
        </div>
      </form>
    </>
  );
}
