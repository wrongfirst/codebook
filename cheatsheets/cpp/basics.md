---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus]
---

## auto Type Deduction & decltype
```cpp
auto x = 42;                 // Deduced as int
const auto& ref = x;         // Deduced as const int& (avoids copying)

// Universal / forwarding reference in generic contexts:
auto&& item = x;             // Binds to lvalues or rvalues

// decltype extracts declared type without evaluating expressions:
decltype(x) y = 100;         // Exactly type int
```
Deduces variable types at compile time while preserving constness and reference qualifiers when explicitly requested.

## References & Const Correctness
```cpp
#include <utility>
#include <vector>

// Pass by const reference: avoids expensive vector copy
void process(const std::vector<int>& items) {
    // items is read-only
}

// Pass by non-const reference: mutates caller arguments in-place
void swapValues(int& a, int& b) {
    std::swap(a, b); // Idiomatic standard swap
}
```
Eliminates expensive object copying when passing parameters to functions while enforcing read-only guarantees.

## Range-Based For Loop & Structured Binding
```cpp
#include <iostream>
#include <unordered_map>
#include <vector>

std::unordered_map<std::string, int> scores = {{"Alice", 95}, {"Bob", 88}};

// Decompose key-value pairs cleanly:
for (const auto& [name, score] : scores) {
    std::cout << name << ": " << score << '\n';
}

// In-place container mutation by reference:
std::vector<int> numbers = {1, 2, 3};
for (auto& x : numbers) {
    x *= 2;
}
```
Iterates over containers with modern C++17 structured bindings to cleanly decompose pairs, tuples, or structs.

## Pairs, Tuples & std::tie
```cpp
#include <tuple>
#include <utility>

std::pair<int, std::string> p = {1, "apple"};
auto t = std::make_tuple(10, 3.14, "point");

// Unpack tuple into separate variables:
int id; double val; std::string tag;
std::tie(id, val, tag) = t;

// Or via structured binding (C++17):
auto [x, y, label] = t;
```
Groups heterogeneous values into fixed-size composites with direct index access and multi-variable unpacking.

## Lambda Expressions & Captures
```cpp
int threshold = 50;

// [capture](params) -> return_type { body }
auto isAbove = [threshold](int val) -> bool {
    return val > threshold;
};

// Capture all local variables by reference:
int count = 0;
auto increment = [&]() { count++; };
```
Creates inline anonymous callable objects with flexible value or reference variable captures.

## Function & Class Templates
```cpp
#include <algorithm>
#include <cstddef>

// Generic function template:
template <typename T>
T clamp(T val, T lo, T hi) {
    return std::max(lo, std::min(val, hi));
}

// Class template with non-type template parameter:
template <typename T, std::size_t Capacity>
struct FixedBuffer {
    T data[Capacity];
    std::size_t size = 0;
};
```
Enables type-independent generic programming instantiated at compile time with zero runtime abstraction overhead.

## Move Semantics & std::move
```cpp
#include <string>
#include <utility>
#include <vector>

std::vector<int> src = {1, 2, 3, 4};

// std::move casts to rvalue reference (T&&), enabling ownership transfer:
std::vector<int> dest = std::move(src); // O(1) pointer swap; src is left valid but empty

void consume(std::string&& str) {
    std::string internal = std::move(str); // Steals buffer without deep copy
}
```
Transfers ownership of dynamically allocated internal resources in $O(1)$ time using rvalue references rather than expensive deep copies.

## Smart Pointers (unique_ptr & shared_ptr)
```cpp
#include <memory>

struct Node { int val; Node(int v) : val(v) {} };

// Exclusive ownership (zero runtime overhead over raw pointer):
auto node = std::make_unique<Node>(42);

// Shared reference-counted ownership:
auto sharedNode = std::make_shared<Node>(100);
```
RAII wrappers that automatically deallocate heap memory when scope ends, avoiding memory leaks and manual `delete` calls.

## Low-Level Dynamic Allocation (new & delete)
```cpp
struct Node { int val; Node(int v) : val(v) {} };

// Legacy/low-level manual allocation (prefer smart pointers in modern C++):
Node* node = new Node(42);
delete node;       // Free single object
node = nullptr;    // Prevent dangling pointer

// Dynamic heap array (must pair new[] with delete[]):
int* buffer = new int[100];
delete[] buffer;
buffer = nullptr;
```
Allocates raw heap memory manually, contrasting single-object `new`/`delete` with array `new[]`/`delete[]`.

## constexpr & Compile-Time Evaluation
```cpp
#include <type_traits>

// Executed at compile time when given constant expressions:
constexpr int square(int n) {
    return n * n;
}
constexpr int VAL = square(5); // Evaluated at compile time (25)

// C++17 compile-time conditional branching:
template <typename T>
auto getZero() {
    if constexpr (std::is_pointer_v<T>) return nullptr;
    else return T{0};
}
```
Executes code and discards dead branches at compile time, eliminating runtime overhead and enabling generic metaprogramming.

