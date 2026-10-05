export async function verifyPaddleSignature(
  signatureHeader: string | null | undefined,
  rawBody: string,
  secret: string | undefined
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts: Record<string, string> = {};
  for (const item of signatureHeader.split(';')) {
    const [key, value] = item.split('=');
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
  }

  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = `${ts}:${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === h1;
}
