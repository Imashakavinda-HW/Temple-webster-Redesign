import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, track } from '../lib/api.js';
import { money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';

export default function Checkout() {
  const { cart, subtotalCents, clearCart, loading } = useShop();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [options, setOptions] = useState(null); // delivery prices etc. come from the server
  const [form, setForm] = useState({
    name: '', email: '', address: '',
    delivery: 'standard', payment: 'card',
    cardNumber: '', expiry: '', cvc: '',
    protection: false,      // opt-in add-on: starts UNticked
    consent: false,         // privacy consent: starts UNticked, required
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logged = useRef(false);
  const placed = useRef(false);

  useEffect(() => {
    api('/api/checkout/options').then(setOptions).catch((e) => setError(e.message));
    if (!logged.current) { logged.current = true; track('checkout_start'); } // ref stops a double count in dev mode
  }, []);

  if (!cart.length && !loading && !placed.current) return <Navigate to="/cart" replace />;
  if (!options || loading) return <p className="hint" style={{ margin: '24px 0' }}>{error || 'Loading secure checkout…'}</p>;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const deliveryCents = options.delivery[form.delivery].cents;
  const protectionCents = form.protection ? options.protectionCents : 0;
  const totalCents = subtotalCents + deliveryCents + protectionCents;

  const placeOrder = async (e) => {
    e.preventDefault();
    setError('');
    // Quick check in the browser for a friendly message; the server enforces it again.
    if (!form.consent) { toast('⚠ Privacy consent is required before payment'); return; }
    if (!user && (!form.name.trim() || !form.email.trim())) { toast('Please enter your name and email'); return; }
    if (!form.address.trim()) { toast('Please enter a delivery address'); return; }

    setBusy(true);
    try {
      // Step 1: card details go to the (mock) payment gateway, which returns a one-time token.
      const { token } = await api('/mock-gateway/tokenize', {
        method: 'POST',
        body: form.payment === 'card'
          ? { method: 'card', cardNumber: form.cardNumber, expiry: form.expiry, cvc: form.cvc }
          : { method: form.payment },
      });
      // Step 2: the shop's API receives only the token — never the card number.
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: {
          items: cart.map((l) => ({ productId: l.id, qty: l.qty })), // no prices: the server decides
          name: form.name, email: form.email, address: form.address,
          deliveryOption: form.delivery,
          protection: form.protection,
          paymentToken: token,
          privacyConsent: form.consent,
        },
      });
      placed.current = true;
      clearCart();
      navigate(`/order/${order.id}`, { state: { order }, replace: true });
    } catch (err) {
      setError(err.message);
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="step"><div className="on">1 · Details</div><div className="on">2 · Delivery</div><div className="on">3 · Payment</div></div>
      <div className="row">
        <div className="col">
          <form className="panel" onSubmit={placeOrder} noValidate>
            <h3 className="ph">Contact details</h3>
            {user ? (
              <p className="hint">Signed in as <b style={{ color: 'var(--gold-soft)' }}>{user.email}</b></p>
            ) : (
              <>
                <p className="hint">Checking out as guest — no account required. <Link to="/account" style={{ color: 'var(--gold)' }}>Or sign in</Link></p>
                <label htmlFor="coName">Full name</label>
                <input type="text" id="coName" placeholder="Jane Smith" autoComplete="name" value={form.name} onChange={set('name')} />
                <label htmlFor="coEmail">Email</label>
                <input type="email" id="coEmail" placeholder="jane@example.com" autoComplete="email" value={form.email} onChange={set('email')} />
              </>
            )}
            <label htmlFor="coAddr">Delivery address</label>
            <input type="text" id="coAddr" placeholder="58 Princess Ave, Springvale VIC 3171" autoComplete="street-address" value={form.address} onChange={set('address')} />

            <h3 className="ph" style={{ marginTop: 26 }}>Delivery</h3>
            <select value={form.delivery} onChange={set('delivery')} aria-label="Delivery option">
              {Object.entries(options.delivery).map(([key, d]) => (
                <option key={key} value={key}>
                  {d.label.split(' (')[0]} — {d.cents ? money(d.cents) : 'Complimentary'} ({d.label.split(' (')[1]}
                </option>
              ))}
            </select>
            <div className="hint">Every item's delivery estimate is shown in your order summary.</div>

            <h3 className="ph" style={{ marginTop: 26 }}>Payment</h3>
            <select value={form.payment} onChange={set('payment')} aria-label="Payment method">
              {Object.entries(options.paymentMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {form.payment === 'card' ? (
              <div className="cardrow">
                <div><label htmlFor="ccNum">Card number</label>
                  <input type="text" id="ccNum" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242"
                         maxLength={23} value={form.cardNumber} onChange={set('cardNumber')} /></div>
                <div><label htmlFor="ccExp">Expiry</label>
                  <input type="text" id="ccExp" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} value={form.expiry} onChange={set('expiry')} /></div>
                <div><label htmlFor="ccCvc">CVC</label>
                  <input type="password" id="ccCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} value={form.cvc} onChange={set('cvc')} /></div>
              </div>
            ) : (
              <p className="hint">You'll approve the payment with {options.paymentMethods[form.payment].split(' —')[0]} (simulated in this demo).</p>
            )}
            {form.payment === 'card' && <p className="hint">Demo test card: 4242 4242 4242 4242 · any future expiry · any 3-digit CVC.</p>}
            <SecureBadge><b>Secure payment.</b> Card details are tokenised and never stored on our servers · SSL/TLS · PCI DSS.</SecureBadge>

            <div className="addon">
              <input type="checkbox" id="coAddon" checked={form.protection} onChange={set('protection')} />
              <label htmlFor="coAddon" style={{ all: 'unset', display: 'block', cursor: 'pointer' }}>
                <b style={{ color: 'var(--gold-soft)' }}>Protect your purchase — {money(options.protectionCents)}</b>
                <div className="hint">Optional accidental-damage cover. Unticked by default — add it only if you want it.</div>
              </label>
            </div>

            <ConsentCheckbox id="coConsent" checked={form.consent} onChange={(v) => setForm((f) => ({ ...f, consent: v }))}>
              I have read and agree to the <Link to="/about" style={{ color: 'var(--gold)' }}>Privacy Policy</Link> and consent to Temple &amp; Webster
              collecting and using my personal information to process this order, in line with the Australian Privacy Principles (Privacy Act 1988).
            </ConsentCheckbox>

            {error && <div className="error" role="alert">{error}</div>}
            <button className="btn block" disabled={busy}>{busy ? 'Processing securely…' : 'Pay & place order'}</button>
            <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>You will not be charged in this demo.</p>
          </form>
        </div>

        <div className="col" style={{ flex: '0 0 320px' }}><div className="panel">
          <h3 className="ph">Order summary</h3>
          {cart.map((l) => (
            <div key={l.id}>
              <div className="totrow"><span>{l.product.name} ×{l.qty}</span><span>{money(l.product.priceCents * l.qty)}</span></div>
              <div className="hint" style={{ marginTop: -6, color: 'var(--ok)' }}>🚚 {l.product.eta}</div>
            </div>
          ))}
          <div className="totrow"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
          <div className="totrow"><span>Delivery</span><span>{deliveryCents ? money(deliveryCents) : 'Complimentary'}</span></div>
          <div className="totrow"><span>Protection</span><span>{money(protectionCents)}</span></div>
          <div className="totrow grand"><span>Total</span><span>{money(totalCents)}</span></div>
        </div></div>
      </div>
    </>
  );
}
