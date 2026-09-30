import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, track } from '../lib/api.js';
import { fmtRange, money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import { PostcodeInput, useDeliveryEstimate } from '../components/DeliveryEstimate.jsx';

export default function Checkout() {
  const { cart, subtotalCents, clearCart, loading, postcode, refreshProducts } = useShop();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [options, setOptions] = useState(null); // add-on price and payment methods come from the server
  const [form, setForm] = useState({
    name: '', email: '', address: '',
    delivery: 'standard', payment: 'card',
    cardNumber: '', expiry: '', cvc: '',
    deliverTogether: false, // opt-in: one combined delivery on the latest date
    protection: false,      // opt-in add-on: starts UNticked
    consent: false,         // privacy consent: starts UNticked, required
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const logged = useRef(false);
  const placed = useRef(false);
  const { estimate, error: pcError } = useDeliveryEstimate(cart.map((l) => ({ id: l.id, qty: l.qty })), form.delivery);

  useEffect(() => {
    api('/api/checkout/options').then(setOptions).catch((e) => setError(e.message));
    if (!logged.current) { logged.current = true; track('checkout_start'); } // ref stops a double count in dev mode
  }, []);

  // If the chosen option isn't available for this postcode (express to remote areas), fall back.
  useEffect(() => {
    if (estimate && !estimate.options[form.delivery].available) setForm((f) => ({ ...f, delivery: 'standard' }));
  }, [estimate, form.delivery]);

  if (!cart.length && !loading && !placed.current) return <Navigate to="/cart" replace />;
  if (!options || loading) return <p className="hint" style={{ margin: '24px 0' }}>{error || 'Loading secure checkout…'}</p>;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const chosen = estimate?.options[form.delivery];
  // Only meaningful when items would otherwise arrive separately (never for express, for example).
  const together = form.deliverTogether && !!estimate?.splitShipment;
  const deliveryCents = chosen ? chosen.cents : options.delivery[form.delivery].cents;
  const protectionCents = form.protection ? options.protectionCents : 0;
  const totalCents = subtotalCents + deliveryCents + protectionCents;

  const placeOrder = async (e) => {
    e.preventDefault();
    setError('');
    // Quick checks in the browser for friendly messages; the server enforces all of them again.
    if (!form.consent) { toast('⚠ Privacy consent is required before payment'); return; }
    if (!user && (!form.name.trim() || !form.email.trim())) { toast('Please enter your name and email'); return; }
    if (!form.address.trim()) { toast('Please enter a delivery address'); return; }
    if (!estimate) { toast('Please enter a valid delivery postcode'); return; }

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
          name: form.name, email: form.email, address: form.address, postcode,
          deliveryOption: form.delivery,
          deliverTogether: together,
          protection: form.protection,
          paymentToken: token,
          privacyConsent: form.consent,
        },
      });
      placed.current = true;
      clearCart();
      refreshProducts(); // stock levels changed
      navigate(`/order/${order.id}`, { state: { order }, replace: true });
    } catch (err) {
      setError(err.message);
      toast(err.message);
      if (err.status === 409) refreshProducts();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="sr-only">Secure checkout</h1>
      <ol className="step" aria-label="Checkout steps"><li className="on">1 · Details</li><li className="on">2 · Delivery</li><li className="on">3 · Payment</li></ol>
      <div className="row">
        <div className="col">
          <form className="panel" onSubmit={placeOrder} noValidate>
            <h2 className="ph">Contact details</h2>
            {user ? (
              <p className="hint">Signed in as <b style={{ color: 'var(--gold-soft)' }}>{user.email}</b></p>
            ) : (
              <>
                <p className="hint">Checking out as guest. No account needed. <Link to="/account" style={{ color: 'var(--gold)' }}>Or sign in</Link></p>
                <label htmlFor="coName">Full name</label>
                <input type="text" id="coName" placeholder="Jane Smith" autoComplete="name" value={form.name} onChange={set('name')} />
                <label htmlFor="coEmail">Email</label>
                <input type="email" id="coEmail" placeholder="jane@example.com" autoComplete="email" value={form.email} onChange={set('email')} />
              </>
            )}
            <label htmlFor="coAddr">Street address and suburb</label>
            <input type="text" id="coAddr" placeholder="58 Princess Ave, Springvale VIC" autoComplete="street-address" value={form.address} onChange={set('address')} />
            <PostcodeInput id="coPostcode" label="Postcode" />
            {pcError && <div className="hint" role="alert" style={{ color: 'var(--warn)' }}>{pcError}</div>}

            <h2 className="ph" style={{ marginTop: 26 }}>Delivery</h2>
            <label htmlFor="coDelivery" className="sr-only">Delivery option</label>
            <select id="coDelivery" value={form.delivery} onChange={set('delivery')}>
              {Object.entries(options.delivery).map(([key, d]) => {
                const o = estimate?.options[key];
                return (
                  <option key={key} value={key} disabled={o && !o.available}>
                    {d.label} — {o ? (o.cents ? money(o.cents) : 'Free') : (d.cents ? money(d.cents) : 'Free')}
                    {o ? (o.available ? ` · arrives ${fmtRange(o.from, o.to)}` : ' · not available to your area') : ''}
                  </option>
                );
              })}
            </select>
            <div className="hint">{estimate
              ? `Delivering to ${estimate.postcode} ${estimate.state} (${estimate.zoneLabel})${estimate.surchargeCents ? `, which includes a ${money(estimate.surchargeCents)} remote-area surcharge` : ''}.`
              : 'Enter your postcode to see exact delivery dates and costs.'}</div>
            {estimate?.splitShipment && (
              <div className="addon">
                <input type="checkbox" id="coTogether" checked={form.deliverTogether} onChange={set('deliverTogether')} />
                <label htmlFor="coTogether" className="plain">
                  <b style={{ color: 'var(--gold-soft)' }}>Deliver everything together (free)</b>
                  <div className="hint">Your items ship from different warehouses. Tick this to receive them in one delivery
                    by {fmtRange(chosen.to, chosen.to)}, rather than as each one is ready.</div>
                </label>
              </div>
            )}

            <h2 className="ph" style={{ marginTop: 26 }}>Payment</h2>
            <label htmlFor="coPay" className="sr-only">Payment method</label>
            <select id="coPay" value={form.payment} onChange={set('payment')}>
              {Object.entries(options.paymentMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {form.payment === 'card' ? (
              <>
                <div className="cardrow">
                  <div><label htmlFor="ccNum">Card number</label>
                    <input type="text" id="ccNum" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242"
                           maxLength={23} value={form.cardNumber} onChange={set('cardNumber')} /></div>
                  <div><label htmlFor="ccExp">Expiry</label>
                    <input type="text" id="ccExp" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} value={form.expiry} onChange={set('expiry')} /></div>
                  <div><label htmlFor="ccCvc">CVC</label>
                    <input type="password" id="ccCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} value={form.cvc} onChange={set('cvc')} /></div>
                </div>
                <p className="hint">Demo test card: 4242 4242 4242 4242 · any future expiry · any 3-digit CVC.</p>
              </>
            ) : (
              <p className="hint">You'll approve the payment with {options.paymentMethods[form.payment].split(' —')[0]} (simulated in this demo).</p>
            )}
            <SecureBadge><b>Secure payment.</b> Card details are tokenised and never stored on our servers · SSL/TLS · PCI DSS.</SecureBadge>

            <div className="addon">
              <input type="checkbox" id="coAddon" checked={form.protection} onChange={set('protection')} />
              <label htmlFor="coAddon" className="plain">
                <b style={{ color: 'var(--gold-soft)' }}>Protect your purchase — {money(options.protectionCents)}</b>
                <div className="hint">Optional accidental-damage cover. Unticked by default: add it only if you want it.</div>
              </label>
            </div>

            <ConsentCheckbox id="coConsent" checked={form.consent} onChange={(v) => setForm((f) => ({ ...f, consent: v }))}>
              I have read and agree to the <Link to="/about" style={{ color: 'var(--gold)' }}>Privacy Policy</Link> and consent to Temple &amp; Webster
              collecting and using my personal information to process this order, in line with the Australian Privacy Principles (Privacy Act 1988).
            </ConsentCheckbox>

            {error && <div className="error" role="alert">{error}</div>}
            <button className="btn block" disabled={busy}>{busy ? 'Processing securely…' : `Pay ${money(totalCents)} & place order`}</button>
            <p className="hint" style={{ textAlign: 'center', marginTop: 10 }}>You will not be charged in this demo.</p>
          </form>
        </div>

        <div className="col" style={{ flex: '0 0 320px' }}><div className="panel summary">
          <h2 className="ph">Order summary</h2>
          {cart.map((l) => {
            const eta = estimate?.items.find((i) => i.productId === l.id);
            const when = together ? fmtRange(chosen.to, chosen.to) : eta ? fmtRange(eta.from, eta.to) : l.product.eta;
            return (
              <div key={l.id}>
                <div className="totrow"><span>{l.product.name} ×{l.qty}</span><span>{money(l.product.priceCents * l.qty)}</span></div>
                <div className="hint" style={{ marginTop: -6, color: 'var(--ok)' }}>🚚 {when}</div>
              </div>
            );
          })}
          <div className="totrow"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
          <div className="totrow"><span>Delivery</span><span>{deliveryCents ? money(deliveryCents) : 'Complimentary'}</span></div>
          <div className="totrow"><span>Protection</span><span>{money(protectionCents)}</span></div>
          <div className="totrow grand"><span>Total</span><span>{money(totalCents)}</span></div>
        </div></div>
      </div>
    </>
  );
}
