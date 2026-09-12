---
language: c
badge: c
aliases: [c]
---

## Pointers & Dereferencing
```c
int val = 42;
int *ptr = &val; // Address-of operator (&): ptr holds memory address
*ptr = 100;      // Dereference operator (*): mutates val directly

int arr[3] = {10, 20, 30};
int *next = arr + 1; // Pointer arithmetic: advances by sizeof(int) bytes (*next == 20)
```
Manipulates raw memory addresses directly using address-of `&`, dereference `*`, and type-scaled pointer arithmetic.

## Dynamic Memory Allocation (malloc, calloc, realloc, free)
```c
#include <stdlib.h>

// malloc: allocates uninitialized bytes
int *arr = malloc(n * sizeof(int));
if (arr == NULL) return -1; // Always check for allocation failure

// calloc: allocates zero-initialized memory
int *zeroed = calloc(n, sizeof(int));

// realloc: resizes dynamic heap buffer
int *tmp = realloc(arr, new_cap * sizeof(int));
if (tmp != NULL) arr = tmp;

free(arr);
arr = NULL; // Prevent dangling pointer
```
Manages heap allocations manually; always check for `NULL` returns and pair allocations with `free()` to prevent resource leaks.

## Structs, Typedefs & Designated Initializers
```c
typedef struct {
    int x;
    int y;
} Point;

// Designated initializer (C99+):
Point p = { .x = 10, .y = 20 };

Point *ptr = &p;
ptr->x = 15; // Arrow operator (->) accesses fields via pointer
```
Defines composite data structures with `typedef` aliases and accesses members directly with `.` or via pointers with `->`.

## Enums & Bitwise Flags
```c
typedef enum {
    READ    = 1 << 0, // 0001
    WRITE   = 1 << 1, // 0010
    EXECUTE = 1 << 2  // 0100
} Permission;

int perms = READ | WRITE;        // Set bits
int has_read = (perms & READ);   // Test bit
perms &= ~WRITE;                 // Clear bit
```
Combines and inspects orthogonal binary flags using strongly-named `enum` constants and bitwise masking.

## Safe String Operations (snprintf, strncpy)
```c
#include <stdio.h>
#include <string.h>

char buffer[64];
// snprintf guarantees null-termination if buffer size > 0:
snprintf(buffer, sizeof(buffer), "User: %s (id: %d)", name, uid);

char dest[32];
strncpy(dest, src, sizeof(dest) - 1);
dest[sizeof(dest) - 1] = '\0'; // Ensure trailing null byte
```
Formats and copies bounded character strings to prevent buffer overflow vulnerabilities.

## Array Decay to Pointers in Functions
```c
// In scope where declared:
size_t count = sizeof(arr) / sizeof(arr[0]);

// In functions, arrays decay to pointers, so always pass length:
void process(const int *arr, size_t len) {
    for (size_t i = 0; i < len; i++) {
        // ...
    }
}
```
Computes static array element count with `sizeof`; arrays decay to raw pointers across function call boundaries.

## Function Pointers
```c
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }

// Function pointer declaration: return_type (*name)(param_types)
int (*operation)(int, int) = add;
int result = operation(10, 5); // 15
```
Stores addresses of executable functions in pointer variables, enabling dynamic callbacks and comparator passing.

## Formatted I/O (printf, scanf)
```c
#include <stdio.h>

printf("Int: %d, Size: %zu, Hex: 0x%X, Ptr: %p\n", num, sz, hex, ptr);

int val;
if (scanf("%d", &val) == 1) {
    // Successfully parsed an integer
}
```
Reads and writes formatted input and output using standard specifiers like `%d` (int), `%zu` (`size_t`), and `%p` (pointer).
