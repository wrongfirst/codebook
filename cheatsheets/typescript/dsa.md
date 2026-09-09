---
language: typescript
badge: ts
aliases: [ts, typescript, js, javascript, dsa]
---

## Numeric Sorting & Comparator Pitfall
```typescript
// PITFALL: [10, 2, 5].sort() yields [10, 2, 5] (lexicographical string sort!)
const nums = [10, 2, 5, 1];
nums.sort((a, b) => a - b);             // Ascending numeric order
nums.sort((a, b) => b - a);             // Descending numeric order

// Sorting objects with multiple tie-breaking criteria:
tasks.sort((a, b) => a.priority - b.priority || a.id - b.id);
```
Avoids JavaScript's default string-conversion sort trap by passing an explicit numeric subtraction comparator.

## Binary Search Template [left, right)
```typescript
let left = 0;
let right = nums.length;

while (left < right) {
  const mid = left + Math.floor((right - left) / 2);
  if (condition(mid)) {
    right = mid;     // Answer lies at or before mid
  } else {
    left = mid + 1;  // Answer lies strictly after mid
  }
}
return left; // First index where condition is true
```
Prevents integer overflow and off-by-one errors while searching sorted ranges or monotonic answer spaces.

## Queue & BFS (Avoiding O(N) shift Pitfall)
```typescript
// PITFALL: array.shift() is O(N) and can cause TLE in large graph/tree traversals!
const queue: [number, number][] = [[startNode, 0]];
const visited = new Set<number>([startNode]);
let head = 0; // Pointer-based O(1) dequeue

while (head < queue.length) {
  const [node, dist] = queue[head++];
  if (node === target) return dist;

  for (const neighbor of adj.get(node) ?? []) {
    if (!visited.has(neighbor)) {
      visited.add(neighbor);
      queue.push([neighbor, dist + 1]);
    }
  }
}
```
Traverses unweighted graphs in true linear $O(V + E)$ time using an array index pointer to dequeue in $O(1)$.

## Lightweight MinHeap / PriorityQueue
```typescript
class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number = (a, b) => (a as any) - (b as any)) {}

  get size(): number { return this.data.length; }
  peek(): T | undefined { return this.data[0]; }

  push(val: T): void {
    this.data.push(val);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) >= 0) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }

  pop(): T | undefined {
    if (this.size === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.size > 0) {
      this.data[0] = bottom;
      let i = 0;
      while ((i << 1) + 1 < this.data.length) {
        let left = (i << 1) + 1, right = left + 1, best = left;
        if (right < this.data.length && this.compare(this.data[right], this.data[left]) < 0) best = right;
        if (this.compare(this.data[best], this.data[i]) >= 0) break;
        [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
        i = best;
      }
    }
    return top;
  }
}
```
A compact, generic binary heap for Top-$K$ elements and Dijkstra's algorithm since standard JavaScript lacks a built-in PriorityQueue.

## Frequency Maps & Graph Adjacency Lists
```typescript
const counts = new Map<number, number>();
for (const x of nums) {
  counts.set(x, (counts.get(x) ?? 0) + 1);
}

// Adjacency list representation:
const adj = new Map<number, number[]>();
for (const [u, v] of edges) {
  if (!adj.has(u)) adj.set(u, []);
  if (!adj.has(v)) adj.set(v, []);
  adj.get(u)!.push(v);
  adj.get(v)!.push(u); // for undirected graphs
}
```
Manages hash-based frequency tracking and adjacency graphs with typed `Map` instances and default fallbacks.

## Two Pointers & Fast-Slow Pointers
```typescript
// Opposite-ends pointers (Sorted Two-Sum / Palindrome):
let left = 0, right = nums.length - 1;
while (left < right) {
  const sum = nums[left] + nums[right];
  if (sum === target) return [left, right];
  if (sum < target) left++;
  else right--;
}

// Fast & Slow pointers (Cycle detection):
let slow = head, fast = head;
while (fast !== null && fast.next !== null) {
  slow = slow.next!;
  fast = fast.next.next;
  if (slow === fast) return true; // Cycle detected
}
```
Solves subrange and linked list problems in $O(N)$ time without auxiliary heap memory.

