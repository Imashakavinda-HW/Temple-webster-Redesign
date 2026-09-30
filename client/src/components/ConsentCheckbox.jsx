import { Link } from 'react-router-dom';

// Required privacy consent. It is NEVER pre-ticked (starts false) — the customer has to
// actively tick it, which is what the Australian Privacy Principles expect.
export default function ConsentCheckbox({ id, checked, onChange, children, invalid }) {
  return (
    <div className="consent">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} aria-required="true"
             aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} />
      <label htmlFor={id} className="plain">
        <b style={{ color: 'var(--emphasis)' }}>Privacy consent (required)<span className="req" aria-hidden="true">*</span></b>
        <div className="hint">
          {children || <>I agree to the <Link to="/about" style={{ color: 'var(--accent-text)' }}>Privacy Policy</Link> (Privacy Act 1988).</>}
        </div>
      </label>
    </div>
  );
}
