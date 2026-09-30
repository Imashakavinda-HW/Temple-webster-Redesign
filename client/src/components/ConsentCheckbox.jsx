import { Link } from 'react-router-dom';

// Required privacy consent. It is NEVER pre-ticked (starts false) — the customer has to
// actively tick it, which is what the Australian Privacy Principles expect.
export default function ConsentCheckbox({ id, checked, onChange, children }) {
  return (
    <div className="consent">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="plain">
        <b style={{ color: 'var(--gold-soft)' }}>Privacy consent (required)</b>
        <div className="hint">
          {children || <>I agree to the <Link to="/about" style={{ color: 'var(--gold)' }}>Privacy Policy</Link> (Privacy Act 1988).</>}
        </div>
      </label>
    </div>
  );
}
