/**
 * Member QR codes for check-in: "LIFTLY|<clientId>|<signature>".
 * The signature only stops typos and casual tampering in this front-end demo —
 * a real backend should issue signed, expiring tokens (e.g. HMAC + timestamp) instead.
 */
const DEMO_SECRET = 'liftly-demo';

function fnv1a(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const memberQrPayload = (clientId: string) => `LIFTLY|${clientId}|${fnv1a(clientId + DEMO_SECRET)}`;

/** The client id inside a scanned code, or null when it is not a valid Liftly member code. */
export function parseMemberQr(text: string): string | null {
  const [tag, id, sig] = text.trim().split('|');
  return tag === 'LIFTLY' && id && sig === fnv1a(id + DEMO_SECRET) ? id : null;
}
