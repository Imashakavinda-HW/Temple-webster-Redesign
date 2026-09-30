import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { fmtRange, money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import MfaModal from '../components/MfaModal.jsx';

// Privacy centre: download your data (APP 12) or delete your account (APP 11.2).
function PrivacyCentre({ user }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const download = async () => {
    try {
      const data = await api('/api/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'my-temple-webster-data.json' });
      a.click();
      URL.revokeObjectURL(url);
      toast('Your data has been downloaded');
    } catch (err) { toast(err.message); }
  };

  const remove = async (e) => {
    e.preventDefault();
    try {
      await api('/api/account/delete', { method: 'POST', body: { password } });
      setUser(null);
      toast('Your account has been deleted');
      navigate('/');
    } catch (err) { toast(err.message); }
  };

  return (
    <div className="panel">
      <h2 className="ph">Privacy centre</h2>
      <p className="hint">You consented to our Privacy Policy when you created your account. You can see or remove your data at any time.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button className="btn ghost" onClick={download}>Download my data</button>
        {user.role !== 'admin' && !confirming && <button className="btn line" onClick={() => setConfirming(true)}>Delete my account</button>}
      </div>
      {confirming && (
        <form onSubmit={remove} style={{ maxWidth: 420 }}>
          <label htmlFor="delPass">Enter your password to confirm</label>
          <input type="password" id="delPass" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">Your login and profile are deleted immediately. Order records are kept for 5 years because Australian tax law requires it, then destroyed.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: 'var(--warn)' }}>Permanently delete</button>
            <button type="button" className="btn line" onClick={() => { setConfirming(false); setPassword(''); }}>Cancel</button>
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
        <p>Signed in as <b style={{ color: 'var(--gold-soft)' }}>{user.name}</b> · {user.email}
          {user.role === 'admin' && <> · <Link to="/analytics" style={{ color: 'var(--gold)' }}>Open analytics →</Link></>}</p>
        <h2 className="ph" style={{ marginTop: 20 }}>Order history</h2>
        {orders === null ? <p className="hint">Loading…</p> : orders.length ? (
          <table className="data">
            <thead><tr><th>Order</th><th>Total</th><th>Status</th><th>Arriving</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}><td>#{o.id}</td><td>{money(o.totalCents)}</td><td>{o.status}</td>
                <td>{o.status === 'Delivered' ? 'Delivered' : fmtRange(o.estFrom, o.estTo)}</td>
                <td><Link to={`/track?orderId=${o.id}&email=${encodeURIComponent(o.email)}`} style={{ color: 'var(--gold)' }}>Track / return</Link></td></tr>
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

function SignInOrRegister() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [login, setLogin] = useState({ email: '', password: '' });
  const [reg, setReg] = useState({ name: '', email: '', password: '', consent: false });
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setChallenge(await api('/api/auth/login', { method: 'POST', body: login })); // step 1: password
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };

  const register = async (e) => {
    e.preventDefault();
    if (!reg.name || !reg.email || !reg.password) { toast('Please fill all fields'); return; }
    if (!reg.consent) { toast('Privacy consent is required'); return; }
    setBusy(true);
    try {
      await api('/api/auth/register', { method: 'POST', body: reg });
      toast('Account created — now sign in');
      setLogin({ email: reg.email, password: '' });
      setReg({ name: '', email: '', password: '', consent: false });
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };

  const onReg = (f) => (e) => setReg((r) => ({ ...r, [f]: e.target.value }));
  const onLogin = (f) => (e) => setLogin((l) => ({ ...l, [f]: e.target.value }));

  return (
    <>
      <div className="row">
        <div className="col"><form className="panel" onSubmit={signIn}>
          <h1 className="ph">Sign in</h1>
          <label htmlFor="liEmail">Email</label>
          <input type="email" id="liEmail" placeholder="you@example.com" autoComplete="username" value={login.email} onChange={onLogin('email')} />
          <label htmlFor="liPass">Password</label>
          <input type="password" id="liPass" placeholder="••••••••" autoComplete="current-password" value={login.password} onChange={onLogin('password')} />
          <SecureBadge>Protected by multi-factor authentication.</SecureBadge>
          <button className="btn block" disabled={busy}>Sign in</button>
          <p className="hint" style={{ marginTop: 12 }}>New here? Register on the right — a 2FA step will appear when you sign in.</p>
        </form></div>

        <div className="col"><form className="panel" onSubmit={register}>
          <h2 className="ph">Create account</h2>
          <label htmlFor="regName">Full name</label>
          <input type="text" id="regName" placeholder="Jane Smith" autoComplete="name" value={reg.name} onChange={onReg('name')} />
          <label htmlFor="regEmail">Email</label>
          <input type="email" id="regEmail" placeholder="you@example.com" autoComplete="email" value={reg.email} onChange={onReg('email')} />
          <label htmlFor="regPass">Password</label>
          <input type="password" id="regPass" placeholder="At least 8 characters, not a common password" autoComplete="new-password" value={reg.password} onChange={onReg('password')} />
          <ConsentCheckbox id="regConsent" checked={reg.consent} onChange={(v) => setReg((r) => ({ ...r, consent: v }))} />
          <button className="btn block" disabled={busy}>Create account</button>
          <p className="hint" style={{ marginTop: 12 }}>Prefer not to sign up? <Link to="/" style={{ color: 'var(--gold)' }}>Shop as guest</Link> — check out &amp; track orders without an account.</p>
        </form></div>
      </div>

      {challenge && (
        <MfaModal
          challenge={challenge}
          onSuccess={(user) => { setChallenge(null); setUser(user); toast('Signed in securely'); }}
          onCancel={(msg) => { setChallenge(null); if (msg) toast(msg); }}
        />
      )}
    </>
  );
}

export default function Account() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="hint" style={{ margin: '24px 0' }}>Loading…</p>;
  return user ? <MyAccount /> : <SignInOrRegister />;
}
