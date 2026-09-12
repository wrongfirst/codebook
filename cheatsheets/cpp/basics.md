---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus]
---

## Range-Based For Loop & Structured Binding
```cpp
std::unordered_map<std::string, int> scores = {{"Alice", 95}, {"Bob", 88}};

// Decompose key-value pairs cleanly:
for (const auto& [name, score] : scores) {
    std::cout << name << ": " << score << '\n';
}

// In-place container mutation by reference:
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

// Capture all by reference:
int count = 0;
auto increment = [&]() { count++; };
```
Creates inline anonymous callable objects with flexible value or reference variable captures.

## Smart Pointers (unique_ptr & shared_ptr)
```cpp
#include <memory>

// Exclusive ownership (zero runtime overhead over raw pointer):
auto node = std::make_unique<Node>(42);

// Shared reference-counted ownership:
auto sharedNode = std::make_shared<Node>(100);
```
RAII wrappers that automatically deallocate heap memory when scope ends, avoiding memory leaks and manual `delete` calls.

## Dynamic Memory Allocation (new & delete)
```cpp
// Single heap object:
Node* node = new Node(42);
delete node;       // Free single object
node = nullptr;    // Prevent dangling pointer

// Dynamic heap array (requires delete[]):
int* buffer = new int[n];
delete[] buffer;   // Must use delete[] (not delete) for heap arrays
buffer = nullptr;
```
Allocates raw heap memory manually, pairing single object `new` with `delete` and array `new[]` with `delete[]`.

## References & Const Correctness
```cpp
// Pass by const reference: avoids expensive vector copy
void process(const std::vector<int>& items) {
    // items is read-only
}

// Pass by reference: mutates original argument
void swapValues(int& a, int& b) {
    int tmp = a; a = b; b = tmp;
}
```
Eliminates expensive object copying when passing parameters to functions while enforcing read-only guarantees.

## String Views for Zero-Allocation Slices
```cpp
#include <string_view>

void printPrefix(std::string_view sv) {
    std::cout << sv.substr(0, 3) << '\n';
}

// Accepts std::string, const char*, or literals without dynamic memory allocation:
printPrefix("hello world");
```
Lightweight non-owning view over contiguous character sequences that avoids string allocations during slicing.

## String Conversions (stoi, to_string)
```cpp
#include <string>

std::string s = "12345";
int val = std::stoi(s);            // string to int
long long big = std::stoll(s);     // string to long long
std::string back = std::to_string(val); // number to string
```
Converts between numerical types and `std::string` with standard parsing and conversion utilities.

## std::optional & Fallback Value
```cpp
#include <optional>

std::optional<int> findFirstEven(const std::vector<int>& items) {
    for (int x : items) {
        if (x % 2 == 0) return x;
    }
    return std::nullopt;
}

int val = findFirstEven(data).value_or(-1); // Returns found value or -1 default
```
Represents nullable or optional return values explicitly without error-prone sentinel values.

## Structs & Scoped Enums (enum class)
```cpp
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

