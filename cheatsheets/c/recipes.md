---
language: c
badge: c
aliases: [c]
---

## Builtin Bit Intrinsics
```c
int x = 42;
unsigned long long big = 1ULL << 40;

// Number of set bits (popcount):
int count = __builtin_popcount(x);
int count_ll = __builtin_popcountll(big);

// Count leading zeros:
int lz = __builtin_clz(x);

// Count trailing zeros:
int tz = __builtin_ctz(x);
```
Compiler intrinsic instructions mapping directly to single hardware CPU instructions.

## Bit Manipulation Tricks & Submasks
```c
// Check if power of two:
int is_pow2 = (x > 0) && !(x & (x - 1));

// Isolate lowest set bit:
int lowest_bit = x & -x;

// Clear lowest set bit:
int cleared = x & (x - 1);

// Iterate through all non-empty submasks of mask:
for (int sub = mask; sub > 0; sub = (sub - 1) & mask) {
    // Process submask
}
```
Executes elementary bitwise operations in $O(1)$ time for state compression and bitmask dynamic programming.

## Math: GCD, LCM & Modular Exponentiation
```c
long long gcd(long long a, long long b) {
    while (b != 0) {
        long long t = b;
        b = a % b;
        a = t;
    }
    return a;
}

long long lcm(long long a, long long b) {
    return (a / gcd(a, b)) * b;
}

// Fast modular exponentiation (base^exp % mod):
long long mod_pow(long long base, long long exp, long long mod) {
    long long res = 1;
    base %= mod;
    while (exp > 0) {
        if (exp & 1) res = (res * base) % mod;
        base = (base * base) % mod;
        exp >>= 1;
    }
    return res;
}
```
Computes number-theoretic primitives in logarithmic time via Euclidean algorithm and binary exponentiation.