import { useState } from 'react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';

// Guest order tracking: order number + the email used at checkout.
export default function Track() {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setOrder(null);
    try {
      const qs = new URLSearchParams({ orderId: orderId.replace('#', '').trim(), email });
      setOrder((await api(`/api/orders/track?${qs}`)).order);
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="lead"><div><h2 className="serif">Track your order</h2><p>No account needed — just your order number and email.</p></div></div>
      <form className="panel" style={{ maxWidth: 520 }} onSubmit={submit}>
        <label htmlFor="trId">Order number</label>
        <input type="text" id="trId" placeholder="1001" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        <label htmlFor="trEmail">Email used at checkout</label>
        <input type="email" id="trEmail" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn block" style={{ marginTop: 20 }}>Find my order</button>
        {error && <div className="error" role="alert">{error}</div>}
        {order && (
          <div style={{ marginTop: 20 }}>
            <div className="totrow"><span>Order</span><span>#{order.id}</span></div>
            <div className="totrow"><span>Status</span><span style={{ color: 'var(--ok)' }}>{order.status}</span></div>
            <div className="totrow"><span>Items</span><span>{order.itemCount}</span></div>
            <div className="totrow"><span>Delivery</span><span>{order.delivery}</span></div>
            <div className="totrow grand"><span>Total</span><span>{money(order.totalCents)}</span></div>
          </div>
        )}
      </form>
    </>
  );
}
