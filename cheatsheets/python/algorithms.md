---
language: python
badge: py
aliases: [py, python]
---

## Generators & yield
```python
# Generator function: yields values lazily instead of building a full list
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

fib = fibonacci()
print(next(fib), next(fib), next(fib))  # 0 1 1

# Generator expression (like a list comprehension, but lazy):
even_squares = (x**2 for x in range(100) if x % 2 == 0)

# yield from: delegate to a sub-generator
def flatten(nested):
    for sublist in nested:
        yield from sublist

list(flatten([[1, 2], [3, 4]]))  # [1, 2, 3, 4]
```
Generators produce values lazily, one at a time, without materializing the full sequence in memory. Use generator expressions in place of list comprehensions whenever you only need to iterate once or feed another function (e.g., `sum`, `any`, `all`).

## itertools
```python
import itertools

# Cartesian product (nested loops):
for r, c in itertools.product(range(3), range(3)):
    pass

# Combinations and permutations:
list(itertools.combinations([1, 2, 3], 2))   # [(1,2),(1,3),(2,3)]
list(itertools.permutations([1, 2, 3], 2))   # [(1,2),(1,3),(2,1),...]

# Chain multiple iterables into one:
all_items = list(itertools.chain([1, 2], [3, 4], [5]))  # [1,2,3,4,5]

# Running totals (prefix sums):
prefix = list(itertools.accumulate([1, 2, 3, 4]))       # [1, 3, 6, 10]

# Group consecutive equal elements:
for key, group in itertools.groupby("AAABBC"):
    print(key, list(group))   # A ['A','A','A'], B ['B','B'], C ['C']
```
`itertools` provides fast, memory-efficient combinatorial and sequence utilities implemented in C. Prefer `itertools.combinations`/`product` over manual bitmask enumeration for Pythonic subset iteration.


## Binary Search (Bisect & Monotonic Predicate)
```python
import bisect

# Standard library binary search on sorted sequences:
idx_ge = bisect.bisect_left(nums, target)   # First index where num >= target
idx_gt = bisect.bisect_right(nums, target)  # First index where num > target

# Custom monotonic predicate template [left, right):
left, right = 0, len(nums)
while left < right:
    mid = left + (right - left) // 2
    if condition(mid):
        right = mid      # Target is at or to the left of mid
    else:
        left = mid + 1   # Target is strictly to the right
return left
```
Finds boundaries and insertion points in monotonic spaces in $O(\log N)$ time.

## Two Pointers & Fast-Slow Pointers
```python
# Opposite-end pointers (sorted arrays, palindromes):
left, right = 0, len(nums) - 1
while left < right:
    curr_sum = nums[left] + nums[right]
    if curr_sum == target:
        return [left, right]
    elif curr_sum < target:
        left += 1
    else:
        right -= 1

# Fast & slow pointers (Linked List cycle detection / middle node):
slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
    if slow == fast:
        return True # Cycle detected
```
Traverses sequences with two coordinating indices in $O(N)$ time and $O(1)$ auxiliary memory.

## Sliding Window (Dynamic & Fixed Length)
```python
# Dynamic-length window:
left = 0
window_state = Counter()
best = 0

for right, val in enumerate(nums):
    window_state[val] += 1
    
    while not is_valid(window_state):
        window_state[nums[left]] -= 1
        if window_state[nums[left]] == 0:
            del window_state[nums[left]]
        left += 1
        
    best = max(best, right - left + 1)
```
Maintains a contiguous subarray or substring matching dynamic criteria in amortized $O(N)$ time.

## Breadth-First Search (BFS)
```python
from collections import deque

queue = deque([(start_node, 0)]) # (node, distance)
visited = {start_node}

while queue:
    node, dist = queue.popleft()
    if node == target:
        break
    for neighbor in graph[node]:
        if neighbor not in visited:
            visited.add(neighbor)
            queue.append((neighbor, dist + 1))
```
Finds the shortest path on unweighted graphs in $O(V + E)$ time.

## 2D Grid Traversal & Directions
```python
R, C = len(grid), len(grid[0])
DIRECTIONS = [(0, 1), (1, 0), (0, -1), (-1, 0)] # Right, Down, Left, Up

def in_bounds(r, c):
    return 0 <= r < R and 0 <= c < C

visited = {(start_r, start_c)}

for dr, dc in DIRECTIONS:
    nr, nc = r + dr, c + dc
    if in_bounds(nr, nc) and (nr, nc) not in visited:
        visited.add((nr, nc))
```
Explores adjacent orthogonal or diagonal cells safely within matrix boundaries in $O(R \times C)$ time.

## Dijkstra's Shortest Path
```python
import heapq

dist = {node: float('inf') for node in graph}
dist[src] = 0
pq = [(0, src)] # (distance, node)

while pq:
    curr_d, u = heapq.heappop(pq)
    if curr_d > dist[u]:
        continue

    for v, weight in graph[u]:
        if dist[u] + weight < dist[v]:
            dist[v] = dist[u] + weight
            heapq.heappush(pq, (dist[v], v))
```
Computes single-source shortest paths on non-negative weighted graphs in $O((V + E) \log V)$ time.

## Topological Sort (Kahn's Algorithm)
```python
from collections import deque

in_degree = [0] * n
for u in graph:
    for v in graph[u]:
        in_degree[v] += 1

queue = deque([i for i in range(n) if in_degree[i] == 0])
topo_order = []

while queue:
    u = queue.popleft()
    topo_order.append(u)
    for v in graph[u]:
        in_degree[v] -= 1
        if in_degree[v] == 0:
            queue.append(v)

# If len(topo_order) < n, graph contains a directed cycle
```
Computes a linear ordering of vertices in a Directed Acyclic Graph (DAG) and detects cycles in $O(V + E)$ time.

## Backtracking Template
```python
def backtrack(start_idx, current_path):
    if is_solution(current_path):
        results.append(list(current_path))
        return
        
    for i in range(start_idx, len(candidates)):
        if not is_promising(candidates[i]):
            continue
        current_path.append(candidates[i]) # Choose
        backtrack(i + 1, current_path)     # Explore
        current_path.pop()                 # Unchoose
```
Explores combinatorial state spaces (subsets, combinations, permutations) with choice exploration and state rollback.

## Dynamic Programming Memoization (@cache)
```python
from functools import cache

@cache
def dp(i, rem_weight):
    if i == len(items) or rem_weight <= 0:
        return 0
    # Choice 1: Skip item
    ans = dp(i + 1, rem_weight)
    # Choice 2: Take item (if capacity permits)
    val, wt = items[i]
    if rem_weight >= wt:
        ans = max(ans, val + dp(i + 1, rem_weight - wt))
    return ans
```
Decorates recursive top-down recurrence relations with automatic subproblem memoization.
