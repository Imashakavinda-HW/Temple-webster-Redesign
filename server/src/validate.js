// Small input-validation helpers. The server never trusts the browser: every value
// is type-checked, trimmed and length-limited before it touches the database.

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function text(value, field, { min = 1, max = 120 } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`${field} is required.`);
  const v = value.trim();
  if (v.length < min) throw new ValidationError(`${field} is required.`);
  if (v.length > max) throw new ValidationError(`${field} is too long.`);
  return v;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function email(value) {
  const v = text(value, 'Email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new ValidationError('Please enter a valid email address.');
  return v;
}

// The most common leaked passwords that still pass an 8-character rule. Following
// NIST SP 800-63B, we block known-bad passwords instead of forcing odd symbol rules.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', '11111111', '00000000',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'abc12345', 'letmein1', 'welcome1', 'sunshine', 'football',
  'baseball', 'princess', 'passw0rd', 'trustno1', 'superman', 'whatever', 'dragon12', 'monkey123',
  'templewebster', 'temple&webster', 'furniture',
]);

export function password(value, emailAddress = '') {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ValidationError('Password must be at least 8 characters.');
  }
  if (value.length > 72) throw new ValidationError('Password is too long.'); // bcrypt's input limit
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    throw new ValidationError('That password is too common and appears in leaked-password lists. Please choose another.');
  }
  const emailName = emailAddress.split('@')[0].toLowerCase();
  if (emailName.length >= 4 && value.toLowerCase().includes(emailName)) {
    throw new ValidationError('Your password shouldn’t contain your email name.');
  }
  return value;
}

export function int(value, field, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} is invalid.`);
  }
  return value;
}
