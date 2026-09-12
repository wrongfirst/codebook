---
language: typescript
badge: ts
aliases: [ts, typescript, js, javascript]
---

## Bitwise Flags & Permission Masks
```typescript
const READ    = 1 << 0; // 0001
const WRITE   = 1 << 1; // 0010
const EXECUTE = 1 << 2; // 0100

// Enable / add a flag:
let perms = READ | WRITE;

// Check if a flag is enabled:
const canWrite = (perms & WRITE) !== 0;

// Clear / remove a flag:
perms &= ~WRITE;

// Toggle a flag:
perms ^= EXECUTE;
```
Manages composite boolean states and access control flags efficiently using bitwise mask arithmetic.

## Bit Manipulation Tricks
```typescript
// Check if power of two:
const isPowerOfTwo = (x: number) => x > 0 && (x & (x - 1)) === 0;

// Isolate lowest set bit:
const lowestBit = x & -x;

// Clear lowest set bit:
const cleared = x & (x - 1);
```
Executes elementary bitwise arithmetic in $O(1)$ time.

## 32-Bit Truncation & Unsigned Coercion (>>> 0)
```typescript
// In JS, bitwise ops operate on 32-bit signed integers:
const signed = -1;
const unsigned = signed >>> 0; // 4294967295 (coerces to unsigned 32-bit integer)


## BigInt for Large Numbers
```typescript
const MOD = 1000000007n;

// BigInt operations require explicit 'n' suffix:
const bigA = 10n ** 18n;
const bigB = 2n;
const prod = (bigA * bigB) % MOD;

// Convert to/from standard number:
const asNumber = Number(prod);
```
Performs arbitrary-precision integer arithmetic without 64-bit float precision loss beyond `Number.MAX_SAFE_INTEGER` ($2^{53} - 1$).

## Math: GCD, LCM & Modular Exponentiation
```typescript
function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

// Fast modular exponentiation (base^exp % mod):
// Note: this is primarily a competitive-programming pattern;
// production code needing this would typically use a crypto library.
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp /= 2n;
  }
  return res;
}
```
Computes number-theoretic primitives in $O(\log(\min(a, b)))$ and $O(\log(\text{exp}))$ time.

