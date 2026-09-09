---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus, dsa]
---

## Fast I/O and Type Aliases
```cpp
#include <iostream>
#include <vector>
#include <numeric>

using ll = long long;
constexpr int INF = 1e9 + 7;

int main() {
    // Untie C++ streams from C stdio for fast competitive I/O:
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);
    return 0;
}
```
Disables stream synchronization to dramatically accelerate input/output throughput in competitive programming.

## Priority Queue: Min-Heap vs Max-Heap
```cpp
#include <queue>

// Max-Heap by default:
std::priority_queue<int> max_heap;
max_heap.push(10);
int top_val = max_heap.top(); max_heap.pop();

// Min-Heap (requires vector and std::greater comparator):
std::priority_queue<int, std::vector<int>, std::greater<int>> min_heap;
min_heap.push(10);

// Min-Heap of custom structs / pairs:
using pii = std::pair<int, int>; // {dist, node}
std::priority_queue<pii, std::vector<pii>, std::greater<pii>> pq;
```
Maintains order in $O(\log N)$ time, highlighting the container adapter syntax required for min-heaps.

## Binary Search (lower_bound & upper_bound)
```cpp
#include <algorithm>

// Vector binary search (requires sorted container):
auto it1 = std::lower_bound(nums.begin(), nums.end(), target); // first element >= target
auto it2 = std::upper_bound(nums.begin(), nums.end(), target); // first element > target
int idx = it1 - nums.begin();

// Custom predicate boundary template [left, right):
int left = 0, right = n;
while (left < right) {
    int mid = left + (right - left) / 2;
    if (check(mid)) right = mid;
    else left = mid + 1;
}

// CRITICAL PITFALL for std::set:
// Use s.lower_bound(x) (O(log N)), NOT std::lower_bound(s.begin(), s.end(), x) (O(N)!)
```
Locates range boundaries and search thresholds with correct iterator arithmetic and container method choices.

## Queue & BFS Graph Traversal
```cpp
#include <queue>
#include <vector>

std::vector<std::vector<int>> adj(n); // Adjacency list
std::vector<int> dist(n, -1);
std::queue<int> q;

q.push(start);
dist[start] = 0;

while (!q.empty()) {
    int u = q.front(); q.pop();
    for (int v : adj[u]) {
        if (dist[v] == -1) {
            dist[v] = dist[u] + 1;
            q.push(v);
        }
    }
}
```
Traverses unweighted graphs and computes shortest hop distances in $O(V + E)$ time.

## Monotonic Stack (Next Greater Element)
```cpp
#include <stack>
#include <vector>

int n = nums.size();
std::vector<int> result(n, -1);
std::stack<int> st; // Indices of elements in descending order

for (int i = 0; i < n; ++i) {
    while (!st.empty() && nums[i] > nums[st.top()]) {
        result[st.top()] = nums[i];
        st.pop();
    }
    st.push(i);
}
```
Identifies the nearest greater element for each index in linear $O(N)$ amortized time.

## 2D Grid Navigation & Matrix Allocation
```cpp
int R = grid.size(), C = grid[0].size();
std::vector<std::vector<bool>> visited(R, std::vector<bool>(C, false));

// 4-directional moves: Right, Down, Left, Up
const int dr[] = {0, 1, 0, -1};
const int dc[] = {1, 0, -1, 0};

auto in_bounds = [&](int r, int c) {
    return r >= 0 && r < R && c >= 0 && c < C;
};

for (int d = 0; d < 4; ++d) {
    int nr = r + dr[d], nc = c + dc[d];
    if (in_bounds(nr, nc) && !visited[nr][nc]) {
        visited[nr][nc] = true;
    }
}
```
Allocates 2D vectors and traverses grid neighbors with compact directional delta arrays.

## Disjoint Set Union (DSU / Union-Find)
```cpp
struct DSU {
    std::vector<int> parent, rank;
    DSU(int n) : parent(n), rank(n, 0) {
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int i) {
        return parent[i] == i ? i : (parent[i] = find(parent[i])); // Path compression
    }
    bool unite(int i, int j) {
        int root_i = find(i), root_j = find(j);
        if (root_i == root_j) return false;
        if (rank[root_i] < rank[root_j]) std::swap(root_i, root_j);
        parent[root_j] = root_i;
        if (rank[root_i] == rank[root_j]) rank[root_i]++;
        return true;
    }
};
```
Tracks partitioned subsets with near $O(1)$ amortized operations using path compression and union by rank.

## Dijkstra's Shortest Path Algorithm
```cpp
using pii = std::pair<int, int>; // {dist, u}
std::vector<int> dist(n, INF);
std::priority_queue<pii, std::vector<pii>, std::greater<pii>> pq;

dist[src] = 0;
pq.push({0, src});

while (!pq.empty()) {
    auto [d, u] = pq.top(); pq.pop();
    if (d > dist[u]) continue; // Skip outdated paths

    for (auto& [v, weight] : adj[u]) {
        if (dist[u] + weight < dist[v]) {
            dist[v] = dist[u] + weight;
            pq.push({dist[v], v});
        }
    }
}
```
Finds single-source shortest paths on non-negative weighted graphs in $O((V + E) \log V)$ time.

## Topological Sort (Kahn's Algorithm)
```cpp
std::vector<int> in_degree(n, 0);
for (int u = 0; u < n; ++u)
    for (int v : adj[u]) in_degree[v]++;

std::queue<int> q;
for (int i = 0; i < n; ++i)
    if (in_degree[i] == 0) q.push(i);

std::vector<int> topo_order;
while (!q.empty()) {
    int u = q.front(); q.pop();
    topo_order.push_back(u);
    for (int v : adj[u])
        if (--in_degree[v] == 0) q.push(v);
}
// If topo_order.size() < n, graph contains a cycle!
```
Linearly orders vertices of a Directed Acyclic Graph (DAG) and detects cycles using an in-degree queue.

## Trie (Prefix Tree)
```cpp
struct TrieNode {
    TrieNode* children[26] = {};
    bool is_end = false;
};

void insert(TrieNode* root, const std::string& word) {
    TrieNode* curr = root;
    for (char ch : word) {
        int idx = ch - 'a';
        if (!curr->children[idx]) curr->children[idx] = new TrieNode();
        curr = curr->children[idx];
    }
    curr->is_end = true;
}
```
Stores strings in a prefix tree to query word prefixes and dictionary keys in $O(L)$ time.

## Builtin Bit Intrinsics & Bitmasking
```cpp
int x = 42;

// GCC / Clang bit intrinsics:
int count = __builtin_popcount(x);    // Number of set bits (use __builtin_popcountll for long long)
int lz = __builtin_clz(x);            // Leading zeros
int tz = __builtin_ctz(x);            // Trailing zeros

// Bit manipulation tricks:
bool is_pow2 = (x > 0) && !(x & (x - 1));
int lowest_bit = x & -x;

// Iterate through all subsets of mask:
for (int sub = mask; sub > 0; sub = (sub - 1) & mask) {
    // sub is a non-empty submask of mask
}
```
Leverages compiler intrinsics and submask iteration idioms for competitive bitmask DP.
