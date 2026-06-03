/* eslint-disable */
/**
 * NanoClaw chat PWA service worker.
 *
 * Receives Web Push events with a thin payload (`{ v, kind, groupId,
 * threadId, msgId, ts }`), fetches the actual notification text from
 * `/ui/chat/api/push/notification` (gated by the `ui_session` cookie),
 * and shows the notification. On click, focuses an existing tab on
 * the right thread or opens one.
 *
 * Hand-written, no bundler — served as-is by routes.ts at /ui/chat/sw.js
 * with `Service-Worker-Allowed: /ui/chat/`.
 */

const SCOPE_PATH = '/ui/chat/';
const NOTIF_DETAILS_URL = '/ui/chat/api/push/notification';
const SUBSCRIBE_URL = '/ui/chat/api/push/subscribe';

self.addEventListener('install', (event) => {
  // Activate immediately on first install so push works without a reload.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch (_e) {
    payload = null;
  }
  if (!payload || payload.kind !== 'message') {
    return self.registration.showNotification('NanoClaw', {
      body: 'New activity',
      icon: '/ui/chat/icon.svg',
      tag: 'nanoclaw-generic',
    });
  }
  const { groupId, threadId, msgId } = payload;
  const tag = `nanoclaw-${groupId}-${threadId}`;

  // Skip if a window for this thread is already focused.
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const focusedOnThread = clientsList.some(
    (c) => c.focused && c.url.includes(`#g/${groupId}/t/${threadId}`),
  );
  if (focusedOnThread) return;

  let title = 'NanoClaw';
  let body = 'New message';
  let icon = '/ui/chat/icon.svg';
  try {
    const url = `${NOTIF_DETAILS_URL}?groupId=${encodeURIComponent(groupId)}&threadId=${encodeURIComponent(
      threadId,
    )}&msgId=${encodeURIComponent(msgId)}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (resp.ok) {
      const detail = await resp.json();
      if (detail.title) title = detail.title;
      if (detail.body) body = detail.body;
      if (detail.icon) icon = detail.icon;
    }
  } catch (_e) {
    // Network/auth failed — fall through with generic body.
  }

  await self.registration.showNotification(title, {
    body,
    icon,
    tag,
    renotify: true,
    data: { groupId, threadId, msgId },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(focusOrOpen(event.notification.data));
});

async function focusOrOpen(data) {
  const groupId = data && data.groupId;
  const threadId = data && data.threadId;
  const target = groupId && threadId ? `${SCOPE_PATH}#g/${groupId}/t/${threadId}` : SCOPE_PATH;
  const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clientsList) {
    if (c.url.includes(SCOPE_PATH)) {
      try {
        await c.focus();
        if ('navigate' in c) {
          try {
            await c.navigate(target);
          } catch (_e) {
            // Cross-origin or unsupported — leave the existing URL.
          }
        }
        return;
      } catch (_e) {
        /* try next */
      }
    }
  }
  if (self.clients.openWindow) {
    await self.clients.openWindow(target);
  }
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(resubscribe());
});

async function resubscribe() {
  try {
    const keyResp = await fetch('/ui/chat/api/push/public-key', { credentials: 'include' });
    if (!keyResp.ok) return;
    const { publicKey } = await keyResp.json();
    if (!publicKey) return;
    const sub = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await fetch(SUBSCRIBE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch (_e) {
    /* drop — client will re-subscribe on next open */
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
