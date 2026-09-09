---
language: go
badge: go
aliases: [go, golang]
---

## Slice Operations (Make, Append, Slice)
```go
nums := make([]int, 0, 10)  // len 0, cap 10
nums = append(nums, 1, 2, 3)
sub := nums[1:3]             // slice [low:high]
nums = append(nums, sub...)  // spread append
```
Constructs dynamically sized arrays with preallocated capacity, appends elements, and extracts sub-slices sharing underlying storage.

## Map Operations & Comma-Ok Idiom
```go
counts := make(map[string]int)
counts["apple"] = 5

val, ok := counts["apple"]   // ok is true if key exists
delete(counts, "apple")      // removes key safely
```
Initializes key-value hash maps and uses the two-value lookup idiom to distinguish missing keys from zero values.

## Multiple Return Values & Error Handling
```go
func parseData(raw string) (Data, error) {
    if raw == "" {
        return Data{}, errors.New("empty input")
    }
    return Data{val: raw}, nil
}

res, err := parseData(input)
if err != nil {
    return fmt.Errorf("parsing failed: %w", err)
}
```
Returns explicit errors alongside values as the idiomatic Go pattern for control flow and error propagation.

## Structs and Receiver Methods
```go
type Counter struct {
    count int
}

func (c *Counter) Increment() { c.count++ }      // pointer receiver modifies
func (c Counter) Value() int  { return c.count } // value receiver reads
```
Defines composite data types with methods; uses pointer receivers to mutate struct fields and avoid copying large data structures.

## Interfaces and Type Assertions
```go
var val any = "hello"

if str, ok := val.(string); ok {
    fmt.Println("String:", str)
}

switch v := val.(type) {
case int:
    fmt.Println("Integer:", v)
case string:
    fmt.Println("String:", v)
}
```
Satisfies contracts implicitly and inspects concrete runtime types using type assertions and type switches.

## Goroutines and Channels
```go
ch := make(chan int, 2) // buffered channel
go func() {
    ch <- 42
    close(ch)
}()

select {
case msg := <-ch:
    fmt.Println(msg)
case <-time.After(1 * time.Second):
    fmt.Println("timeout")
}
```
Launches lightweight concurrent threads and communicates synchronously or asynchronously with channel operations and `select`.

## Defer for Resource Cleanup
```go
file, err := os.Open("data.txt")
if err != nil {
    return err
}
defer file.Close() // runs when surrounding function returns
```
Schedules a function call to execute immediately before the surrounding function returns in last-in, first-out (LIFO) order.

## Slices Package Sorting & Search
```go
slices.Sort(items)
idx, found := slices.BinarySearch(items, target)
has := slices.Contains(items, target)
```
Utilizes standard library generic algorithms to sort sequences in-place and perform efficient lookups without custom boilerplate.

## Range Loops with Blank Identifier
```go
for idx, val := range items {
    fmt.Printf("%d: %s\n", idx, val)
}

for _, val := range items { // ignore index
    fmt.Println(val)
}
```
Iterates over slices, maps, strings, and channels, using the blank identifier `_` to discard unwanted indices or values.

## String Building and Conversions
```go
var b strings.Builder
b.WriteString("hello ")
b.WriteString("world")
res := b.String()

num, _ := strconv.Atoi("42")
str := strconv.Itoa(100)
```
Efficiently concatenates strings without intermediate allocations and converts between primitive types and string representations.
