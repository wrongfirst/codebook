#!/usr/bin/env node
/**
 * Generate a PBKDF2-SHA256 password hash compatible with server/auth/password.ts.
 *
 * Usage:
 *   node scripts/hash-password.mjs "your-password"
 */
import { webcrypto } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}

const iterations = 100_000;
const salt = new Uint8Array(16);
webcrypto.getRandomValues(salt);

const keyMaterial = await webcrypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits']
);

const derived = new Uint8Array(
  await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  )
);

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
console.log(`pbkdf2_sha256$${iterations}$${toHex(salt)}$${toHex(derived)}`);
