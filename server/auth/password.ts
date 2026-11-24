const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers Web Crypto max
const SALT_BYTES = 16;
const HASH_BITS = 256;
const HASH_PREFIX = 'pbkdf2_sha256';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BITS
  );

  return new Uint8Array(derived);
}

/**
 * Hash a password using PBKDF2-SHA256 (Web Crypto compatible with Cloudflare Workers).
 * Format: pbkdf2_sha256$<iterations>$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

/**
 * Verify a plaintext password against a stored PBKDF2-SHA256 hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;

  const [prefix, iterStr, saltHex, hashHex] = parts;
  if (prefix !== HASH_PREFIX) return false;

  const iterations = Number(iterStr);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > PBKDF2_ITERATIONS) {
    return false;
  }

  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  if (!salt || !expected) return false;

  const actual = await deriveKey(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
