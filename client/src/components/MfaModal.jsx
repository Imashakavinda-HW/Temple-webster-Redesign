import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import SecureBadge from './SecureBadge.jsx';

// Second login step. `challenge` comes from POST /api/auth/login.
// Accessibility: focus moves into the dialog, Tab stays inside it (focus trap), Escape
// cancels, and focus returns to the button that opened it when it closes.
export default function MfaModal({ challenge, onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const panel = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    return () => { if (opener instanceof HTMLElement) opener.focus(); };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { onCancel(); return; }
    if (e.key !== 'Tab') return;
    const focusable = panel.current.querySelectorAll('input, button:not([disabled])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api('/api/auth/mfa/verify', {
        method: 'POST', body: { challengeId: challenge.challengeId, code },
      });
      onSuccess(user);
    } catch (err) {
      if (err.data?.restart) onCancel(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal show" role="dialog" aria-modal="true" aria-labelledby="mfaTitle" aria-describedby="mfaDesc" onKeyDown={onKeyDown}>
      <form className="panel" onSubmit={verify} ref={panel}>
        <h2 className="ph" id="mfaTitle">Two-Factor Verification</h2>
        <p className="hint" id="mfaDesc">
          For your security, we've sent a 6-digit code to your email. It expires in 5 minutes.
          {challenge.demoCode && <> <span style={{ color: 'var(--accent-text)' }}>(Demo code: {challenge.demoCode})</span></>}
        </p>
        <label htmlFor="mfaCode">Verification code</label>
        <input type="text" id="mfaCode" placeholder="• • • • • •" maxLength={6} inputMode="numeric"
               autoComplete="one-time-code" autoFocus value={code} aria-invalid={error ? true : undefined}
               aria-describedby={error ? 'mfaError' : undefined}
               onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
               style={{ letterSpacing: '.4em', textAlign: 'center', fontSize: 18 }} />
        {error && <div className="error" id="mfaError" role="alert">{error}</div>}
        <SecureBadge>Multi-factor authentication protects your account from unauthorised access.</SecureBadge>
        <button className="btn block" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify & Sign In'}</button>
        <button type="button" className="btn line block" style={{ marginTop: 10 }} onClick={() => onCancel()}>Cancel</button>
      </form>
    </div>
  );
}
