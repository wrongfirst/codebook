---
language: go
badge: go
aliases: [go, golang]
---

## Slice Operations (Make, Append, Sub-Slice)
```go
nums := make([]int, 0, 10)  // len: 0, cap: 10
nums = append(nums, 1, 2, 3)
sub := nums[1:3]            // sub-slice [low:high]
nums = append(nums, sub...) // spread append
```
Constructs dynamically sized array views with preallocated capacity, appending elements and slicing without memory reallocation.

## Map Operations & Comma-Ok Idiom
```go
counts := make(map[string]int)
counts["apple"] = 5

// Comma-ok test distinguishes missing keys from zero-values:
val, ok := counts["apple"] // ok is true if key is present
delete(counts, "apple")     // safe removal (no error if absent)
```
Initializes hash tables and validates key existence safely without sentinel zero-value ambiguity.

## Multiple Return Values & Error Handling
```go
import (
    "errors"
    "fmt"
)

func parseData(raw string) (string, error) {
    if raw == "" {
        return "", errors.New("empty input payload")
    }
    return raw, nil
}

res, err := parseData(input)
if err != nil {
    return fmt.Errorf("parsing failed: %w", err) // %w wraps error for errors.Is/As
}
```
Propagates errors explicitly as return values, adhering to Go's standard control-flow error conventions.

## Defer for Resource Cleanup
```go
file, err := os.Open("data.txt")
if err != nil {
    return err
}
defer file.Close() // Guaranteed to run when surrounding function returns (LIFO order)
```
Defers execution of a function call until the surrounding function exits, ensuring reliable cleanup.

## Range Loops with Blank Identifier
```go
// Both index and value:
for idx, val := range items {
    fmt.Printf("%d: %v\n", idx, val)
}

// Value only (discard index with blank identifier):
for _, val := range items {
    process(val)
}

// Key and value over map:
for k, v := range counts {
    fmt.Println(k, v)
}
```
Iterates over slices, arrays, maps, strings, and channels using the blank identifier `_` to suppress unused index compiler errors.

## Pointers & Memory Allocation
```go
x := 42
p := &x         // p is *int (pointer to x)
*p = 100        // Dereference and mutate x

// Allocate zero-initialized memory on heap:
ptr := new(int) // returns *int initialized to 0
```
Manipulates memory addresses directly and passes pointers to functions to avoid copying large structures and allow in-place mutations.

## Structs and Receiver Methods
```go
type Counter struct {
    count int
}

// Pointer receiver: mutates receiver state
func (c *Counter) Increment() {
    c.count++
}

// Value receiver: operates on a read-only copy
func (c Counter) Value() int {
    return c.count
}
```
Defines composite data types with methods, using pointer receivers to mutate fields and avoid copying large structs.

## Struct Embedding (Composition)
```go
type BaseEntity struct {
    ID        string
    CreatedAt time.Time
}

// User embeds BaseEntity (inheriting its fields and methods directly):
type User struct {
    BaseEntity
    Username string
}

u := User{
    BaseEntity: BaseEntity{ID: "usr_123"},
    Username:   "alice",
}
fmt.Println(u.ID) // Direct field access on outer struct
```
Implements object composition by embedding inner structs directly, promoting code reuse without class hierarchies.

## Interfaces & Implicit Satisfaction
```go
type Stringer interface {
    String() string
}

type Point struct {
    X, Y int
}

// Point automatically satisfies Stringer without an explicit 'implements' keyword:
func (p Point) String() string {
    return fmt.Sprintf("(%d, %d)", p.X, p.Y)
}
```
Defines behavioral contracts satisfied implicitly by any type implementing the required method signatures.

## Type Assertions & Type Switches
```go
var val any = "hello"

// Single assertion with comma-ok guard:
if str, ok := val.(string); ok {
    fmt.Println("String:", str)
}

// Type switch over concrete types:
switch v := val.(type) {
case int:
    fmt.Println("Integer:", v)
case string:
    fmt.Println("String:", v)
}
```
Inspects dynamic concrete types stored inside `any` (or `interface{}`) safely using assertions and switch statements.

## Enums with const and iota
```go
type Status int

const (
    Pending Status = iota // 0
    Active                // 1
    Complete              // 2
    Failed                // 3
)
```
Creates strongly typed enumerations using Go's `iota` sequential constant generator.

## String Building & Conversions
```go
import (
    "strconv"
    "strings"
)

// Zero-allocation string concatenation:
var b strings.Builder
b.WriteString("hello ")
b.WriteString("world")
res := b.String()

// String and integer parsing:
num, err := strconv.Atoi("42") // string to int
str := strconv.Itoa(100)       // int to string
```
Concatenates strings efficiently through byte buffers and converts between numbers and strings.

