import { Link, useLocation, useParams } from 'react-router-dom';
import SecureBadge from '../components/SecureBadge.jsx';
import { Icon } from '../components/Icons.jsx';
import { CheckCircle, Lifebuoy } from '@phosphor-icons/react';
import { fmtRange, money } from '../lib/format.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function Confirmation() {
  const { id } = useParams();
  useDocumentTitle('Order confirmed');
  const order = useLocation().state?.order; // passed from checkout; not re-fetched to avoid exposing orders by URL
  const trackUrl = order ? `/track?orderId=${order.id}&email=${encodeURIComponent(order.email)}` : '/track';

  return (
    <div className="panel" style={{ textAlign: 'center', maxWidth: 620, margin: '40px auto', padding: 56 }}>
      <Icon as={CheckCircle} size={64} weight="thin" style={{ color: 'var(--accent-text)' }} />
      <h1 className="serif" style={{ fontSize: 34, margin: '10px 0' }}>Thank you — order #{id} confirmed</h1>
      {order ? (
        <>
          <p className="hint">A confirmation has been sent to <b style={{ color: 'var(--emphasis)' }}>{order.email}</b>.
            We'll email you at every step, from dispatch to delivery.</p>
          <p className="pill" style={{ margin: '14px 0' }}>{order.delivery} · arrives {fmtRange(order.estFrom, order.estTo)}</p>
          {order.deliverTogether && <p className="hint">All items will arrive together in one delivery.</p>}
          <div className="totrow grand" style={{ justifyContent: 'center', gap: 12, border: 'none' }}>
            <span>Total paid</span><span>{money(order.totalCents)}</span>
          </div>
        </>
      ) : <p className="hint">Your confirmation email has the full details.</p>}
      <p className="hint">Track your order any time with just your order number and email. No account needed.</p>
      <Link className="btn ghost" style={{ display: 'inline-block', margin: '4px 0 12px' }} to={trackUrl}>Track this order</Link>
      <SecureBadge icon={Lifebuoy} style={{ justifyContent: 'center' }}>Need help? Talk to a real person: 1300 000 000 · support@templeandwebster.demo</SecureBadge>
      <Link className="btn" style={{ marginTop: 8, display: 'inline-block' }} to="/">Continue shopping</Link>
    </div>
  );
}
