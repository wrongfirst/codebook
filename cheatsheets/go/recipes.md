---
language: go
badge: go
aliases: [go, golang]
---

## Bit Manipulation with math/bits
```go
import "math/bits"

// Count set bits:
count := bits.OnesCount(uint(x))

// Count leading and trailing zeros:
lz := bits.LeadingZeros(uint(x))
tz := bits.TrailingZeros(uint(x))

// Check if power of two:
isPow2 := x > 0 && (x&(x-1)) == 0

// Isolate lowest set bit:
lowest := x & -x

// Clear lowest set bit:
cleared := x & (x - 1)
```
Executes hardware-accelerated bitwise operations and bitmask inspections using standard library primitives.

## Math: GCD, LCM & Modular Exponentiation
```go
func gcd(a, b int) int {
    for b != 0 {
        a, b = b, a%b
    }
    return a
}

func lcm(a, b int) int {
    return (a / gcd(a, b)) * b
}

// Fast modular exponentiation (base^exp % mod):
func modPow(base, exp, mod int64) int64 {
    var res int64 = 1
    base %= mod
    for exp > 0 {
        if exp%2 == 1 {
            res = (res * base) % mod
        }
        base = (base * base) % mod
        exp /= 2
    }
    return res
}
```
Computes number-theoretic primitives in logarithmic time via Euclidean algorithm and binary exponentiation.

## Fast Competitive I/O (bufio)
```go
import (
    "bufio"
    "os"
)

func main() {
    // Fast line scanner:
    scanner := bufio.NewScanner(os.Stdin)
    // Enlarge default token buffer if lines can exceed 64KB:
    scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

    // Buffered writer (remember to Flush!):
    writer := bufio.NewWriter(os.Stdout)
    defer writer.Flush()

    for scanner.Scan() {
        line := scanner.Text()
        writer.WriteString(line + "\n")
    }
}
```
Replaces unbuffered `fmt.Scan` and `fmt.Print` with high-throughput buffered streaming for competitive programming.
