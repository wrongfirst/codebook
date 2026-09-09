---
language: go
badge: go
aliases: [go, golang, dsa]
---

## Priority Queue (container/heap Implementation)
```go
import "container/heap"

type IntHeap []int

func (h IntHeap) Len() int           { return len(h) }
func (h IntHeap) Less(i, j int) bool { return h[i] < h[j] } // Min-heap (<), Max-heap (>)
func (h IntHeap) Swap(i, j int)      { h[i], h[j] = h[j], h[i] }
func (h *IntHeap) Push(x any)        { *h = append(*h, x.(int)) }
func (h *IntHeap) Pop() any {
    old := *h
    n := len(old)
    x := old[n-1]
    *h = old[0 : n-1]
    return x
}

// Usage:
h := &IntHeap{2, 1, 5}
heap.Init(h)
heap.Push(h, 3)
minVal := heap.Pop(h).(int) // 1
```
Implements the 5 standard methods required by Go's `heap.Interface` to maintain a min-heap or max-heap.

## Binary Search (Standard & Monotonic Predicate)
```go
import (
    "slices"
    "sort"
)

// In sorted slice (Go 1.21+):
idx, found := slices.BinarySearch(nums, target)

// Custom monotonic predicate template [0, n):
// Returns the smallest index i in [0, n) where f(i) is true:
firstIdx := sort.Search(len(nums), func(i int) bool {
    return nums[i] >= target // First index where condition is met
})
```
Leverages Go's modern `slices` package and `sort.Search` to find lower bounds and solution thresholds in $O(\log N)$.

## Stack and Queue Idioms with Slices
```go
// Stack (LIFO):
stack := []int{}
stack = append(stack, val)           // Push
top := stack[len(stack)-1]           // Peek
stack = stack[:len(stack)-1]         // Pop

// Queue (FIFO):
queue := []int{}
queue = append(queue, val)           // Enqueue
front := queue[0]                    // Peek
queue = queue[1:]                    // Dequeue (O(1) amortized)
```
Uses native slice append and slicing operations to implement dynamic stacks and breadth-first search queues.

## 2D Matrix Allocation & Directions
```go
R, C := len(grid), len(grid[0])

// Allocate 2D visited matrix:
visited := make([][]bool, R)
for i := range visited {
    visited[i] = make([]bool, C)
}

// 4-directional moves: Right, Down, Left, Up
dirs := [][2]int{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}

inBounds := func(r, c int) bool {
    return r >= 0 && r < R && c >= 0 && c < C
}
```
Initializes 2D slices without reference aliasing and checks coordinate boundaries cleanly with directional delta tuples.

## Graph BFS & Shortest Path
```go
adj := make(map[int][]int) // Adjacency list
dist := make(map[int]int)
queue := []int{start}
dist[start] = 0

for len(queue) > 0 {
    u := queue[0]
    queue = queue[1:]

    if u == target {
        break
    }

    for _, v := range adj[u] {
        if _, seen := dist[v]; !seen {
            dist[v] = dist[u] + 1
            queue = append(queue, v)
        }
    }
}
```
Computes unweighted shortest path distances using a queue and a visited distance map.

## Monotonic Stack (Next Greater Element)
```go
n := len(nums)
result := make([]int, n)
for i := range result { result[i] = -1 }
stack := []int{} // Stack of indices

for i := 0; i < n; i++ {
    for len(stack) > 0 && nums[i] > nums[stack[len(stack)-1]] {
        topIdx := stack[len(stack)-1]
        stack = stack[:len(stack)-1]
        result[topIdx] = nums[i]
    }
    stack = append(stack, i)
}
```
Processes elements with a decreasing index stack to locate next greater elements in $O(N)$ total time.

## Disjoint Set Union (DSU / Union-Find)
```go
type DSU struct {
    parent []int
    rank   []int
}

func NewDSU(n int) *DSU {
    p := make([]int, n)
    for i := range p { p[i] = i }
    return &DSU{parent: p, rank: make([]int, n)}
}

func (d *DSU) Find(i int) int {
    if d.parent[i] != i {
        d.parent[i] = d.Find(d.parent[i]) // Path compression
    }
    return d.parent[i]
}

func (d *DSU) Union(i, j int) bool {
    rootI, rootJ := d.Find(i), d.Find(j)
    if rootI == rootJ { return false }
    if d.rank[rootI] < d.rank[rootJ] {
        rootI, rootJ = rootJ, rootI
    }
    d.parent[rootJ] = rootI
    if d.rank[rootI] == d.rank[rootJ] { d.rank[rootI]++ }
    return true
}
```
Maintains connected sets and cycles with path compression and union-by-rank in near $O(1)$ time.

## Sliding Window Pattern
```go
left := 0
maxLen := 0
counts := make(map[byte]int)

for right := 0; right < len(s); right++ {
    counts[s[right]]++

    for !isValid(counts) { // Shrink invalid window from left
        counts[s[left]]--
        if counts[s[left]] == 0 {
            delete(counts, s[left])
        }
        left++
    }

    if currLen := right - left + 1; currLen > maxLen {
        maxLen = currLen
    }
}
```
Maintains dynamic valid substrings or subarrays in $O(N)$ amortized time.

## Backtracking Template (Slice Copy Pitfall)
```go
func subsets(nums []int) [][]int {
    var results [][]int
    var path []int

    var backtrack func(start int)
    backtrack = func(start int) {
        // PITFALL: Must copy slice; appending path directly shares underlying storage!
        snapshot := make([]int, len(path))
        copy(snapshot, path)
        results = append(results, snapshot)

        for i := start; i < len(nums); i++ {
            path = append(path, nums[i]) // Choose
            backtrack(i + 1)             // Explore
            path = path[:len(path)-1]    // Undo
        }
    }

    backtrack(0)
    return results
}
```
Avoids subtle slice mutation bugs during recursive state exploration by creating explicit copies when recording solutions.

## Custom Struct Sorting (slices.SortFunc)
```go
import (
    "cmp"
    "slices"
)

type Item struct {
    Val      int
    Priority int
}

// Sort by Priority ascending, then Val descending:
slices.SortFunc(items, func(a, b Item) int {
    if diff := cmp.Compare(a.Priority, b.Priority); diff != 0 {
        return diff
    }
    return cmp.Compare(b.Val, a.Val) // Reversed for descending
})
```
Sorts custom structs with modern generic comparator functions and multi-field tie-breaking.

## Bit Manipulation with math/bits
```go
import "math/bits"

// Count set bits:
count := bits.OnesCount(uint(x))

// Leading / trailing zeros:
lz := bits.LeadingZeros(uint(x))
tz := bits.TrailingZeros(uint(x))

// Is power of two:
isPow2 := x > 0 && (x&(x-1)) == 0

// Isolate lowest set bit:
lowest := x & -x
```
Executes hardware-accelerated bitwise operations and bitmask inspections using standard library primitives.