## Type Casting (static_cast, dynamic_cast)
```cpp
// Compile-time checked conversion (numeric, upcasts):
double pi = 3.14159;
int truncated = static_cast<int>(pi);

// Safe polymorphic downcasting (requires virtual table; returns nullptr on failure):
struct Base { virtual ~Base() = default; };
struct Derived : Base {};
Base* b = new Derived();
Derived* d = dynamic_cast<Derived*>(b);

// Reinterpret bit patterns (low-level):
uintptr_t raw = reinterpret_cast<uintptr_t>(b);
delete b;
```
Replaces unsafe C-style casts with explicit, compile-time-verified or runtime-checked type conversions.

## std::string Operations
```cpp
#include <string>

std::string s = "hello world";

// Substring extraction (start_index, length):
std::string sub = s.substr(0, 5); // "hello"

// Search substring or character:
size_t pos = s.find("world");
if (pos != std::string::npos) {
    // Found at offset pos
}

// C++20 prefix and suffix inspection:
bool has_pre = s.starts_with("hello"); // true
bool has_suf = s.ends_with("world");   // true
```
Provides rich string manipulation, searching with sentinel `std::string::npos`, and zero-allocation prefix/suffix checks.

## String Conversions (stoi, to_string)
```cpp
#include <string>

std::string s = "12345";
int val = std::stoi(s);                 // string to int
long long big = std::stoll(s);          // string to long long
std::string back = std::to_string(val); // number to string
```
Converts between numerical types and `std::string` with standard parsing and conversion utilities.

## String Views for Zero-Allocation Slices
```cpp
#include <iostream>
#include <string_view>

void printPrefix(std::string_view sv) {
    std::cout << sv.substr(0, 3) << '\n';
}

// Accepts std::string, const char*, or literals without dynamic memory allocation:
printPrefix("hello world");
```
Lightweight non-owning view over contiguous character sequences that avoids string allocations during slicing.

## std::span for Contiguous Sequences (C++20)
```cpp
#include <algorithm>
#include <iostream>
#include <span>
#include <vector>

void printFirstThree(std::span<const int> view) {
    for (int x : view.subspan(0, std::min<size_t>(3, view.size()))) {
        std::cout << x << ' ';
    }
}

int raw[] = {1, 2, 3, 4, 5};
std::vector<int> vec = {10, 20, 30};
printFirstThree(raw); // Interoperates with raw C-arrays, std::vector, or std::array
printFirstThree(vec);
```
Zero-overhead non-owning view over any contiguous memory buffer, acting as a general-purpose array counterpart to `std::string_view`.

## std::optional & Fallback Value
```cpp
#include <optional>
#include <vector>

std::optional<int> findFirstEven(const std::vector<int>& items) {
    for (int x : items) {
        if (x % 2 == 0) return x;
    }
    return std::nullopt;
}

int val = findFirstEven(data).value_or(-1); // Returns found value or -1 default
```
Represents nullable or optional return values explicitly without error-prone sentinel values.

## std::numeric_limits
```cpp
#include <limits>

int max_int = std::numeric_limits<int>::max();
int min_int = std::numeric_limits<int>::min(); // Most negative integer
long long max_ll = std::numeric_limits<long long>::max();

// Floating-point infinity and lowest:
double inf = std::numeric_limits<double>::infinity();
double lowest_d = std::numeric_limits<double>::lowest(); // Most negative double
```
Provides type-safe, architecture-independent query functions for numerical boundaries and floating-point infinity sentinels.

## Structs & Scoped Enums (enum class)
```cpp
#include <cstdint>

// Plain Old Data (POD) struct with aggregate / designated initialization:
struct Point {
    int x;
    int y;
};
Point p1 = {10, 20};
Point p2{.x = 5, .y = 15}; // C++20 designated initializer

// Scoped enum (enum class): strongly typed, avoids name collisions:
enum class Status : uint8_t {
    Pending,
    Active,
    Failed
};

Status state = Status::Active;
// Requires explicit cast (no implicit int conversions):
int code = static_cast<int>(state);
```
Defines lightweight composite data structures with aggregate initialization, and type-safe scoped enumerations.

## Exception Handling (try, catch, throw)
```cpp
#include <iostream>
#include <stdexcept>

void validateAge(int age) {
    if (age < 0) {
        throw std::invalid_argument("Age cannot be negative");
    }
}

try {
    validateAge(-5);
} catch (const std::invalid_argument& e) {
    std::cerr << "Invalid argument: " << e.what() << '\n';
} catch (const std::exception& e) {
    std::cerr << "Standard error: " << e.what() << '\n';
}
```
Separates error detection from recovery using strongly-typed exception objects caught by `const` reference.
