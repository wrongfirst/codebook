---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus]
---

## Builtin Bit Intrinsics
```cpp
int x = 42;
long long big = 1LL << 40;

// Number of set bits:
int count = __builtin_popcount(x);
int count_ll = __builtin_popcountll(big);

// Count leading zeros:
int lz = __builtin_clz(x);

// Count trailing zeros:
int tz = __builtin_ctz(x);
```
Compiler intrinsic instructions compiled down directly to hardware CPU bitwise instructions.

## Bit Manipulation Tricks & Submask Iteration
```cpp
// Check if power of two:
bool is_pow2 = (x > 0) && !(x & (x - 1));

// Isolate lowest set bit:
int lowest_bit = x & -x;

// Clear lowest set bit:
int cleared = x & (x - 1);

// Iterate through all submasks of mask (O(3^N) across all masks):
for (int sub = mask; sub > 0; sub = (sub - 1) & mask) {
    // Process submask
}
```
Executes elementary bitwise operations in $O(1)$ time for state compression and bitmask dynamic programming.

## Math: GCD & LCM (<numeric>)
```cpp
#include <numeric>

long long g = std::gcd(48LL, 18LL); // 6
long long l = std::lcm(12LL, 15LL); // 60
```
Built-in Euclidean algorithm in `<numeric>` computing greatest common divisor and least common multiple in $O(\log(\min(a, b)))$ time.

## Fast Modular Exponentiation & Inverse
```cpp
constexpr long long MOD = 1e9 + 7;

// (base^exp) % MOD in O(log exp) time:
long long power(long long base, long long exp) {
    long long res = 1;
    base %= MOD;
    while (exp > 0) {
        if (exp % 2 == 1) res = (res * base) % MOD;
        base = (base * base) % MOD;
        exp /= 2;
    }
    return res;
}

// Modular inverse when MOD is prime (Fermat's Little Theorem):
long long modInverse(long long n) {
    return power(n, MOD - 2);
}
```
Computes large powers and modular division in logarithmic time via binary exponentiation.

## Fast Competitive I/O Template
```cpp
#include <iostream>

int main() {
    // Untie C++ streams from C stdio for fast competitive I/O:
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // Prefer '\n' over std::endl (std::endl forces an expensive buffer flush)
    return 0;
}
```
Optimizes standard stream throughput for high-volume competitive programming test inputs.
