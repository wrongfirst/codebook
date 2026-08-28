#ifndef _CODEBOOK_HARNESS_C_
#define _CODEBOOK_HARNESS_C_

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <limits.h>

/* ========================================================================== */
/* 1. Data Structures                                                         */
/* ========================================================================== */

typedef struct ListNode {
    int val;
    struct ListNode *next;
} ListNode;

typedef struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

typedef struct Node {
    int val;
    int numNeighbors;
    struct Node **neighbors;
} Node;

typedef struct Interval {
    int start;
    int end;
} Interval;

/* ========================================================================== */
/* 2. Helper Functions - Memory & Builders                                    */
/* ========================================================================== */

static inline ListNode* create_list_node(int val) {
    ListNode* node = (ListNode*)malloc(sizeof(ListNode));
    node->val = val;
    node->next = NULL;
    return node;
}

static inline TreeNode* create_tree_node(int val) {
    TreeNode* node = (TreeNode*)malloc(sizeof(TreeNode));
    node->val = val;
    node->left = NULL;
    node->right = NULL;
    return node;
}

static inline int* make_int(int v) {
    int* ptr = (int*)malloc(sizeof(int));
    *ptr = v;
    return ptr;
}

ListNode* list_to_linked_list(const int* arr, int len) {
    if (!arr || len <= 0) return NULL;
    ListNode* head = create_list_node(arr[0]);
    ListNode* curr = head;
    for (int i = 1; i < len; i++) {
        curr->next = create_list_node(arr[i]);
        curr = curr->next;
    }
    return head;
}

int* linked_list_to_list(const ListNode* head, int* out_len) {
    if (!out_len) return NULL;
    if (!head) {
        *out_len = 0;
        return (int*)malloc(sizeof(int) * 1);
    }

    // Safety limit to detect cycles up to 10000 nodes
    const int MAX_NODES = 10000;
    int* res = (int*)malloc(sizeof(int) * MAX_NODES);
    const ListNode** visited = (const ListNode**)malloc(sizeof(const ListNode*) * MAX_NODES);
    int count = 0;

    const ListNode* curr = head;
    while (curr && count < MAX_NODES) {
        bool cycle = false;
        for (int i = 0; i < count; i++) {
            if (visited[i] == curr) {
                cycle = true;
                break;
            }
        }
        if (cycle) break;

        visited[count] = curr;
        res[count] = curr->val;
        count++;
        curr = curr->next;
    }

    free(visited);
    *out_len = count;
    return res;
}

ListNode* make_cycle(const int* arr, int len, int pos) {
    ListNode* head = list_to_linked_list(arr, len);
    if (pos < 0 || !head) return head;

    ListNode* tail = head;
    ListNode* target = NULL;
    int idx = 0;
    while (tail) {
        if (idx == pos) {
            target = tail;
        }
        if (!tail->next) break;
        tail = tail->next;
        idx++;
    }

    if (tail && target) {
        tail->next = target;
    }
    return head;
}

TreeNode* ints_to_tree(const int* arr, int len) {
    if (!arr || len <= 0) return NULL;
    TreeNode* root = create_tree_node(arr[0]);

    TreeNode** queue = (TreeNode**)malloc(sizeof(TreeNode*) * (len + 1));
    int head = 0, tail = 0;
    queue[tail++] = root;

    int i = 1;
    while (head < tail && i < len) {
        TreeNode* curr = queue[head++];
        if (i < len) {
            curr->left = create_tree_node(arr[i++]);
            queue[tail++] = curr->left;
        }
        if (i < len) {
            curr->right = create_tree_node(arr[i++]);
            queue[tail++] = curr->right;
        }
    }

    free(queue);
    return root;
}

