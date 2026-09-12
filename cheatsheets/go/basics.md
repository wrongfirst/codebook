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
