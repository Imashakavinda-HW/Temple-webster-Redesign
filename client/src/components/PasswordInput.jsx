import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Icon, ICON } from './Icons.jsx';

// Password field with a show/hide button (skill rule: password-toggle). Paste and password
// managers keep working (WCAG 2.2 accessible authentication).
export default function PasswordInput({ id, value, onChange, autoComplete, placeholder, describedBy, invalid, inputRef }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw">
      <input ref={inputRef} type={visible ? 'text' : 'password'} id={id} value={value} onChange={onChange} autoComplete={autoComplete}
             placeholder={placeholder} aria-describedby={describedBy} aria-invalid={invalid || undefined}
             autoCapitalize="none" spellCheck={false} />
      <button type="button" className="pw-toggle" onClick={() => setVisible((v) => !v)}
              aria-label="Show password" aria-pressed={visible} aria-controls={id}>
        <Icon as={visible ? EyeSlash : Eye} size={ICON.md} />
      </button>
    </div>
  );
}
