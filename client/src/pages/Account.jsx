import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { fmtRange, money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import MfaModal from '../components/MfaModal.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { FieldError, Req, errorProps } from '../components/FormBits.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

// Privacy centre: download your data (APP 12) or delete your account (APP 11.2).
function PrivacyCentre({ user }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [delError, setDelError] = useState('');
  const [busy, setBusy] = useState('');

  const download = async () => {
    setBusy('download');
    try {
      const data = await api('/api/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'my-temple-webster-data.json' });
      a.click();
      URL.revokeObjectURL(url);
      toast('Your data has been downloaded');
    } catch (err) { toast(err.message); } finally { setBusy(''); }
  };

  const remove = async (e) => {
    e.preventDefault();
    if (!password) { setDelError('Enter your password to confirm'); document.getElementById('delPass').focus(); return; }
    setBusy('delete');
    setDelError('');
    try {
      await api('/api/account/delete', { method: 'POST', body: { password } });
      setUser(null);
      toast('Your account has been deleted');
      navigate('/');
    } catch (err) {
      setDelError(err.message);
      document.getElementById('delPass').focus();
    } finally { setBusy(''); }
  };

  return (
    <div className="panel">
      <h2 className="ph">Privacy centre</h2>
      <p className="hint">You consented to our Privacy Policy when you created your account. You can see or remove your data at any time.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button className="btn ghost" onClick={download} disabled={busy === 'download'}>{busy === 'download' ? 'Preparing…' : 'Download my data'}</button>
        {user.role !== 'admin' && !confirming && <button className="btn line" onClick={() => setConfirming(true)}>Delete my account</button>}
      </div>
      {confirming && (
        <form onSubmit={remove} style={{ maxWidth: 420 }} noValidate>
          <label htmlFor="delPass">Enter your password to confirm<Req /></label>
          <PasswordInput id="delPass" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                         invalid={!!delError} describedBy={delError ? 'delPass-error' : undefined} />
          <FieldError id="delPass-error" message={delError} />
          <p className="hint">Your login and profile are deleted immediately. Order records are kept for 5 years because Australian tax law requires it, then destroyed.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn danger" disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Permanently delete'}</button>
            <button type="button" className="btn line" onClick={() => { setConfirming(false); setPassword(''); setDelError(''); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function MyAccount() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => { api('/api/orders/mine').then((d) => setOrders(d.orders)).catch(() => setOrders([])); }, []);

  return (
    <>
      <div className="lead"><h1 className="serif">My account</h1></div>
      <div className="panel">
        <p>Signed in as <b style={{ color: 'var(--emphasis)' }}>{user.name}</b> · {user.email}
          {user.role === 'admin' && <> · <Link to="/analytics" style={{ color: 'var(--accent-text)' }}>Open analytics</Link></>}</p>
        <h2 className="ph" style={{ marginTop: 20 }}>Order history</h2>
        {orders === null ? <p className="hint">Loading…</p> : orders.length ? (
          <table className="data">
            <thead><tr><th>Order</th><th>Total</th><th>Status</th><th>Arriving</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}><td>#{o.id}</td><td>{money(o.totalCents)}</td><td>{o.status}</td>
                <td>{o.status === 'Delivered' ? 'Delivered' : fmtRange(o.estFrom, o.estTo)}</td>
                <td><Link to={`/track?orderId=${o.id}&email=${encodeURIComponent(o.email)}`} style={{ color: 'var(--accent-text)' }}>Track / return</Link></td></tr>
            ))}</tbody>
          </table>
        ) : <p className="hint">No orders yet.</p>}
        <button className="btn line" style={{ marginTop: 20 }}
                onClick={async () => { await logout(); toast('Signed out'); navigate('/'); }}>Sign out</button>
      </div>
      <PrivacyCentre user={user} />
    </>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignInOrRegister() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({ name: '', email: '', password: '', consent: false });
  const [loginErrors, setLoginErrors] = useState({});
  const [regErrors, setRegErrors] = useState({});
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState('');
  const loginPassRef = useRef(null);

  const signIn = async (e) => {
    e.preventDefault();
    const errs = {
      liEmail: !login.email.trim() ? 'Enter your email address' : '',
      liPass: !login.password ? 'Enter your password' : '',
    };
    setLoginErrors(errs);
    if (errs.liEmail || errs.liPass) { document.getElementById(errs.liEmail ? 'liEmail' : 'liPass').focus(); return; }
    setBusy('login');
    try {
      setChallenge(await api('/api/auth/login', { method: 'POST', body: login })); // step 1: password
    } catch (err) {
      setLoginErrors({ form: err.message });
    } finally { setBusy(''); }
  };

  const register = async (e) => {
    e.preventDefault();
    const errs = {
      regName: !reg.name.trim() ? 'Enter your full name' : '',
      regEmail: !EMAIL_RE.test(reg.email.trim()) ? 'Enter an email address like jane@example.com' : '',
      regPass: reg.password.length < 8 ? 'Use at least 8 characters' : '',
      regConsent: !reg.consent ? 'Tick the box to agree to the Privacy Policy' : '',
    };
    setRegErrors(errs);
    const first = Object.keys(errs).find((k) => errs[k]);
    if (first) { document.getElementById(first).focus(); return; }
    setBusy('register');
    try {
      await api('/api/auth/register', { method: 'POST', body: reg });
      toast('Account created — now sign in');
      setLogin({ email: reg.email, password: '' });
      setReg({ name: '', email: '', password: '', consent: false });
      loginPassRef.current?.focus(); // continue straight to signing in
    } catch (err) {
      // Put the server's message next to the field it's about.
      const field = err.status === 409 ? 'regEmail' : /password/i.test(err.message) ? 'regPass' : /consent/i.test(err.message) ? 'regConsent' : 'form';
      setRegErrors({ [field]: err.message });
      if (field !== 'form') document.getElementById(field).focus();
    } finally { setBusy(''); }
  };

  const onReg = (f) => (e) => { setReg((r) => ({ ...r, [f]: e.target.value })); };
  const onLogin = (f) => (e) => { setLogin((l) => ({ ...l, [f]: e.target.value })); };

  return (
    <>
      <div className="row">
        <div className="col"><form className="panel" onSubmit={signIn} noValidate>
          <h1 className="ph">Sign in</h1>
          <p className="hint">Fields marked <span className="req">*</span> are required.</p>
          <label htmlFor="liEmail">Email<Req /></label>
          <input type="email" id="liEmail" placeholder="you@example.com" autoComplete="username" aria-required="true"
                 value={login.email} onChange={onLogin('email')} {...errorProps(loginErrors, 'liEmail')} />
          <FieldError id="liEmail-error" message={loginErrors.liEmail} />
          <label htmlFor="liPass">Password<Req /></label>
          <PasswordInput id="liPass" value={login.password} onChange={onLogin('password')} autoComplete="current-password"
                         placeholder="••••••••" invalid={!!loginErrors.liPass} describedBy={loginErrors.liPass ? 'liPass-error' : undefined}
                         inputRef={loginPassRef} />
          <FieldError id="liPass-error" message={loginErrors.liPass} />
          {loginErrors.form && <div className="error" role="alert">{loginErrors.form}</div>}
          <SecureBadge>Protected by multi-factor authentication.</SecureBadge>
          <button className="btn block" disabled={!!busy}>{busy === 'login' ? 'Signing in…' : 'Sign in'}</button>
          <p className="hint" style={{ marginTop: 12 }}>New here? Create an account. A 2-step verification code appears when you sign in.</p>
        </form></div>

        <div className="col"><form className="panel" onSubmit={register} noValidate>
          <h2 className="ph">Create account</h2>
          <label htmlFor="regName">Full name<Req /></label>
          <input type="text" id="regName" placeholder="Jane Smith" autoComplete="name" aria-required="true"
                 value={reg.name} onChange={onReg('name')} {...errorProps(regErrors, 'regName')} />
          <FieldError id="regName-error" message={regErrors.regName} />
          <label htmlFor="regEmail">Email<Req /></label>
          <input type="email" id="regEmail" placeholder="you@example.com" autoComplete="email" aria-required="true"
                 value={reg.email} onChange={onReg('email')} {...errorProps(regErrors, 'regEmail')} />
          <FieldError id="regEmail-error" message={regErrors.regEmail} />
          <label htmlFor="regPass">Password<Req /></label>
          <PasswordInput id="regPass" value={reg.password} onChange={onReg('password')} autoComplete="new-password"
                         invalid={!!regErrors.regPass} describedBy={regErrors.regPass ? 'regPass-error regPass-help' : 'regPass-help'} />
          <div className="hint" id="regPass-help">At least 8 characters. Common or leaked passwords are refused.</div>
          <FieldError id="regPass-error" message={regErrors.regPass} />
          <ConsentCheckbox id="regConsent" checked={reg.consent} onChange={(v) => setReg((r) => ({ ...r, consent: v }))}
                           invalid={!!regErrors.regConsent} />
          <FieldError id="regConsent-error" message={regErrors.regConsent} />
          {regErrors.form && <div className="error" role="alert">{regErrors.form}</div>}
          <button className="btn block" disabled={!!busy} style={{ marginTop: 16 }}>{busy === 'register' ? 'Creating account…' : 'Create account'}</button>
          <p className="hint" style={{ marginTop: 12 }}>Prefer not to sign up? <Link to="/" style={{ color: 'var(--accent-text)' }}>Shop as guest</Link> — check out &amp; track orders without an account.</p>
        </form></div>
      </div>

      {challenge && (
        <MfaModal
          challenge={challenge}
          onSuccess={(user) => { setChallenge(null); setUser(user); toast('Signed in securely'); }}
          onCancel={(msg) => { setChallenge(null); if (msg) setLoginErrors({ form: msg }); }}
        />
      )}
    </>
  );
}

export default function Account() {
  const { user, ready } = useAuth();
  useDocumentTitle(user ? 'My account' : 'Sign in or create an account');
  if (!ready) return <p className="hint" style={{ margin: '24px 0' }}>Loading…</p>;
  return user ? <MyAccount /> : <SignInOrRegister />;
}
