---
language: cpp
badge: cpp
aliases: [cpp, c++, cplusplus]
---

## Vectors and Dynamic Sizing
```cpp
std::vector<int> nums;
nums.reserve(100); // avoid reallocations
nums.push_back(10);
nums.emplace_back(20); // constructs element in-place

bool empty = nums.empty();
size_t size = nums.size();
```
Dynamically sized contiguous arrays with automatic memory management and fast indexed element access.

## Hash Maps and Sets (unordered_map)
```cpp
std::unordered_map<std::string, int> counts;
counts["apple"] = 5;

auto it = counts.find("apple");
if (it != counts.end()) {
    std::cout << it->first << ": " << it->second << '\n';
}

counts.insert_or_assign("banana", 2);
```
Average O(1) key-value associations backed by hash tables with iterator-based lookups and modern key insertion.

## Range-Based For Loop & Structured Binding
```cpp
std::unordered_map<std::string, int> scores = {{"Alice", 95}, {"Bob", 88}};

for (const auto& [name, score] : scores) {
    std::cout << name << " got " << score << '\n';
}

for (auto& x : numbers) {
    x *= 2; // in-place mutation by reference
}
```
Cleanly iterates over containers, decomposing pair/tuple elements directly into distinct named variable references.

## Smart Pointers (unique_ptr, shared_ptr)
```cpp
// Exclusive ownership (zero overhead over raw pointer):
auto node = std::make_unique<Node>(42);

// Shared reference-counted ownership:
auto sharedNode = std::make_shared<Node>(100);
```
RAII wrappers that automatically deallocate heap objects when their scope ends, avoiding memory leaks and manual `delete` calls.

## Lambda Expressions and Captures
```cpp
int threshold = 50;

// [capture](parameters) -> return_type { body }
auto isAbove = [threshold](int val) -> bool {
    return val > threshold;
};

auto counter = [&]() { count++; }; // capture all by reference
```
Inline anonymous callable objects that can capture local variables by value or reference for customized callbacks and predicates.

## Standard Algorithms (std::sort, std::reverse)
```cpp
std::sort(nums.begin(), nums.end());
std::reverse(nums.begin(), nums.end());

auto it = std::find(nums.begin(), nums.end(), target);
int sum = std::accumulate(nums.begin(), nums.end(), 0);
```
Reusable, generic STL algorithms operating over iterator ranges for sorting, querying, transforming, and accumulating container data.

## String Views for Zero-Allocation Substrings
```cpp
void printPrefix(std::string_view sv) {
    std::cout << sv.substr(0, 3) << '\n';
}

// Accepts std::string, const char*, or string literals without allocating:
printPrefix("hello world");
```
A lightweight, non-owning view of a sequence of characters that avoids expensive memory allocations when slicing strings.

## Optional and Value Fallback
```cpp
std::optional<int> findFirstEven(const std::vector<int>& items) {
    for (int x : items) {
        if (x % 2 == 0) return x;
    }
    return std::nullopt;
}

int val = findFirstEven(data).value_or(-1);
```
Expresses values that may or may not be present without sentinel values, providing safe unwrapping with fallback defaults.

## Pairs and Tuples
```cpp
std::pair<int, std::string> p = {1, "apple"};
auto t = std::make_tuple(10, 3.14, "point");

int id; double val; std::string tag;
std::tie(id, val, tag) = t; // unpack tuple
```
Bundles heterogeneous values into fixed-size composites with direct index/member access and unpacking support.

## Custom Sorting Comparators
```cpp
struct Task { int priority; std::string name; };

// Sort by descending priority using a lambda:
std::sort(tasks.begin(), tasks.end(), [](const Task& a, const Task& b) {
    return a.priority > b.priority;
});
```
Customizes ordering in algorithms like `std::sort` or containers like `std::priority_queue` with strict weak ordering comparison callables.
