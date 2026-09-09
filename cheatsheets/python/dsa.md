---
language: python
badge: py
aliases: [py, python, dsa]
---

## Binary Search (Bisect & Custom Predicate)
```python
import bisect

# Standard library binary search:
idx = bisect.bisect_left(nums, target)   # First index where num >= target
idx = bisect.bisect_right(nums, target)  # First index where num > target

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
Finds insertion points and boundaries in sorted ranges in $O(\log N)$ time, avoiding integer overflow.

## Queue & BFS with Deque
```python
from collections import deque

queue = deque([(start_node, 0)]) # (node, distance)
visited = {start_node}

while queue:
    node, dist = queue.popleft() # O(1) popleft, unlike list.pop(0) which is O(N)
    if node == target:
        break
    for neighbor in graph[node]:
        if neighbor not in visited:
            visited.add(neighbor)
            queue.append((neighbor, dist + 1))
```
Implements Breadth-First Search for shortest paths on unweighted graphs and trees using an $O(1)$ double-ended queue.

## Min-Heap and Max-Heap (heapq)
```python
import heapq

# Min-heap by default:
heap = [5, 1, 8, 3]
heapq.heapify(heap)           # O(N) linear time heap construction
heapq.heappush(heap, 2)       # O(log N) insert
smallest = heapq.heappop(heap) # O(log N) extract min

# Max-heap trick (negate values):
max_heap = []
heapq.heappush(max_heap, -val)
largest = -heapq.heappop(max_heap)

# Top-K elements:
top_k = heapq.nlargest(k, items)
```
Maintains priority order in $O(\log N)$ per insertion/removal using Python's min-heap module.

## Frequency Counting & Grouping
```python
from collections import Counter, defaultdict

# Frequency counts:
counts = Counter("abracadabra")
top_two = counts.most_common(2) # [('a', 5), ('b', 2)]

# Adjacency list / grouping without KeyError:
adj = defaultdict(list)
adj[u].append(v)

freq = defaultdict(int)
freq[x] += 1
```
Tracks counts and constructs graph adjacency structures without manually initializing missing dictionary keys.

## Two Pointers & Fast-Slow Pointers
```python
# Opposite-end pointers (sorted Two-Sum / Palindrome):
left, right = 0, len(nums) - 1
while left < right:
    curr_sum = nums[left] + nums[right]
    if curr_sum == target:
        return [left, right]
    elif curr_sum < target:
        left += 1
    else:
        right -= 1

# Fast & slow pointer (Linked List cycle / middle node):
slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
    if slow == fast:
        return True # Cycle detected
```
Traverses sequences with two coordinating indices in $O(N)$ time and $O(1)$ auxiliary space.

## Sliding Window (Variable Length)
```python
left = 0
window_state = Counter()
best = 0

for right, val in enumerate(nums):
    window_state[val] += 1
    
    # Contract invalid window from left:
    while not is_valid(window_state):
        window_state[nums[left]] -= 1
        if window_state[nums[left]] == 0:
            del window_state[nums[left]]
        left += 1
        
    best = max(best, right - left + 1)
```
Maintains a contiguous subarray or substring matching dynamic criteria in amortized $O(N)$ time.

## Monotonic Stack (Next Greater Element)
```python
# Next Greater Element to the right:
n = len(nums)
result = [-1] * n
stack = [] # Stores indices with descending values

for i in range(n):
    while stack and nums[i] > nums[stack[-1]]:
        prev_idx = stack.pop()
        result[prev_idx] = nums[i]
    stack.append(i)
```
Resolves nearest smaller or larger element queries in linear $O(N)$ time using a monotonic stack.

## 2D Grid Traversal & Directions
```python
R, C = len(grid), len(grid[0])
DIRECTIONS = [(0, 1), (1, 0), (0, -1), (-1, 0)] # Right, Down, Left, Up

def in_bounds(r, c):
    return 0 <= r < R and 0 <= c < C

# Safe 2D matrix allocation:
visited = [[False] * C for _ in range(R)] # Avoid [[False] * C] * R (shares row references!)

for dr, dc in DIRECTIONS:
    nr, nc = r + dr, c + dc
    if in_bounds(nr, nc) and not visited[nr][nc]:
        visited[nr][nc] = True
```
Navigates 2D matrices cleanly with directional delta vectors and boundary guards.

## Backtracking Template
```python
import sys
sys.setrecursionlimit(200_000) # Required for deep recursion trees

def backtrack(start_idx, current_path):
    if is_solution(current_path):
        results.append(list(current_path)) # Append shallow copy
        return
        
    for i in range(start_idx, len(candidates)):
        if not is_promising(candidates[i]):
            continue
        current_path.append(candidates[i]) # Make choice
        backtrack(i + 1, current_path)     # Explore
        current_path.pop()                 # Undo choice
```
Explores combinatorial state spaces (subsets, permutations, combination sums) with forward choices and state rollbacks.

## Disjoint Set Union (DSU / Union-Find)
```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, i):
        if self.parent[i] != i:
            self.parent[i] = self.find(self.parent[i]) # Path compression
        return self.parent[i]

    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            if self.rank[root_i] < self.rank[root_j]:
                root_i, root_j = root_j, root_i
            self.parent[root_j] = root_i
            if self.rank[root_i] == self.rank[root_j]:
                self.rank[root_i] += 1
            return True
        return False
```
Tracks partitioned sets with near $O(1)$ amortized operations for Kruskal's MST, cycle detection, and connectivity queries.

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
Decorates recursive top-down recurrence relations with automatic LRU memoization to avoid redundant subproblem calculations.

## Bit Manipulation Tricks
```python
# Check if power of two:
is_power_of_two = (x > 0) and (x & (x - 1) == 0)

# Isolate lowest set bit:
lowest_bit = x & -x

# Clear lowest set bit:
cleared = x & (x - 1)

# Count set bits:
count = x.bit_count() # Python 3.10+

# Iterate through all subsets of size n:
for mask in range(1 << n):
    subset = [items[i] for i in range(n) if (mask & (1 << i))]
```
Performs lightning-fast bitwise math and subset bitmasking for state compression and bit-level DP.