## Sliding Window (Dynamic Size)
```typescript
let left = 0;
let maxLen = 0;
const charCounts = new Map<string, number>();

for (let right = 0; right < s.length; right++) {
  const char = s[right];
  charCounts.set(char, (charCounts.get(char) ?? 0) + 1);

  // Shrink window while invalid:
  while (!isValidWindow(charCounts)) {
    const leftChar = s[left];
    charCounts.set(leftChar, charCounts.get(leftChar)! - 1);
    if (charCounts.get(leftChar) === 0) charCounts.delete(leftChar);
    left++;
  }

  maxLen = Math.max(maxLen, right - left + 1);
}
```
Expands right and contracts left to find longest or shortest substrings in linear amortized time.

## Monotonic Stack (Next Greater Element)
```typescript
const n = nums.length;
const result = new Array(n).fill(-1);
const stack: number[] = []; // Indices of decreasing elements

for (let i = 0; i < n; i++) {
  while (stack.length > 0 && nums[i] > nums[stack[stack.length - 1]]) {
    const poppedIdx = stack.pop()!;
    result[poppedIdx] = nums[i];
  }
  stack.push(i);
}
```
Maintains a monotonically decreasing stack of indices to resolve nearest greater elements in $O(N)$ total time.

## 2D Matrix Allocation & Traversal
```typescript
const R = grid.length;
const C = grid[0].length;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // Right, Down, Left, Up

// Safe 2D array allocation (Avoid new Array(R).fill(new Array(C)) !):
const visited: boolean[][] = Array.from({ length: R }, () => new Array(C).fill(false));

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < R && c >= 0 && c < C;
}

for (const [dr, dc] of DIRS) {
  const nr = r + dr, nc = c + dc;
  if (inBounds(nr, nc) && !visited[nr][nc]) {
    visited[nr][nc] = true;
  }
}
```
Avoids shared sub-array reference bugs and explores 2D grid coordinates safely.

## Disjoint Set Union (DSU / Union-Find)
```typescript
class DSU {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(i: number): number {
    if (this.parent[i] !== i) {
      this.parent[i] = this.find(this.parent[i]); // Path compression
    }
    return this.parent[i];
  }

  union(i: number, j: number): boolean {
    let rootI = this.find(i);
    let rootJ = this.find(j);
    if (rootI === rootJ) return false;

    if (this.rank[rootI] < this.rank[rootJ]) [rootI, rootJ] = [rootJ, rootI];
    this.parent[rootJ] = rootI;
    if (this.rank[rootI] === this.rank[rootJ]) this.rank[rootI]++;
    return true;
  }
}
```
Maintains connected components with near $O(1)$ amortized operations for Kruskal's MST and cycle detection.

## Backtracking Template
```typescript
function subsets(nums: number[]): number[][] {
  const results: number[][] = [];
  const current: number[] = [];

  function backtrack(startIdx: number): void {
    results.push([...current]); // Snapshot shallow copy

    for (let i = startIdx; i < nums.length; i++) {
      current.push(nums[i]); // Choose
      backtrack(i + 1);      // Explore
      current.pop();         // Undo
    }
  }

  backtrack(0);
  return results;
}
```
Explores combinations, permutations, and power sets by recursing forward and undoing state mutations.

## Bit Manipulation & 32-Bit Truncation
```typescript
// Check power of two:
const isPowerOfTwo = (x > 0) && ((x & (x - 1)) === 0);

// Isolate lowest set bit:
const lowestBit = x & -x;

// Count set bits (Brian Kernighan):
function countSetBits(n: number): number {
  let count = 0;
  while (n !== 0) {
    n &= (n - 1);
    count++;
  }
  return count;
}

// Convert signed 32-bit to unsigned 32-bit:
const unsignedVal = signedVal >>> 0;
```
Manipulates bit flags and handles JavaScript's 32-bit signed bitwise coercion rules.
