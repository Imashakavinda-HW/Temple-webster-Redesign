import { Link, useLocation, useParams } from 'react-router-dom';
import SecureBadge from '../components/SecureBadge.jsx';
import { money } from '../lib/format.js';

export default function Confirmation() {
  const { id } = useParams();
  const order = useLocation().state?.order; // passed from checkout; not re-fetched to avoid exposing orders by URL

  return (
    <div className="panel" style={{ textAlign: 'center', maxWidth: 620, margin: '40px auto', padding: 56 }}>
      <div style={{ fontSize: 56 }}>✓</div>
      <h2 className="serif" style={{ fontSize: 34, margin: '10px 0' }}>Thank you — order #{id} confirmed</h2>
      {order ? (
        <>
          <p className="hint">A confirmation has been sent to <b style={{ color: 'var(--gold-soft)' }}>{order.email}</b>.</p>
          <p className="pill" style={{ margin: '14px 0' }}>{order.delivery}</p>
          <div className="totrow grand" style={{ justifyContent: 'center', gap: 12, border: 'none' }}>
            <span>Total paid</span><span>{money(order.totalCents)}</span>
          </div>
        </>
      ) : <p className="hint">Your confirmation email has the full details.</p>}
      <p className="hint">Track your order any time — no account required, just your order number and email.{' '}
        <Link to="/track" style={{ color: 'var(--gold)' }}>Track order →</Link></p>
      <SecureBadge icon="🛟" style={{ justifyContent: 'center' }}>Need help? Our after-sales team: support@templeandwebster.demo · 1300 000 000</SecureBadge>
      <Link className="btn" style={{ marginTop: 8, display: 'inline-block' }} to="/">Continue shopping</Link>
    </div>
  );
}
