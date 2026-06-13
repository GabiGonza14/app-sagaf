'use client';
import { useEffect, useState } from 'react';
import { useMfaVerify } from '../useMfaVerify';

export function MfaSetupClient() {
  const [qr, setQr] = useState<string | null>(null);
  const { code, setCode, loading, error, verify } = useMfaVerify();

  useEffect(() => {
    console.log('[CLIENT] MFA Setup — useEffect iniciado, solicitando QR...');
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/mfa/setup', { method: 'POST' });
      console.log('[CLIENT] MFA Setup — Respuesta HTTP status:', res.status);
      const data = await res.json();
      console.log('[CLIENT] MFA Setup — Data recibida:', data);
      if (!cancelled && res.ok) {
        setQr(data.qr);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    console.log('[CLIENT] MFA Setup Confirm — Submit iniciado, código:', code);
    const ok = await verify(code);
    console.log(ok ? '[CLIENT] MFA Setup Confirm — OK, redirigiendo a /' : '[CLIENT] MFA Setup Confirm — Error');
    if (ok) globalThis.location.href = '/';
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr', alignItems: 'start' }}>
        <div className="qr-box">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Código QR para enrolamiento MFA" width={240} height={240} />
          ) : (
            <div style={{ padding: 24, color: '#667085' }}>Generando QR…</div>
          )}
        </div>
      </div>

      <form onSubmit={onConfirm} style={{ marginTop: 18 }}>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="code">Código generado por tu autenticador</label>
            <input
              id="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="code-input"
              placeholder="000000"
              required
            />
          </div>
          {error && (
            <div className="client-status error" style={{ gridColumn: '1 / -1' }}>{error}</div>
          )}
          <div className="field full">
            <button className="btn primary" disabled={loading || code.length !== 6} style={{ width: '100%' }}>
              {loading ? 'Verificando…' : 'Confirmar y entrar'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
