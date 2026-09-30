import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, track } from '../lib/api.js';
import { fmtRange, money } from '../lib/format.js';
import SecureBadge from '../components/SecureBadge.jsx';
import ConsentCheckbox from '../components/ConsentCheckbox.jsx';
import { PostcodeInput, useDeliveryEstimate } from '../components/DeliveryEstimate.jsx';
import { Icon } from '../components/Icons.jsx';
import { Check, Truck } from '@phosphor-icons/react';
import { ErrorSummary, FieldError, Req, errorProps } from '../components/FormBits.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Friendly formatting while typing: "4242424242424242" → "4242 4242 4242 4242", "1229" → "12/29".
const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const fmtExpiry = (v) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
// Which field a server/gateway error belongs to, so it's shown in the right place.
const fieldForServerError = (msg) => (/card number/i.test(msg) ? 'ccNum' : /expiry/i.test(msg) ? 'ccExp' : /cvc|security code/i.test(msg) ? 'ccCvc'
  : /consent/i.test(msg) ? 'coConsent' : /postcode/i.test(msg) ? 'coPostcode' : /address/i.test(msg) ? 'coAddr' : 'form');
const FIELD_IDS = { coName: 'coName', coEmail: 'coEmail', coAddr: 'coAddr', coPostcode: 'coPostcode', ccNum: 'ccNum', ccExp: 'ccExp', ccCvc: 'ccCvc', coConsent: 'coConsent' };
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export default function Checkout() {
  const { cart, subtotalCents, clearCart, loading, postcode, refreshProducts } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle('Secure checkout');

  const [options, setOptions] = useState(null); // add-on price and payment methods come from the server
  const [form, setForm] = useState({
    name: '', email: '', address: '',
    delivery: 'standard', payment: 'card',
    cardNumber: '', expiry: '', cvc: '',
    deliverTogether: false, // opt-in: one combined delivery on the latest date
    protection: false,      // opt-in add-on: starts UNticked
    consent: false,         // privacy consent: starts UNticked, required
  });
  const [error, setError] = useState(''); // only for failing to load checkout options
  const [errors, setErrors] = useState({});
  const [submits, setSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  const summaryRef = useRef(null);
  const logged = useRef(false);
  const placed = useRef(false);
  const { estimate, error: pcError } = useDeliveryEstimate(cart.map((l) => ({ id: l.id, qty: l.qty })), form.delivery);

  useEffect(() => {
    api('/api/checkout/options').then(setOptions).catch((e) => setError(e.message));
    if (!logged.current) { logged.current = true; track('checkout_start'); } // ref stops a double count in dev mode
  }, []);

  // After a failed submit, move focus to the error summary (skill: focus-management).
  useEffect(() => { if (submits && Object.values(errors).some(Boolean)) summaryRef.current?.focus(); }, [submits, errors]);

  // If the chosen option isn't available for this postcode (express to remote areas), fall back.
  useEffect(() => {
    if (estimate && !estimate.options[form.delivery].available) setForm((f) => ({ ...f, delivery: 'standard' }));
  }, [estimate, form.delivery]);

  if (!cart.length && !loading && !placed.current) return <Navigate to="/cart" replace />;
  if (!options || loading) return <p className="hint" style={{ margin: '24px 0' }}>{error || 'Loading secure checkout…'}</p>;

  const set = (field, format) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : format ? format(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };
  const chosen = estimate?.options[form.delivery];
  // Only meaningful when items would otherwise arrive separately (never for express, for example).
  const together = form.deliverTogether && !!estimate?.splitShipment;
  const deliveryCents = chosen ? chosen.cents : options.delivery[form.delivery].cents;
  const protectionCents = form.protection ? options.protectionCents : 0;
  const totalCents = subtotalCents + deliveryCents + protectionCents;

  const detailsDone = (user || (form.name.trim() && EMAIL_RE.test(form.email.trim()))) && form.address.trim().length >= 5;
  const paymentDone = form.payment !== 'card'
    || (form.cardNumber.replace(/\D/g, '').length >= 13 && /^\d{2}\/\d{2}$/.test(form.expiry) && /^\d{3,4}$/.test(form.cvc));
  const steps = [
    { label: 'Details', done: !!detailsDone },
    { label: 'Delivery', done: !!estimate },
    { label: 'Payment', done: paymentDone && form.consent },
  ];

  // Browser-side checks give instant, specific messages. The server repeats every one of them.
  const validate = () => {
    const card = form.payment === 'card';
    const digits = form.cardNumber.replace(/\D/g, '');
    return {
      coName: !user && !form.name.trim() ? 'Enter your full name' : '',
      coEmail: !user && !EMAIL_RE.test(form.email.trim()) ? 'Enter an email address like jane@example.com' : '',
      coAddr: form.address.trim().length < 5 ? 'Enter your street address and suburb' : '',
      coPostcode: !estimate ? 'Enter a valid 4-digit Australian postcode' : '',
      ccNum: card && (digits.length < 13 || digits.length > 19) ? 'Enter the long number on the front of your card' : '',
      ccExp: card && !/^\d{2}\/\d{2}$/.test(form.expiry) ? 'Enter the expiry date as MM/YY' : '',
      ccCvc: card && !/^\d{3,4}$/.test(form.cvc) ? 'Enter the 3 or 4-digit security code' : '',
      coConsent: !form.consent ? 'Tick the box to consent to the Privacy Policy before paying' : '',
    };
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmits((n) => n + 1);
    if (Object.values(found).some(Boolean)) return;

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
      setErrors({ [fieldForServerError(err.message)]: err.message });
      setSubmits((n) => n + 1);
      if (err.status === 409) refreshProducts();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="sr-only">Secure checkout</h1>
      <ol className="step" aria-label="Checkout progress">
        {steps.map((st, i) => (
          <li key={st.label} className={st.done ? 'done' : ''}>
            {st.done && <Icon as={Check} size={12} />} {i + 1} · {st.label}
            <span className="sr-only">{st.done ? ' (complete)' : ' (to do)'}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        <div className="col">
          <form className="panel" onSubmit={placeOrder} noValidate>
            <ErrorSummary errors={errors} fieldIds={FIELD_IDS} ref={summaryRef} />
            <h2 className="ph">Contact details</h2>
            <p className="hint">Fields marked <span className="req">*</span> are required.</p>
            {user ? (
              <p className="hint">Signed in as <b style={{ color: 'var(--emphasis)' }}>{user.email}</b></p>
            ) : (
              <>
                <p className="hint">Checking out as guest. No account needed. <Link to="/account" style={{ color: 'var(--accent-text)' }}>Or sign in</Link></p>
                <label htmlFor="coName">Full name<Req /></label>
                <input type="text" id="coName" placeholder="Jane Smith" autoComplete="name" aria-required="true"
                       value={form.name} onChange={set('name')} {...errorProps(errors, 'coName')} />
                <FieldError id="coName-error" message={errors.coName} />
                <label htmlFor="coEmail">Email<Req /></label>
                <input type="email" id="coEmail" placeholder="jane@example.com" autoComplete="email" aria-required="true"
                       value={form.email} onChange={set('email')} {...errorProps(errors, 'coEmail')} />
                <FieldError id="coEmail-error" message={errors.coEmail} />
              </>
            )}
            <label htmlFor="coAddr">Street address and suburb<Req /></label>
            <input type="text" id="coAddr" placeholder="58 Princess Ave, Springvale VIC" autoComplete="street-address" aria-required="true"
                   value={form.address} onChange={set('address')} {...errorProps(errors, 'coAddr')} />
            <FieldError id="coAddr-error" message={errors.coAddr} />
            <PostcodeInput id="coPostcode" label="Postcode" required invalid={!!errors.coPostcode}
                           describedBy={errors.coPostcode ? 'coPostcode-error' : undefined} />
            <FieldError id="coPostcode-error" message={errors.coPostcode} />
            {pcError && !errors.coPostcode && <div className="hint" role="alert" style={{ color: 'var(--danger)' }}>{pcError}</div>}

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
                  <b style={{ color: 'var(--emphasis)' }}>Deliver everything together (free)</b>
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
                  <div><label htmlFor="ccNum">Card number<Req /></label>
                    <input type="text" id="ccNum" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" aria-required="true"
                           maxLength={23} value={form.cardNumber} onChange={set('cardNumber', fmtCard)} {...errorProps(errors, 'ccNum')} />
                    <FieldError id="ccNum-error" message={errors.ccNum} /></div>
                  <div><label htmlFor="ccExp">Expiry<Req /></label>
                    <input type="text" id="ccExp" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} aria-required="true"
                           value={form.expiry} onChange={set('expiry', fmtExpiry)} {...errorProps(errors, 'ccExp')} />
                    <FieldError id="ccExp-error" message={errors.ccExp} /></div>
                  <div><label htmlFor="ccCvc">CVC<Req /></label>
                    <input type="password" id="ccCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="•••" maxLength={4} aria-required="true"
                           value={form.cvc} onChange={set('cvc', (v) => v.replace(/\D/g, ''))} {...errorProps(errors, 'ccCvc')} />
                    <FieldError id="ccCvc-error" message={errors.ccCvc} /></div>
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
                <b style={{ color: 'var(--emphasis)' }}>Protect your purchase — {money(options.protectionCents)}</b>
                <div className="hint">Optional accidental-damage cover. Unticked by default: add it only if you want it.</div>
              </label>
            </div>

            <ConsentCheckbox id="coConsent" checked={form.consent} onChange={(v) => setForm((f) => ({ ...f, consent: v }))} invalid={!!errors.coConsent}>
              I have read and agree to the <Link to="/about" style={{ color: 'var(--accent-text)' }}>Privacy Policy</Link> and consent to Temple &amp; Webster
              collecting and using my personal information to process this order, in line with the Australian Privacy Principles (Privacy Act 1988).
            </ConsentCheckbox>
            <FieldError id="coConsent-error" message={errors.coConsent} />

            {errors.form && <div className="error" role="alert">{errors.form}</div>}
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
                <div className="hint" style={{ marginTop: -6, color: 'var(--success)' }}><Icon as={Truck} /> {when}</div>
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
