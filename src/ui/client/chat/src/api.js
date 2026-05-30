// HTTP helpers. Treats 401 as a global "not logged in" — redirects to
// the shared login page so the user can pick a sign-in provider.
export async function api(url, opts) {
  const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
  if (r.status === 401) {
    const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.replace(`/ui/login?next=${next}`);
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
