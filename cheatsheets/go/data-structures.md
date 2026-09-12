---
language: go
badge: go
aliases: [go, golang]
---

## Stack and Queue with Slices
```go
// Stack (LIFO):
var stack []int
stack = append(stack, val)           // Push
top := stack[len(stack)-1]           // Peek
stack = stack[:len(stack)-1]         // Pop

// Queue (FIFO):
var queue []int
queue = append(queue, val)           // Enqueue
front := queue[0]                    // Peek
queue = queue[1:]                    // Dequeue (O(1) amortized slice reslicing)
```
Implements lightweight stacks and FIFO queues using slice slicing and appends without extra package imports.

## 2D Matrix Allocation
```go
R, C := 4, 5

// Correct: allocate R independent row slices:
grid := make([][]int, R)
for i := range grid {
    grid[i] = make([]int, C)
}
```
Allocates a 2D slice grid safely without sharing row storage references.

## Priority Queue (container/heap Interface)
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
    *h = old[:n-1]
    return x
}

// Usage:
h := &IntHeap{2, 1, 5}
heap.Init(h)
heap.Push(h, 3)
minVal := heap.Pop(h).(int) // 1
```
Satisfies Go's standard `heap.Interface` with 5 methods to maintain binary min/max heaps in $O(\log N)$ time.

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
Identifies the next greater or smaller element across an array in linear $O(N)$ amortized time.

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
Maintains disjoint partition subsets with path compression and rank heuristics in nearly $O(1)$ inverse Ackermann time $\alpha(N)$.

## Trie (Prefix Tree)
```go
type TrieNode struct {
    children [26]*TrieNode
    isEnd    bool
}

type Trie struct {
    root *TrieNode
}

func NewTrie() *Trie {
    return &Trie{root: &TrieNode{}}
}

func (t *Trie) Insert(word string) {
    curr := t.root
    for _, ch := range word {
        idx := ch - 'a'
        if curr.children[idx] == nil {
            curr.children[idx] = &TrieNode{}
        }
        curr = curr.children[idx]
    }
    curr.isEnd = true
}
```
Prefix tree structure supporting word and prefix validation in $O(L)$ time for words of length $L$.
