// One place for every call to the back-end. Sends/receives JSON, includes the session
// cookie, and turns error responses into thrown Errors with the server's message.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Fire-and-forget analytics event; a failure here must never break shopping.
export function track(type) {
  api('/api/events', { method: 'POST', body: { type } }).catch(() => {});
}