int* tree_to_ints(const TreeNode* root, int* out_len) {
    if (!out_len) return NULL;
    if (!root) {
        *out_len = 0;
        return (int*)malloc(sizeof(int) * 1);
    }

    const int MAX_NODES = 10000;
    const TreeNode** queue = (const TreeNode**)malloc(sizeof(const TreeNode*) * MAX_NODES);
    int* res = (int*)malloc(sizeof(int) * MAX_NODES);
    int head = 0, tail = 0;
    int count = 0;

    queue[tail++] = root;
    while (head < tail && count < MAX_NODES) {
        const TreeNode* curr = queue[head++];
        if (curr) {
            res[count++] = curr->val;
            queue[tail++] = curr->left;
            queue[tail++] = curr->right;
        }
    }

    free(queue);
    *out_len = count;
    return res;
}

TreeNode* list_to_tree(const int** arr, int len) {
    if (!arr || len <= 0 || arr[0] == NULL) return NULL;

    TreeNode* root = create_tree_node(*arr[0]);
    TreeNode** queue = (TreeNode**)malloc(sizeof(TreeNode*) * (len + 1));
    int head = 0, tail = 0;
    queue[tail++] = root;

    int i = 1;
    while (head < tail && i < len) {
        TreeNode* curr = queue[head++];
        if (i < len && arr[i] != NULL) {
            curr->left = create_tree_node(*arr[i]);
            queue[tail++] = curr->left;
        }
        i++;
        if (i < len && arr[i] != NULL) {
            curr->right = create_tree_node(*arr[i]);
            queue[tail++] = curr->right;
        }
        i++;
    }

    free(queue);
    return root;
}

int** tree_to_list(const TreeNode* root, int* out_len) {
    if (!out_len) return NULL;
    if (!root) {
        *out_len = 0;
        return NULL;
    }

    const int MAX_NODES = 10000;
    const TreeNode** queue = (const TreeNode**)malloc(sizeof(const TreeNode*) * MAX_NODES);
    int** res = (int**)malloc(sizeof(int*) * MAX_NODES);
    int head = 0, tail = 0;
    int count = 0;

    queue[tail++] = root;
    while (head < tail && count < MAX_NODES) {
        const TreeNode* curr = queue[head++];
        if (curr) {
            res[count++] = make_int(curr->val);
            queue[tail++] = curr->left;
            queue[tail++] = curr->right;
        } else {
            res[count++] = NULL;
        }
    }

    // Trim trailing NULLs
    while (count > 0 && res[count - 1] == NULL) {
        count--;
    }

    free(queue);
    *out_len = count;
    return res;
}

Node* build_graph(int** adj, const int* col_sizes, int row_size) {
    if (!adj || row_size <= 0) return NULL;

    Node** nodes = (Node**)malloc(sizeof(Node*) * row_size);
    for (int i = 0; i < row_size; i++) {
        nodes[i] = (Node*)malloc(sizeof(Node));
        nodes[i]->val = i + 1;
        nodes[i]->numNeighbors = col_sizes ? col_sizes[i] : 0;
        nodes[i]->neighbors = (Node**)malloc(sizeof(Node*) * (nodes[i]->numNeighbors > 0 ? nodes[i]->numNeighbors : 1));
    }

    for (int i = 0; i < row_size; i++) {
        int n_count = col_sizes ? col_sizes[i] : 0;
        for (int j = 0; j < n_count; j++) {
            int target_val = adj[i][j];
            nodes[i]->neighbors[j] = nodes[target_val - 1];
        }
    }

    Node* start = nodes[0];
    free(nodes);
    return start;
}

/* ========================================================================== */
/* 3. Sorting & Comparison Helpers                                            */
/* ========================================================================== */

static int cmp_ints(const void* a, const void* b) {
    int ia = *(const int*)a;
    int ib = *(const int*)b;
    return (ia > ib) - (ia < ib);
}

static int cmp_strings(const void* a, const void* b) {
    return strcmp(*(const char**)a, *(const char**)b);
}

int* sort_ints(const int* arr, int len) {
    if (!arr || len <= 0) return NULL;
    int* cp = (int*)malloc(sizeof(int) * len);
    memcpy(cp, arr, sizeof(int) * len);
    qsort(cp, len, sizeof(int), cmp_ints);
    return cp;
}

