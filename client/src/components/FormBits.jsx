import { forwardRef } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { Icon } from './Icons.jsx';

// Skill forms rules implemented here:
//  - required-indicators: a visible * on required labels (hidden from screen readers,
//    which get aria-required on the input instead)
//  - error-placement: the message sits right under its field and is linked to it
//    with aria-describedby, with an icon + text (never colour alone)
//  - error-summary + focus-management: after a failed submit, a summary at the top
//    lists every problem, links to each field, and receives focus

export const Req = () => <span className="req" aria-hidden="true">*</span>;

export function FieldError({ id, message }) {
  if (!message) return null;
  return <div className="field-error" id={id}><Icon as={WarningCircle} /> <span>{message}</span></div>;
}

// Props for an input: marks it invalid and links it to its error message.
export const errorProps = (errors, field) => (errors[field]
  ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` }
  : {});

export const ErrorSummary = forwardRef(function ErrorSummary({ errors, fieldIds }, ref) {
  const entries = Object.entries(errors).filter(([, msg]) => msg);
  if (!entries.length) return null;
  const jump = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  };
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref} aria-labelledby="errorSummaryTitle">
      <h2 id="errorSummaryTitle">There {entries.length === 1 ? 'is a problem' : `are ${entries.length} problems`}</h2>
      <ul>
        {entries.map(([field, msg]) => (
          <li key={field}>{fieldIds[field]
            ? <a href={`#${fieldIds[field]}`} onClick={(e) => jump(e, fieldIds[field])}>{msg}</a>
            : msg}</li>
        ))}
      </ul>
    </div>
  );
});
