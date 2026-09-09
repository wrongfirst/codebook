---
language: c
badge: c
aliases: [c, dsa]
---

## Safe Sorting & Searching (qsort and bsearch)
```c
#include <stdlib.h>

// PITFALL: Avoid (arg1 - arg2) which can overflow on INT_MIN / INT_MAX!
int cmp_ints(const void *a, const void *b) {
    int x = *(const int *)a;
    int y = *(const int *)b;
    return (x > y) - (x < y); // Returns -1, 0, or 1 safely
}

// In-place sort:
qsort(arr, n, sizeof(int), cmp_ints);

// Binary search with stdlib:
int key = 42;
int *found = bsearch(&key, arr, n, sizeof(int), cmp_ints);
if (found != NULL) {
    int index = found - arr; // Pointer subtraction gives 0-based index
}
```
Sorts and searches contiguous arrays with standard library functions while preventing integer overflow bugs in comparators.

## Binary Search Boundary Template [left, right)
```c
int left = 0, right = n;
while (left < right) {
    int mid = left + (right - left) / 2; // Prevents overflow: left + right
    if (condition(mid)) {
        right = mid;     // Target is at or to the left of mid
    } else {
        left = mid + 1;  // Target is strictly to the right
    }
}
return left; // First index where condition is true
```
Implements custom predicate search over sorted arrays or monotonic answer spaces without off-by-one errors.

## Dynamic Array & Stack (LIFO)
```c
typedef struct {
    int *data;
    size_t size;
    size_t cap;
} IntVector;

void vec_push(IntVector *v, int val) {
    if (v->size == v->cap) {
        v->cap = v->cap == 0 ? 8 : v->cap * 2;
        v->data = realloc(v->data, v->cap * sizeof(int));
    }
    v->data[v->size++] = val;
}

int vec_pop(IntVector *v) {
    return v->data[--v->size]; // Stack pop
}
```
Constructs an expandable contiguous buffer supporting $O(1)$ amortized push and pop operations.

## Circular Queue (FIFO for BFS)
```c
typedef struct {
    int *data;
    int front, rear, count, cap;
} Queue;

Queue* q_create(int capacity) {
    Queue *q = malloc(sizeof(Queue));
    q->cap = capacity;
    q->data = malloc(capacity * sizeof(int));
    q->front = 0; q->rear = -1; q->count = 0;
    return q;
}

void q_push(Queue *q, int val) {
    q->rear = (q->rear + 1) % q->cap;
    q->data[q->rear] = val;
    q->count++;
}

int q_pop(Queue *q) {
    int val = q->data[q->front];
    q->front = (q->front + 1) % q->cap;
    q->count--;
    return val;
}
```
Implements a ring buffer queue with wrap-around modulo arithmetic for BFS without memory shifts.

## Singly Linked List Reversal
```c
typedef struct ListNode {
    int val;
    struct ListNode *next;
} ListNode;

ListNode* reverse_list(ListNode *head) {
    ListNode *prev = NULL;
    ListNode *curr = head;
    while (curr != NULL) {
        ListNode *next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev; // New head
}
```
Reverses a singly linked list iteratively in $O(N)$ time and $O(1)$ auxiliary space.

## Binary Tree Traversal & Depth
```c
typedef struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

int max_depth(const TreeNode *root) {
    if (root == NULL) return 0;
    int left = max_depth(root->left);
    int right = max_depth(root->right);
    return 1 + (left > right ? left : right);
}
```
Defines binary tree structures and recursively computes heights or performs in-order / pre-order depth-first traversals.

## 2D Grid Allocation & Directions
```c
int R = 10, C = 20;

// Dynamic 2D matrix allocation:
int **visited = malloc(R * sizeof(int*));
for (int i = 0; i < R; i++) {
    visited[i] = calloc(C, sizeof(int)); // Zero-initialized
}

// 4-directional moves: Right, Down, Left, Up
const int dr[] = {0, 1, 0, -1};
const int dc[] = {1, 0, -1, 0};

for (int d = 0; d < 4; d++) {
    int nr = r + dr[d], nc = c + dc[d];
    if (nr >= 0 && nr < R && nc >= 0 && nc < C && !visited[nr][nc]) {
        visited[nr][nc] = 1;
    }
}
```
Manages 2D arrays with contiguous rows and navigates grid neighbors using bounded coordinate offsets.

## Disjoint Set Union (DSU / Union-Find)
```c
int parent[MAX_NODES];
int rank_val[MAX_NODES];

void dsu_init(int n) {
    for (int i = 0; i < n; i++) {
        parent[i] = i;
        rank_val[i] = 0;
    }
}

int dsu_find(int i) {
    if (parent[i] != i)
        parent[i] = dsu_find(parent[i]); // Path compression
    return parent[i];
}

int dsu_union(int i, int j) {
    int root_i = dsu_find(i), root_j = dsu_find(j);
    if (root_i == root_j) return 0;
    if (rank_val[root_i] < rank_val[root_j]) {
        int tmp = root_i; root_i = root_j; root_j = tmp;
    }
    parent[root_j] = root_i;
    if (rank_val[root_i] == rank_val[root_j]) rank_val[root_i]++;
    return 1;
}
```
Tracks connected components and detects cycles using static arrays with path compression.

## Min-Heap in Array
```c
void heapify_up(int *heap, int i) {
    while (i > 0) {
        int p = (i - 1) / 2;
        if (heap[i] >= heap[p]) break;
        int tmp = heap[i]; heap[i] = heap[p]; heap[p] = tmp;
        i = p;
    }
}

void heapify_down(int *heap, int n, int i) {
    while (2 * i + 1 < n) {
        int left = 2 * i + 1, right = 2 * i + 2, best = left;
        if (right < n && heap[right] < heap[left]) best = right;
        if (heap[i] <= heap[best]) break;
        int tmp = heap[i]; heap[i] = heap[best]; heap[best] = tmp;
        i = best;
    }
}
```
Implements min-heap restoration procedures on contiguous arrays for priority queue operations.

## Bit Manipulation Tricks
```c
// Check power of two:
int is_pow2 = (x > 0) && !(x & (x - 1));

// Isolate lowest set bit:
int lowest = x & -x;

// Builtin popcount (GCC / Clang):
int set_bits = __builtin_popcount(x);

// Bitmask subset iteration:
for (int mask = 0; mask < (1 << n); mask++) {
    for (int i = 0; i < n; i++) {
        if (mask & (1 << i)) {
            // item i is included in this subset
        }
    }
}
```
Performs fast bitwise arithmetic, power-of-two tests, and subset iterations using bitmasks.