char** sort_strings(const char** arr, int len) {
    if (!arr || len <= 0) return NULL;
    char** cp = (char**)malloc(sizeof(char*) * len);
    memcpy(cp, arr, sizeof(char*) * len);
    qsort(cp, len, sizeof(char*), cmp_strings);
    return cp;
}

/* ========================================================================== */
/* 4. Test Assertion API                                                      */
/* ========================================================================== */

static void _harness_bool_check(const char* msg, bool condition) {
    if (condition) {
        printf("Test passed: %s\n", msg);
    } else {
        printf("Test failed: %s\n", msg);
        exit(1);
    }
}

static void _harness_equal_check_int(const char* msg, int expected, int actual) {
    if (expected == actual) {
        printf("Test passed: %s\n", msg);
    } else {
        printf("Test failed: %s\nExpected: %d\nActual:   %d\n", msg, expected, actual);
        exit(1);
    }
}

static void _harness_equal_check_long(const char* msg, long long expected, long long actual) {
    if (expected == actual) {
        printf("Test passed: %s\n", msg);
    } else {
        printf("Test failed: %s\nExpected: %lld\nActual:   %lld\n", msg, expected, actual);
        exit(1);
    }
}

static void _harness_equal_check_double(const char* msg, double expected, double actual) {
    double diff = expected - actual;
    if (diff < 0) diff = -diff;
    if (diff < 1e-6) {
        printf("Test passed: %s\n", msg);
    } else {
        printf("Test failed: %s\nExpected: %f\nActual:   %f\n", msg, expected, actual);
        exit(1);
    }
}

static void _harness_equal_check_str(const char* msg, const char* expected, const char* actual) {
    if (expected == actual || (expected && actual && strcmp(expected, actual) == 0)) {
        printf("Test passed: %s\n", msg);
    } else {
        printf("Test failed: %s\nExpected: %s\nActual:   %s\n", msg, expected ? expected : "NULL", actual ? actual : "NULL");
        exit(1);
    }
}

static void _harness_equal_check_int_arr(const char* msg, const int* expected, int exp_len, const int* actual, int act_len) {
    if (exp_len == act_len) {
        bool match = true;
        for (int i = 0; i < exp_len; i++) {
            if (expected[i] != actual[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            printf("Test passed: %s\n", msg);
            return;
        }
    }

    printf("Test failed: %s\nExpected: [", msg);
    for (int i = 0; i < exp_len; i++) printf("%d%s", expected[i], (i + 1 < exp_len) ? ", " : "");
    printf("]\nActual:   [");
    for (int i = 0; i < act_len; i++) printf("%d%s", actual[i], (i + 1 < act_len) ? ", " : "");
    printf("]\n");
    exit(1);
}

typedef struct {
    void (*bool_check)(const char* msg, bool b);
    void (*equal_check_int)(const char* msg, int exp, int act);
    void (*equal_check_long)(const char* msg, long long exp, long long act);
    void (*equal_check_double)(const char* msg, double exp, double act);
    void (*equal_check_str)(const char* msg, const char* exp, const char* act);
    void (*equal_check_int_arr)(const char* msg, const int* exp, int exp_len, const int* act, int act_len);
} _HarnessTests;

static const _HarnessTests Tests = {
    .bool_check = _harness_bool_check,
    .equal_check_int = _harness_equal_check_int,
    .equal_check_long = _harness_equal_check_long,
    .equal_check_double = _harness_equal_check_double,
    .equal_check_str = _harness_equal_check_str,
    .equal_check_int_arr = _harness_equal_check_int_arr,
};

#define equal_check(msg, exp, act) _Generic((exp), \
    int: _harness_equal_check_int, \
    long long: _harness_equal_check_long, \
    double: _harness_equal_check_double, \
    char*: _harness_equal_check_str, \
    const char*: _harness_equal_check_str, \
    default: _harness_equal_check_int \
)(msg, exp, act)

#endif

