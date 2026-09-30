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

export function password(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ValidationError('Password must be at least 8 characters.');
  }
  if (value.length > 72) throw new ValidationError('Password is too long.'); // bcrypt's input limit
  return value;
}

export function int(value, field, { min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} is invalid.`);
  }
  return value;
}
