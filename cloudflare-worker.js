/**
 * ShiftDesk Push Worker — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /vapid-public     → returneaza cheia publica VAPID
 *   POST /subscribe        → salveaza subscriptia push (body: PushSubscription JSON)
 *   POST /webhook          → primeste webhook WooCommerce, trimite push la toate dispozitivele
 *   GET  /                 → health check
 *
 * KV namespace: SUBSCRIPTIONS (bind in Cloudflare dashboard)
 */

const VAPID_PUBLIC  = 'BK2UDjPGQfRmtY0sc5Tg6sYZWZhngBcdLcU3bBYX611V3eWX-4WS8594i3ZmaI-vTj63nf_tUf-_-VLjdbgjtrg';
// VAPID_PRIVATE vine din Cloudflare Secret (Settings → Variables → Secrets → VAPID_PRIVATE)
// Nu se hardcodeaza niciodata in cod sursa.
const VAPID_SUBJECT = 'mailto:admin@shiftdesk.ro';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  try {
    if (url.pathname === '/') {
      return json({ status: 'ok', service: 'ShiftDesk Push' });
    }

    if (url.pathname === '/vapid-public' && req.method === 'GET') {
      return json({ key: VAPID_PUBLIC });
    }

    if (url.pathname === '/subscribe') {
      if (req.method === 'POST') {
        const sub = await req.json();
        const key = subKey(sub.endpoint);
        await SUBSCRIPTIONS.put(key, JSON.stringify(sub), { expirationTtl: 60 * 60 * 24 * 365 });
        return json({ ok: true }, 201);
      }
      if (req.method === 'DELETE') {
        const { endpoint } = await req.json();
        await SUBSCRIPTIONS.delete(subKey(endpoint));
        return json({ ok: true });
      }
    }

    if (url.pathname === '/webhook' && req.method === 'POST') {
      const order = await req.json();
      const name  = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim();
      const total = parseFloat(order.total || 0).toFixed(2);
      const curr  = order.currency || 'RON';

      const payload = JSON.stringify({
        title: 'Comanda noua!',
        body:  `#${order.id} — ${name} — ${total} ${curr}`,
        tag:   'order-' + order.id,
        url:   'https://catalincheaga.github.io/shiftdesk/shiftdesk-admin.html#orders',
        orderId: order.id,
      });

      // Trimite push la toate subscriptiile salvate
      const list = await SUBSCRIPTIONS.list();
      const results = await Promise.allSettled(
        list.keys.map(async ({ name: k }) => {
          const raw = await SUBSCRIPTIONS.get(k);
          if (!raw) return;
          const sub = JSON.parse(raw);
          try {
            await sendPush(sub, payload);
          } catch(e) {
            if (e.status === 410 || e.status === 404) {
              await SUBSCRIPTIONS.delete(k); // subscriptie expirata
            }
          }
        })
      );

      const sent = results.filter(r => r.status === 'fulfilled').length;
      return json({ ok: true, sent, total: list.keys.length });
    }

    return json({ error: 'Not found' }, 404);

  } catch(e) {
    return json({ error: e.message }, 500);
  }
}

// ─────────────────────────────────────────────
// WEB PUSH SENDER (RFC 8291 + RFC 8188)
// ─────────────────────────────────────────────
async function sendPush(subscription, payload) {
  const { endpoint, keys } = subscription;
  const { p256dh, auth } = keys;

  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const [jwt, body] = await Promise.all([
    makeVapidJwt(audience),
    encryptPayload(payload, p256dh, auth),
  ]);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':   `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type':    'application/octet-stream',
      'TTL':             '86400',
    },
    body,
  });

  if (!res.ok) {
    const err = new Error(`Push error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
}

// ─── VAPID JWT ────────────────────────────────
async function makeVapidJwt(audience) {
  const enc    = new TextEncoder();
  const now    = Math.floor(Date.now() / 1000);
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: VAPID_SUBJECT })));
  const unsigned = `${header}.${claims}`;

  if (!VAPID_PRIVATE) throw new Error('VAPID_PRIVATE secret not configured in Cloudflare Worker.');
  const key = await crypto.subtle.importKey(
    'pkcs8', b64uToBuf(VAPID_PRIVATE),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)
  );

  return `${unsigned}.${b64u(sig)}`;
}

// ─── PAYLOAD ENCRYPTION (RFC 8291 + RFC 8188) ─
async function encryptPayload(plaintext, p256dhB64, authB64) {
  const enc = new TextEncoder();

  const recipientPublicKeyRaw = b64uToBuf(p256dhB64);
  const authSecret = b64uToBuf(authB64);

  const recipientPublicKey = await crypto.subtle.importKey(
    'raw', recipientPublicKeyRaw,
    { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);

  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    serverKeys.privateKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  // info = "WebPush: info\0" + ua_public_key + as_public_key
  const prkInfo = concat(
    enc.encode('WebPush: info\0'),
    new Uint8Array(recipientPublicKeyRaw),
    new Uint8Array(serverPublicKeyRaw)
  );
  const prk = await hkdf(authSecret, new Uint8Array(sharedSecretBits), prkInfo, 32);

  // CEK = HKDF(salt, prk, "Content-Encoding: aes128gcm\0", 16)
  const cek   = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  // NONCE = HKDF(salt, prk, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12);

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

  // Plaintext + record delimiter (0x02)
  const plaintextBytes = enc.encode(plaintext);
  const padded = concat(plaintextBytes, new Uint8Array([2]));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded)
  );

  // RFC 8188 header: salt(16) + rs(4) + idlen(1) + server_public_key(65)
  const rs = 4096;
  const header = new Uint8Array(21 + serverPublicKeyRaw.byteLength);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, rs, false);
  header[20] = serverPublicKeyRaw.byteLength;
  header.set(new Uint8Array(serverPublicKeyRaw), 21);

  return concat(header, ciphertext);
}

// ─── HKDF (RFC 5869) ─────────────────────────
async function hkdf(salt, ikm, info, length) {
  const saltKey = await crypto.subtle.importKey(
    'raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));

  const prkKey = await crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const blocks = Math.ceil(length / 32);
  let t = new Uint8Array(0);
  const okm = new Uint8Array(blocks * 32);

  for (let i = 1; i <= blocks; i++) {
    const input = concat(t, info, new Uint8Array([i]));
    t = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, input));
    okm.set(t, (i - 1) * 32);
  }

  return okm.slice(0, length);
}

// ─── UTILS ───────────────────────────────────
function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64uToBuf(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.byteLength; }
  return out;
}

function subKey(endpoint) {
  return 'sub_' + endpoint.slice(-48).replace(/[^a-zA-Z0-9]/g, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