## Goroutines, Channels & Select
```go
ch := make(chan int, 2) // buffered channel with capacity 2

go func() {
    ch <- 42
    close(ch)
}()

select {
case msg, ok := <-ch:
    if ok {
        fmt.Println("Received:", msg)
    }
case <-time.After(1 * time.Second):
    fmt.Println("Timed out")
}
```
Executes concurrent lightweight goroutines and coordinates synchronization with channels and multiplexed `select` blocks.

## Generics & Type Constraints
```go
// Type constraint interface using union and type approximation (~):
type Number interface {
    ~int | ~int64 | ~float64
}

// Generic function with custom constraint:
func Min[T Number](a, b T) T {
    if a < b {
        return a
    }
    return b
}

// Generic function with comparable and any constraints:
func Keys[K comparable, V any](m map[K]V) []K {
    keys := make([]K, 0, len(m))
    for k := range m {
        keys = append(keys, k)
    }
    return keys
}
```
Defines parameterized types and functions (Go 1.18+) using `any`, `comparable`, or union constraints with the `~` underlying type operator.

## Concurrency Synchronization (sync Package)
```go
import "sync"

// WaitGroup coordinates multiple goroutines:
var wg sync.WaitGroup
for _, id := range []int{1, 2, 3} {
    wg.Add(1)
    go func(i int) {
        defer wg.Done()
        process(i)
    }(id)
}
wg.Wait()

// Mutex & RWMutex protect shared mutable state:
var mu sync.RWMutex
var cache = make(map[string]int)

mu.Lock()         // Exclusive write lock
cache["k"] = 42
mu.Unlock()

mu.RLock()        // Shared concurrent read lock
val := cache["k"]
mu.RUnlock()

// Once guarantees thread-safe one-time initialization:
var once sync.Once
once.Do(func() { initResource() })
```
Coordinates goroutine completion with `sync.WaitGroup`, guards concurrent state with `Mutex`/`RWMutex`, and ensures single-execution setup with `sync.Once`.

## Context & Cancellation (context Package)
```go
import (
    "context"
    "time"
)

// Create context with deadline timeout:
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel() // Release timer resources

// Worker listening for cancellation:
go func(ctx context.Context) {
    select {
    case <-time.After(500 * time.Millisecond):
        // Work completed within deadline
    case <-ctx.Done():
        // Aborted due to timeout or explicit cancel:
        err := ctx.Err() // context.Canceled or context.DeadlineExceeded
        _ = err
        return
    }
}(ctx)
```
Propagates deadlines, cancellation signals, and request-scoped metadata across goroutine call trees.

## Error Wrapping & Inspection (errors Package)
```go
import (
    "errors"
    "fmt"
    "io/fs"
    "os"
)

var ErrNotFound = errors.New("resource not found")

// Wrap error with contextual detail using %w:
wrappedErr := fmt.Errorf("database query failed: %w", ErrNotFound)

// errors.Is matches sentinel errors anywhere in the wrapped chain:
if errors.Is(wrappedErr, ErrNotFound) {
    fmt.Println("Target sentinel error found in chain")
}

// errors.As extracts concrete error types from the wrapped chain:
var pathErr *fs.PathError
if errors.As(wrappedErr, &pathErr) {
    fmt.Println("Path that failed:", pathErr.Path)
}
```
Inspects wrapped error hierarchies using `errors.Is` for sentinel matching and `errors.As` for typed error extraction.

## Package Visibility & init() Lifecycle
```go
package service

// Exported (Public): Uppercase identifier is visible outside package:
type Config struct {
    Port    int    // Exported field
    secret  string // Unexported (package-private) field
}

// Unexported (Private): lowercase identifier is accessible only inside package:
func internalSetup() {}

// init() runs automatically once per package before main():
func init() {
    // Executes package setup; can appear multiple times per file/package
}
```
Governs symbol visibility through identifier capitalization (Uppercase exports, lowercase keeps package-private) and runs initialization before `main()` via `init()`.

## Closures & Variable Capture
```go
// Function returning closure that captures 'count' by reference:
func makeCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}

// Loop variable capture semantics:
for i := 0; i < 3; i++ {
    // Go 1.22+: 'i' is scoped per iteration (goroutines see intended value).
    // Go < 1.22: 'i' was shared across iterations, requiring explicit 'i := i' shadowing!
    go func() {
        fmt.Println(i)
    }()
}
```
Captures outer variables by reference in closures, with Go 1.22+ guaranteeing per-iteration loop variable scoping to eliminate concurrent capture traps.

