import { useState } from 'react';
import { api } from '../lib/api.js';
import SecureBadge from './SecureBadge.jsx';

// Second login step. `challenge` comes from POST /api/auth/login.
export default function MfaModal({ challenge, onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div className="modal show" role="dialog" aria-modal="true" aria-labelledby="mfaTitle">
      <form className="panel" onSubmit={verify}>
        <h3 className="ph" id="mfaTitle">Two-Factor Verification</h3>
        <p className="hint">
          For your security, we've sent a 6-digit code to your email. It expires in 5 minutes.
          {challenge.demoCode && <> <span style={{ color: 'var(--gold)' }}>(Demo code: {challenge.demoCode})</span></>}
        </p>
        <label htmlFor="mfaCode">Verification code</label>
        <input type="text" id="mfaCode" placeholder="• • • • • •" maxLength={6} inputMode="numeric"
               autoComplete="one-time-code" autoFocus value={code}
               onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
               style={{ letterSpacing: '.4em', textAlign: 'center', fontSize: 18 }} />
        {error && <div className="error">{error}</div>}
        <SecureBadge>Multi-factor authentication protects your account from unauthorised access.</SecureBadge>
        <button className="btn block" disabled={busy || code.length !== 6}>Verify &amp; Sign In</button>
        <button type="button" className="btn line block" style={{ marginTop: 10 }} onClick={() => onCancel()}>Cancel</button>
      </form>
    </div>
  );
}
