import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import MfaModal from '../components/MfaModal.jsx';

function MyAccount() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);

  useEffect(() => { api('/api/orders/mine').then((d) => setOrders(d.orders)).catch(() => setOrders([])); }, []);

  return (
    <>
      <div className="lead"><h2 className="serif">My account</h2></div>
      <div className="panel">
        <p>Signed in as <b style={{ color: 'var(--gold-soft)' }}>{user.name}</b> · {user.email}
          {user.role === 'admin' && <> · <Link to="/analytics" style={{ color: 'var(--gold)' }}>Open analytics →</Link></>}</p>
        <h3 className="ph" style={{ marginTop: 20 }}>Order history</h3>
        {orders === null ? <p className="hint">Loading…</p> : orders.length ? (
          <table className="data">
            <thead><tr><th>Order</th><th>Total</th><th>Status</th><th>Delivery</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}><td>#{o.id}</td><td>{money(o.totalCents)}</td><td>{o.status}</td><td>{o.delivery}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="hint">No orders yet.</p>}
        <button className="btn line" style={{ marginTop: 20 }}
                onClick={async () => { await logout(); toast('Signed out'); navigate('/'); }}>Sign out</button>
      </div>
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
          <h3 className="ph">Sign in</h3>
          <label htmlFor="liEmail">Email</label>
          <input type="email" id="liEmail" placeholder="you@example.com" autoComplete="username" value={login.email} onChange={onLogin('email')} />
          <label htmlFor="liPass">Password</label>
          <input type="password" id="liPass" placeholder="••••••••" autoComplete="current-password" value={login.password} onChange={onLogin('password')} />
          <SecureBadge>Protected by multi-factor authentication.</SecureBadge>
          <button className="btn block" disabled={busy}>Sign in</button>
          <p className="hint" style={{ marginTop: 12 }}>New here? Register on the right — a 2FA step will appear when you sign in.</p>
        </form></div>

        <div className="col"><form className="panel" onSubmit={register}>
          <h3 className="ph">Create account</h3>
          <label htmlFor="regName">Full name</label>
          <input type="text" id="regName" placeholder="Jane Smith" autoComplete="name" value={reg.name} onChange={onReg('name')} />
          <label htmlFor="regEmail">Email</label>
          <input type="email" id="regEmail" placeholder="you@example.com" autoComplete="email" value={reg.email} onChange={onReg('email')} />
          <label htmlFor="regPass">Password</label>
          <input type="password" id="regPass" placeholder="At least 8 characters" autoComplete="new-password" value={reg.password} onChange={onReg('password')} />
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
