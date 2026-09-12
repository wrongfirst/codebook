---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus]
---

## std::array (Fixed-Size Stack Array)
```cpp
#include <array>
#include <utility>

// Zero-overhead stack-allocated fixed array:
std::array<int, 4> arr = {10, 20, 30, 40};

size_t len = arr.size();     // Compile-time known length
int first = arr.front();
int safe = arr.at(2);        // Bounds-checked access (throws std::out_of_range)

// constexpr array (ideal for lookup tables & grid directions):
constexpr std::array<std::pair<int, int>, 4> DIRS = {{{0, 1}, {1, 0}, {0, -1}, {-1, 0}}};
```
Safe, zero-overhead fixed-capacity sequence container stored directly on the stack with standard STL container member interfaces.

## Vector & Dynamic Sizing
```cpp
#include <string>
#include <utility>
#include <vector>

std::vector<std::pair<int, std::string>> items;
items.reserve(100); // Pre-allocates buffer to prevent reallocation overhead

// push_back copies or moves an existing object:
items.push_back({1, "apple"});

// emplace_back forwards constructor arguments, constructing element in-place:
items.emplace_back(2, "banana");

bool empty = items.empty();
size_t size = items.size();
items.pop_back(); // O(1) amortized removal
```
Dynamically resizable contiguous array with $O(1)$ amortized insertions, contrasting copy/move-based `push_back` with in-place `emplace_back`.

## 2D Matrix Allocation
```cpp
#include <vector>

int R = 4, C = 5;
// Initialize R rows of C columns filled with 0:
std::vector<std::vector<int>> grid(R, std::vector<int>(C, 0));

// Jagged/custom row sizes:
std::vector<std::vector<int>> adj(n); // Empty vectors for graph adjacency list
```
Allocates contiguous 2D vector arrays safely with specified dimensions and initial default values.

## Iterators & Range Navigation
```cpp
#include <iterator>
#include <vector>

std::vector<int> nums = {10, 20, 30, 40, 50};

// Forward and reverse iterator endpoints:
auto it = nums.begin();              // Points to first element (10)
auto rit = nums.rbegin();            // Points to last element (50)

// Safe iterator movement without raw pointer arithmetic:
auto second = std::next(it);         // Advances 1 step (points to 20)
auto prior = std::prev(nums.end());  // Points to last element (50)
std::advance(it, 3);                 // Advances 'it' in-place by 3 steps
```
Provides uniform traversal abstractions across STL containers with forward, bidirectional, and random-access iterator operations.

## Hash Maps & Sets (unordered_map, unordered_set)
```cpp
#include <iostream>
#include <string>
#include <unordered_map>
#include <unordered_set>

std::unordered_map<std::string, int> counts;
counts["apple"] = 5;
counts.insert_or_assign("banana", 2);

// Check presence without inserting default (C++20 .contains or .find):
if (counts.contains("apple")) {
    std::cout << counts["apple"] << '\n';
}

std::unordered_set<int> seen;
seen.insert(42);
if (seen.contains(42)) { /* exists (C++20) */ }
// Pre-C++20 fallback:
if (seen.count(42)) { /* exists */ }
```
Average $O(1)$ key-value associations and uniqueness tracking backed by hash tables, using modern C++20 `.contains()` for expressive membership tests.

## Ordered Maps & Sets (map, set)
```cpp
#include <map>
#include <set>

std::set<int> s = {10, 20, 30, 40};

// C++20 presence check:
bool exists = s.contains(20);

// O(log N) container lower_bound / upper_bound:
auto it = s.lower_bound(25); // Points to 30 (first element >= 25)
if (it != s.end()) {
    int val = *it;
}
```
Red-black tree backed ordered containers maintaining elements in sorted order with $O(\log N)$ insertions, searches, and range queries.

## Stacks, Queues & Deques
```cpp
#include <stack>
#include <queue>
#include <deque>

std::stack<int> st;
st.push(1); int top = st.top(); st.pop();

std::queue<int> q;
q.push(1); int front = q.front(); q.pop();

std::deque<int> dq;
dq.push_front(0); // O(1) push left
dq.push_back(1);  // O(1) push right
dq.pop_front();   // O(1) pop left
dq.pop_back();    // O(1) pop right
```
Sequential container adapters providing LIFO (stack), FIFO (queue), and double-ended (deque) operations in $O(1)$ time.

## Priority Queue: Min-Heap vs Max-Heap
```cpp
#include <queue>
#include <vector>

// Max-Heap by default:
std::priority_queue<int> max_heap;
max_heap.push(10);
int top_max = max_heap.top(); max_heap.pop();

// Min-Heap (requires std::greater comparator):
std::priority_queue<int, std::vector<int>, std::greater<int>> min_heap;
min_heap.push(10);
int top_min = min_heap.top(); min_heap.pop();

// Min-Heap of custom pairs {distance, node}:
using pii = std::pair<int, int>;
std::priority_queue<pii, std::vector<pii>, std::greater<pii>> pq;
```
Maintains priority ordering in $O(\log N)$ time per insertion and extraction via binary heap.

## Monotonic Stack (Next Greater Element)
```cpp
#include <stack>
#include <vector>

int n = nums.size();
std::vector<int> result(n, -1);
std::stack<int> st; // Stores indices of elements in descending value order

for (int i = 0; i < n; ++i) {
    while (!st.empty() && nums[i] > nums[st.top()]) {
        result[st.top()] = nums[i];
        st.pop();
    }
    st.push(i);
}
```
Identifies the nearest greater or smaller element for every array index in amortized $O(N)$ linear time.

## Disjoint Set Union (DSU / Union-Find)
```cpp
#include <vector>
#include <numeric>

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
Tracks partitioned subsets with near $O(1)$ operations using path compression and union by rank.

## Trie (Prefix Tree with Smart Pointers)
```cpp
#include <memory>
#include <string>

struct TrieNode {
    std::unique_ptr<TrieNode> children[26];
    bool is_end = false;
};

void insert(TrieNode& root, const std::string& word) {
    TrieNode* curr = &root;
    for (char ch : word) {
        int idx = ch - 'a';
        if (!curr->children[idx]) {
            curr->children[idx] = std::make_unique<TrieNode>();
        }
        curr = curr->children[idx].get();
    }
    curr->is_end = true;
}
```
Stores strings in a tree structure for $O(L)$ prefix lookups, using `std::unique_ptr` for automatic leak-free memory reclamation.
