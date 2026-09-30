import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useShop } from '../context/ShopContext.jsx';
import { Truck } from '@phosphor-icons/react';
import { fmtRange, money } from '../lib/format.js';
import { Icon } from './Icons.jsx';

// Postcode-based delivery estimate: fee + real calendar dates, shown BEFORE checkout.
// `items` is [{ id, qty }]. The postcode is remembered across pages.
export function useDeliveryEstimate(items, option = 'standard') {
  const { postcode } = useShop();
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const key = items.map((i) => `${i.id}:${i.qty}`).join(',');

  useEffect(() => {
    setError('');
    if (!/^\d{4}$/.test(postcode) || !key) { setEstimate(null); return undefined; }
    let cancelled = false;
    api(`/api/delivery/estimate?postcode=${postcode}&items=${key}&option=${option}`)
      .then((d) => { if (!cancelled) setEstimate(d); })
      .catch((e) => { if (!cancelled) { setEstimate(null); setError(e.message); } });
    return () => { cancelled = true; };
  }, [postcode, key, option]);

  return { estimate, error };
}

export function PostcodeInput({ id = 'postcode', label = 'Delivery postcode', required, invalid, describedBy }) {
  const { postcode, setPostcode } = useShop();
  return (
    <>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>
      <input type="text" id={id} inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="e.g. 3171"
             value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\D/g, ''))}
             aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
    </>
  );
}

export default function DeliveryEstimate({ items, compact = false }) {
  const { estimate, error } = useDeliveryEstimate(items);
  const std = estimate?.options.standard;

  return (
    <div className="estimator">
      <PostcodeInput id={compact ? 'pcCart' : 'pcProduct'} label="Check delivery to your postcode" />
      {error && <div className="hint" style={{ color: 'var(--danger)' }} role="alert">{error}</div>}
      {std && (
        <div className="est-result" aria-live="polite">
          <div><Icon as={Truck} /> <b>Arrives {fmtRange(std.from, std.to)}</b> to {estimate.postcode} {estimate.state} ({estimate.zoneLabel})</div>
          <div className="hint">
            Standard delivery {std.cents ? money(std.cents) + ' (remote-area surcharge)' : 'free'}
            {estimate.options.express.available
              ? ` · Express ${money(estimate.options.express.cents)}: ${fmtRange(estimate.options.express.from, estimate.options.express.to)}`
              : ' · Express not available to remote areas'}
          </div>
        </div>
      )}
    </div>
  );
}
