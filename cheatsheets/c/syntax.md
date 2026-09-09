---
language: c
badge: c
aliases: [c]
---

## Dynamic Memory Allocation (malloc, free)
```c
int *arr = malloc(n * sizeof(int));
if (arr == NULL) {
    perror("allocation failed");
    return -1;
}
// use arr...
free(arr);
arr = NULL; // prevent dangling pointer
```
Allocates contiguous heap memory sized in bytes; always check for `NULL` and pair every allocation with `free` to prevent memory leaks.

## Pointers and Dereferencing
```c
int val = 42;
int *ptr = &val;  // ptr holds memory address of val
*ptr = 100;       // modifies val directly through pointer dereference

int *next = ptr + 1; // pointer arithmetic advances by sizeof(int)
```
Manipulates direct memory locations using the address-of `&` and dereference `*` operators.

## Structs and Typedefs
```c
typedef struct {
    int x;
    int y;
} Point;

Point p1 = { .x = 10, .y = 20 }; // designated initializer
Point *ptr = &p1;
ptr->x = 15;                     // arrow operator for pointer access
```
Defines composite records, aliases them with `typedef`, and accesses fields directly with `.` or through pointers using `->`.

## Safe String Operations (snprintf, strncpy)
```c
char buffer[64];
snprintf(buffer, sizeof(buffer), "User: %s (id: %d)", name, uid);

char dest[32];
strncpy(dest, src, sizeof(dest) - 1);
dest[sizeof(dest) - 1] = '\0'; // ensure null termination
```
Formats and copies bounded character arrays to prevent buffer overflow vulnerabilities, ensuring the trailing `\0` null-terminator.

## Array Size and Passing to Functions
```c
// In scope where array was declared:
size_t count = sizeof(arr) / sizeof(arr[0]);

// In functions, arrays decay to pointers, so always pass length:
void process(const int *arr, size_t len) {
    for (size_t i = 0; i < len; i++) {
        // ...
    }
}
```
Computes static element count with `sizeof`; arrays decay to pointers across function boundaries and require an explicit length parameter.

## Dynamic Buffer Growth (realloc)
```c
size_t cap = 4;
int *items = malloc(cap * sizeof(int));

if (count >= cap) {
    cap *= 2;
    int *tmp = realloc(items, cap * sizeof(int));
    if (!tmp) { free(items); return -1; }
    items = tmp;
}
```
Resizes heap allocations geometrically using a temporary pointer to preserve the original buffer if `realloc` fails.

## Function Pointers and qsort
```c
int compare_ints(const void *a, const void *b) {
    int arg1 = *(const int *)a;
    int arg2 = *(const int *)b;
    return (arg1 > arg2) - (arg1 < arg2);
}

qsort(arr, len, sizeof(int), compare_ints);
```
Passes callback pointers to generic standard library routines, casting generic `const void*` arguments inside comparator functions.

## Header Guards & Preprocessor Macros
```c
#ifndef MY_HEADER_H
#define MY_HEADER_H

#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define BUFFER_SIZE 1024

#endif // MY_HEADER_H
```
Prevents duplicate header inclusions with conditional compilation directives and defines reusable macros.

## Formatted Input and Output
```c
printf("Int: %d, Size: %zu, Hex: 0x%X, Ptr: %p\n", num, sz, hex, ptr);

int val;
if (scanf("%d", &val) == 1) {
    // successfully parsed integer
}
```
Reads and writes formatted I/O using format specifiers like `%d` (signed int), `%zu` (`size_t`), and `%p` (pointer address).

## Bitwise Flags and Enums
```c
enum Permissions {
    READ    = 1 << 0, // 0001
    WRITE   = 1 << 1, // 0010
    EXECUTE = 1 << 2  // 0100
};

int flags = READ | WRITE;        // set bits
bool can_read = (flags & READ);  // test bit
flags &= ~WRITE;                 // clear bit
```
Combines and queries orthogonal binary state flags using bitwise bit shifts and boolean masking operators.
