import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtRange, money, stockInfo } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { Icon } from '../components/Icons.jsx';
import { ArrowClockwise, ArrowRight } from '@phosphor-icons/react';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

// Capped at 100%: e.g. a declined card then a retry logs consent twice for one checkout.
const pct = (a, b) => (b ? Math.min(100, (a / b) * 100) : 0);
const fmtPct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function FunnelBar({ label, value, base }) {
  const p = Math.round(pct(value, base));
  return (
    <>
      <div className="totrow"><span>{label}</span><span>{value} <span className="hint">({p}%)</span></span></div>
      <div className="bar" role="img" aria-label={`${label}: ${p}% of visits`}><i style={{ width: `${p}%` }} /></div>
    </>
  );
}

const REASONS = { damaged: 'Damaged', faulty: 'Faulty', missing_parts: 'Missing parts', wrong_item: 'Wrong item', change_of_mind: 'Change of mind' };

export default function Admin() {
  const { user, ready } = useAuth();
  useDocumentTitle('Analytics');
  const { refreshProducts } = useShop();
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
        <h1 className="serif" style={{ fontSize: 32 }}>Administrator access required</h1>
        <p className="hint">The analytics dashboard reads customer and order data, so only administrators who have signed in with 2FA can open it.</p>
        {!user && <Link className="btn" style={{ marginTop: 16, display: 'inline-block' }} to="/account">Sign in</Link>}
      </div>
    );
  }
  if (error) return <div className="error">{error.message}</div>;
  if (!data) return <p className="hint" style={{ margin: '24px 0' }}>Loading analytics…</p>;

  const m = data.metrics;
  const nextStatus = (s) => data.statuses[data.statuses.indexOf(s) + 1];

  const advance = async (o) => {
    try {
      await api(`/api/admin/orders/${o.id}/status`, { method: 'POST', body: { status: nextStatus(o.status) } });
      toast(`Order #${o.id} is now ${nextStatus(o.status)}. Customer notified.`);
      load();
    } catch (err) { toast(err.message); }
  };

  const reset = async () => {
    if (!window.confirm('Delete all orders, events, returns and customer accounts, and restore stock? Products and admins are kept.')) return;
    await api('/api/admin/reset', { method: 'POST' });
    toast('Demo data reset');
    refreshProducts();
    load();
  };

  return (
    <>
      <div className="lead"><div><h1 className="serif">Analytics &amp; database</h1><p>Live figures read from the SQLite database · Part C Web Analytics</p></div>
        <button className="link linkbtn" onClick={load}>Refresh <Icon as={ArrowClockwise} size={12} /></button></div>

      <div className="kpi">
        <div className="box"><div className="n">{m.visits}</div><div className="l">Site visits</div></div>
        <div className="box"><div className="n">{m.ordersPlaced}</div><div className="l">Orders placed</div></div>
        <div className="box"><div className="n">{money(data.revenueCents)}</div><div className="l">Revenue (demo)</div></div>
        <div className="box"><div className="n">{fmtPct(pct(m.ordersPlaced, m.visits))}</div><div className="l">Conversion rate</div></div>
        <div className="box"><div className="n">{data.returns.length}</div><div className="l">Returns / problems</div></div>
      </div>

      <div className="panel"><h2 className="ph">Conversion funnel</h2>
        <FunnelBar label="Site visits" value={m.visits} base={m.visits} />
        <FunnelBar label="Add to cart" value={m.addToCart} base={m.visits} />
        <FunnelBar label="Reached checkout" value={m.checkoutStart} base={m.visits} />
        <FunnelBar label="Consent given" value={m.consentGiven} base={m.visits} />
        <FunnelBar label="Orders placed" value={m.ordersPlaced} base={m.visits} />
        <p className="hint" style={{ marginTop: 12 }}>
          Cart abandonment: <b className="gs">{fmtPct(Math.max(0, 100 - pct(m.ordersPlaced, m.checkoutStart)))}</b>
          {' '}· Consent capture: <b className="gs">{fmtPct(pct(m.consentGiven, m.checkoutStart))}</b> of checkouts
          {' '}· Protection add-on chosen: <b className="gs">{data.protectionUptake} of {m.ordersPlaced}</b> orders
          {' '}· Combined delivery chosen: <b className="gs">{data.deliverTogether}</b>
          {' '}· Guest checkouts: <b className="gs">{data.guestOrders}</b>
        </p>
      </div>

      <div className="panel"><h2 className="ph">Orders ({data.orders.length})</h2>
        <p className="hint">Moving an order to the next status logs it on the customer's timeline and emails them automatically.</p>
        {data.orders.length ? (
          <table className="data"><thead><tr><th>Order</th><th>Email</th><th>Items</th><th>Total</th><th>To</th><th>Arriving</th><th>Payment</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>{data.orders.map((o) => (
              <tr key={o.id}><td>#{o.id}</td><td>{o.email}</td><td>{o.itemCount}</td><td>{money(o.totalCents)}</td>
                <td>{o.postcode} <span className="hint">{o.zone}</span></td><td>{fmtRange(o.estFrom, o.estTo)}</td>
                <td>{o.paymentMethod}{o.cardLast4 ? ` ···· ${o.cardLast4}` : ''}</td><td>{o.guest ? 'Guest' : 'Account'}</td>
                <td>{o.status}{nextStatus(o.status) && (
                  <button className="linkbtn" style={{ display: 'block', color: 'var(--accent-text)', fontSize: 12 }} onClick={() => advance(o)}>
                    Mark “{nextStatus(o.status)}” <Icon as={ArrowRight} size={12} />
                  </button>)}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="hint">No orders yet. Place one via checkout.</p>}
      </div>

      <div className="panel"><h2 className="ph">Returns &amp; problem reports ({data.returns.length})</h2>
        {data.returns.length ? (
          <table className="data"><thead><tr><th>Order</th><th>Email</th><th>Reason</th><th>Details</th><th>Status</th></tr></thead>
            <tbody>{data.returns.map((r) => (
              <tr key={r.id}><td>#{r.orderId}</td><td>{r.email}</td><td>{REASONS[r.reason]}</td><td>{r.details || '—'}</td><td>{r.status}</td></tr>
            ))}</tbody>
          </table>
        ) : <p className="hint">None yet. Customers can report a problem from the Track Order page.</p>}
      </div>

      {data.topProducts.length > 0 && (
        <div className="panel"><h2 className="ph">Best sellers</h2>
          <table className="data"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>{data.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.units}</td><td>{money(p.revenueCents)}</td></tr>)}</tbody>
          </table></div>
      )}

      <div className="panel"><h2 className="ph">Database · Products ({data.products.length})</h2>
        <table className="data"><thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Delivery ETA</th><th>Stock</th></tr></thead>
          <tbody>{data.products.map((p) => (
            <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.category}</td><td>{money(p.priceCents)}</td><td>{p.eta}</td>
              <td className={`stock ${stockInfo(p.stock).cls}`}>{p.stock}</td></tr>
          ))}</tbody>
        </table></div>

      <div className="panel"><h2 className="ph">Database · Customers ({data.customers.length})</h2>
        <table className="data"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Password (bcrypt hash)</th></tr></thead>
          <tbody>{data.customers.map((c) => (
            <tr key={c.id}><td>{c.id}</td><td>{c.name}</td><td>{c.email}</td><td>{c.role}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.passwordHash.slice(0, 29)}…</td></tr>
          ))}</tbody>
        </table></div>

      <button className="btn line" onClick={reset}>Reset demo data</button>
    </>
  );
}
