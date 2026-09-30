import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtRange, money } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Icon } from '../components/Icons.jsx';
import { FieldError, Req } from '../components/FormBits.jsx';
import { Lifebuoy } from '@phosphor-icons/react';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

const REASONS = {
  damaged: 'Arrived damaged',
  faulty: 'Faulty or not working',
  missing_parts: 'Missing parts',
  wrong_item: 'Wrong item delivered',
  change_of_mind: 'Changed my mind',
};

const when = (sqlDate) => new Date(`${sqlDate.replace(' ', 'T')}Z`)
  .toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Timeline({ order }) {
  const reached = order.steps.indexOf(order.status);
  return (
    <ol className="timeline" aria-label="Delivery progress">
      {order.steps.map((step, i) => {
        const entry = order.history.find((h) => h.status === step);
        return (
          <li key={step} className={i <= reached ? 'done' : ''} aria-current={i === reached ? 'step' : undefined}>
            <b>{step}</b>
            {entry ? <div className="hint">{when(entry.at)} · {entry.note}</div>
              : i === order.steps.length - 1 ? <div className="hint">Estimated {fmtRange(order.estFrom, order.estTo)}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ReturnForm({ order, email, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) { setError('Choose what happened so we can offer the right remedy'); document.getElementById('rtReason').focus(); return; }
    setBusy(true);
    setError('');
    try {
      await api(`/api/orders/${order.id}/returns`, { method: 'POST', body: { email, reason, details } });
      toast('Request received — we’ll email you shortly');
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 10 }} noValidate>
      <label htmlFor="rtReason">What happened?<Req /></label>
      <select id="rtReason" value={reason} onChange={(e) => setReason(e.target.value)} aria-required="true"
              {...(error ? { 'aria-invalid': true, 'aria-describedby': 'rtReason-error' } : {})}>
        <option value="">Choose a reason…</option>
        {Object.entries(REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <FieldError id="rtReason-error" message={error} />
      <label htmlFor="rtDetails">Details (optional)</label>
      <textarea id="rtDetails" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. The left leg of the table was cracked on arrival." />
      <button className="btn ghost block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
    </form>
  );
}

// Order tracking with a full status timeline, for guests and customers alike.
export default function Track() {
  const [params] = useSearchParams();
  useDocumentTitle('Track your order');
  const [orderId, setOrderId] = useState(params.get('orderId') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [showReturn, setShowReturn] = useState(false);

  const lookup = useCallback(async (id, mail) => {
    setError('');
    try {
      const qs = new URLSearchParams({ orderId: String(id).replace('#', '').trim(), email: mail });
      setOrder((await api(`/api/orders/track?${qs}`)).order);
    } catch (err) { setOrder(null); setError(err.message); }
  }, []);

  // Links from the confirmation page and account page arrive pre-filled.
  useEffect(() => { if (params.get('orderId')) lookup(params.get('orderId'), params.get('email') || ''); }, [params, lookup]);

  const openReturn = order?.returns.find((r) => r.status === 'Requested');

  return (
    <>
      <div className="lead"><div><h1 className="serif">Track your order</h1><p>No account needed. Just your order number and email.</p></div></div>
      <div className="row">
        <form className="panel col" style={{ maxWidth: 440 }} onSubmit={(e) => { e.preventDefault(); lookup(orderId, email); }}>
          <label htmlFor="trId">Order number</label>
          <input type="text" id="trId" placeholder="1001" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <label htmlFor="trEmail">Email used at checkout</label>
          <input type="email" id="trEmail" placeholder="jane@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn block" style={{ marginTop: 20 }}>Find my order</button>
          {error && <div className="error" role="alert">{error}</div>}
        </form>

        {order && (
          <div className="panel col" aria-live="polite">
            <h2 className="ph">Order #{order.id}</h2>
            <p className="hint">{order.items.map((i) => `${i.name} ×${i.qty}`).join(' · ')}</p>
            <p className="pill" style={{ margin: '8px 0 16px' }}>
              {order.status === 'Delivered' ? 'Delivered' : `Arriving ${fmtRange(order.estFrom, order.estTo)}`} · {order.delivery}
            </p>
            {order.deliverTogether && <p className="hint">Combined delivery: everything arrives together.</p>}
            <Timeline order={order} />
            <div className="totrow grand"><span>Total paid</span><span>{money(order.totalCents)}</span></div>

            <h3 className="ph" style={{ marginTop: 24, fontSize: 20 }}>Problem with your order?</h3>
            {order.returns.map((r, i) => (
              <div className="secure" key={i}><Icon as={Lifebuoy} size={20} /> <span><b>{REASONS[r.reason]}</b> ({r.status}): {r.resolution}</span></div>
            ))}
            {!openReturn && (showReturn
              ? <ReturnForm order={order} email={email} onDone={() => { setShowReturn(false); lookup(order.id, email); }} />
              : <button className="btn line" onClick={() => setShowReturn(true)}>Report a problem or start a return</button>)}
            <p className="hint" style={{ marginTop: 14 }}>Prefer to talk? Call a real person on 1300 000 000 (9am–6pm AEST).</p>
          </div>
        )}
      </div>
    </>
  );
}