## Panic & Recover
```go
import "log"

func safeOperation() {
    defer func() {
        if r := recover(); r != nil {
            // Intercepts panic during unwinding and prevents crash:
            log.Printf("recovered from panic: %v", r)
        }
    }()

    // Explicit panic or nil-pointer dereference:
    panic("unexpected fatal condition")
}
```
Catches runtime panics and fatal exceptions gracefully during deferred stack unwinding to prevent process crashes.

## String Formatting Verbs (fmt Package)
```go
import "fmt"

type Point struct{ X, Y int }
pt := Point{1, 2}

fmt.Printf("%v\n", pt)   // Default format: {1 2}
fmt.Printf("%+v\n", pt)  // Includes struct field names: {X:1 Y:2}
fmt.Printf("%#v\n", pt)  // Go-syntax representation: main.Point{X:1, Y:2}
fmt.Printf("%T\n", pt)   // Type name: main.Point

fmt.Printf("%d\n", 42)     // Decimal integer
fmt.Printf("%b\n", 42)     // Binary representation: 101010
fmt.Printf("%s\n", "text") // Raw string
fmt.Printf("%q\n", "text") // Quoted string: "text"
fmt.Printf("%.2f\n", 3.14) // Float with precision
```
Controls string interpolation and type inspection using `fmt.Sprintf` and `fmt.Printf` format specifiers.

## Common String Utilities (strings Package)
```go
import "strings"

s := "  apple,banana,orange  "

trimmed := strings.TrimSpace(s)                   // "apple,banana,orange"
parts := strings.Split(trimmed, ",")              // []string{"apple", "banana", "orange"}
joined := strings.Join(parts, "; ")               // "apple; banana; orange"

has := strings.Contains(trimmed, "banana")        // true
pre := strings.HasPrefix(trimmed, "app")          // true
suf := strings.HasSuffix(trimmed, "ge")           // true
replaced := strings.ReplaceAll(trimmed, ",", "|") // "apple|banana|orange"
```
Performs common string manipulation, trimming, tokenization, substring querying, and replacements via standard library helpers.

## Slice Backing Arrays & Full Slice Expressions
```go
orig := []int{1, 2, 3, 4, 5}

// Standard slice shares orig's backing array:
sub := orig[1:3] // [2, 3], len: 2, cap: 4

// HAZARD: append within capacity overwrites orig[3]!
sub = append(sub, 99) // orig becomes [1, 2, 3, 99, 5]

// Full slice expression [low:high:max] restricts capacity:
safeSub := orig[1:3:3] // len: 2, cap: 2
safeSub = append(safeSub, 100) // Forces new backing array allocation; orig is untouched
```
Prevents unintended mutations to shared backing arrays by constraining slice capacity with 3-index slicing `[low:high:max]`.

## Zero Values & Useful Defaults
```go
import (
    "bytes"
    "sync"
)

// Types are guaranteed to initialize to their zero values:
var num int           // 0
var flag bool         // false
var str string        // ""
var slice []int       // nil (valid for len, cap, and append)
var m map[string]int  // nil (reads return 0; writes require make)

// Idiomatic types are ready-to-use in their zero state:
var buf bytes.Buffer  // Ready for buf.WriteString() without constructor
var mu sync.Mutex     // Ready for mu.Lock() without initialization
```
Leverages guaranteed zero-value initialization, writing types whose zero state is valid and directly usable without explicit constructors.

## Streaming I/O (io.Reader & io.Writer)
```go
import (
    "bytes"
    "io"
    "strings"
)

// Read all data from an io.Reader:
r := strings.NewReader("stream payload")
data, err := io.ReadAll(r) // Reads until EOF into []byte

// io.Copy streams chunks from Reader to Writer without buffering everything in memory:
src := strings.NewReader("piped input")
var dst bytes.Buffer
written, err := io.Copy(&dst, src) // Returns bytes written
```
Composes input/output pipelines through foundational `io.Reader` and `io.Writer` streaming abstractions.

## Testing & Table-Driven Tests (testing Package)
```go
// In math_test.go (executed via: go test ./...)
package mypkg

import "testing"

func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive numbers", 2, 3, 5},
        {"zero identity", 2, 0, 2},
        {"negative numbers", 2, -3, -1},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, got, tt.expected)
            }
        })
    }
}
```
Structures unit tests using Go's built-in `testing` runner with idiomatic table-driven test cases and `t.Run` subtests.
