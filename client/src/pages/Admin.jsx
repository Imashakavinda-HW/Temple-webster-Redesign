import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function FunnelBar({ label, value, base }) {
  const pct = base ? Math.min(100, Math.round((value / base) * 100)) : 0;
  return (
    <>
      <div className="totrow"><span>{label}</span><span>{value} <span className="hint">({pct}%)</span></span></div>
      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
    </>
  );
}

// Capped at 100%: e.g. a declined card then a retry logs consent twice for one checkout.
const pct = (a, b) => (b ? Math.min(100, (a / b) * 100).toFixed(1) : '0.0');

export default function Admin() {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api('/api/admin/analytics').then((d) => { setData(d); setError(null); }).catch(setError);
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, user, load]);

  // The API refuses non-admins (401/403) — the page just explains why.
  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 60, maxWidth: 620, margin: '40px auto' }}>
        <h2 className="serif" style={{ fontSize: 32 }}>Administrator access required</h2>
        <p className="hint">The analytics dashboard reads customer and order data, so it's restricted to administrators who have signed in with 2FA.</p>
        {!user && <Link className="btn" style={{ marginTop: 16, display: 'inline-block' }} to="/account">Sign in</Link>}
      </div>
    );
  }
  if (error) return <div className="error">{error.message}</div>;
  if (!data) return <p className="hint" style={{ margin: '24px 0' }}>Loading analytics…</p>;

  const m = data.metrics;
  const reset = async () => {
    if (!window.confirm('Delete all orders, events and customer accounts? Products and admins are kept.')) return;
    await api('/api/admin/reset', { method: 'POST' });
    toast('Demo data reset');
    load();
  };

  return (
    <>
      <div className="lead"><div><h2 className="serif">Analytics &amp; database</h2><p>Live figures read from the SQLite database · Part C Web Analytics</p></div>
        <a className="link" onClick={load}>Refresh ↻</a></div>

      <div className="kpi">
        <div className="box"><div className="n">{m.visits}</div><div className="l">Site visits</div></div>
        <div className="box"><div className="n">{m.ordersPlaced}</div><div className="l">Orders placed</div></div>
        <div className="box"><div className="n">{money(data.revenueCents)}</div><div className="l">Revenue (demo)</div></div>
        <div className="box"><div className="n">{pct(m.ordersPlaced, m.visits)}%</div><div className="l">Conversion rate</div></div>
      </div>

      <div className="panel"><h3 className="ph">Conversion funnel</h3>
        <FunnelBar label="Site visits" value={m.visits} base={m.visits} />
        <FunnelBar label="Add to cart" value={m.addToCart} base={m.visits} />
        <FunnelBar label="Reached checkout" value={m.checkoutStart} base={m.visits} />
        <FunnelBar label="Consent given" value={m.consentGiven} base={m.visits} />
        <FunnelBar label="Orders placed" value={m.ordersPlaced} base={m.visits} />
        <p className="hint" style={{ marginTop: 12 }}>
          Cart-abandonment: <b style={{ color: 'var(--gold-soft)' }}>{m.checkoutStart ? Math.max(0, Math.round(((m.checkoutStart - m.ordersPlaced) / m.checkoutStart) * 100)) : 0}%</b>
          {' '}· Consent-capture: <b style={{ color: 'var(--gold-soft)' }}>{pct(m.consentGiven, m.checkoutStart).replace('.0', '')}%</b> of checkouts
          {' '}· Protection add-on opted in: <b style={{ color: 'var(--gold-soft)' }}>{data.protectionUptake} of {m.ordersPlaced}</b> orders.
        </p>
      </div>

      {data.topProducts.length > 0 && (
        <div className="panel"><h3 className="ph">Best sellers</h3>
          <table className="data"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{data.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenueCents)}</td></tr>)}</tbody>
          </table></div>
      )}

      <div className="panel"><h3 className="ph">Database · Products ({data.products.length})</h3>
        <table className="data"><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Delivery ETA</th></tr></thead>
          <tbody>{data.products.map((p) => (
            <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.category}</td><td>{money(p.priceCents)}</td><td>{p.eta}</td></tr>
          ))}</tbody>
        </table></div>

      <div className="panel"><h3 className="ph">Database · Customers ({data.customers.length})</h3>
        <table className="data"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Password (bcrypt hash)</th></tr></thead>
          <tbody>{data.customers.map((c) => (
            <tr key={c.id}><td>{c.id}</td><td>{c.name}</td><td>{c.email}</td><td>{c.role}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.passwordHash.slice(0, 29)}…</td></tr>
          ))}</tbody>
        </table></div>

      <div className="panel"><h3 className="ph">Database · Orders ({data.orders.length})</h3>
        {data.orders.length ? (
          <table className="data"><thead><tr><th>Order</th><th>Email</th><th>Items</th><th>Total</th><th>Delivery</th><th>Payment</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>{data.orders.map((o) => (
              <tr key={o.id}><td>#{o.id}</td><td>{o.email}</td><td>{o.itemCount}</td><td>{money(o.totalCents)}</td><td>{o.delivery}</td>
                <td>{o.paymentMethod}{o.cardLast4 ? ` ···· ${o.cardLast4}` : ''}</td><td>{o.guest ? 'Guest' : 'Account'}</td><td>{o.status}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="hint">No orders yet — place one via checkout.</p>}
      </div>

      <button className="btn line" onClick={reset}>Reset demo data</button>
    </>
  );
}
