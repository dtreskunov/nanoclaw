// HTTP helpers. Treats 401 as a global "not logged in" — replaces the body
// with a static message and rejects.
export async function api(url, opts) {
  const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
  if (r.status === 401) {
    document.body.innerHTML =
      '<div style="padding:24px;font:14px system-ui">Not logged in. Visit the magic link your operator sent you.</div>';
    throw new Error('unauthorized');
  }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function postJson(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, data };
}
