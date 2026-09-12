---
language: python
badge: py
aliases: [py, python]
---

## List Comprehension
```python
squares = [x**2 for x in range(10) if x % 2 == 0]
```
Constructs a new list by mapping and filtering expressions over an iterable.

## Dictionary & Set Comprehension
```python
index_map = {item: idx for idx, item in enumerate(items)}
unique_squares = {x**2 for x in nums}
```
Constructs a new hash map or hash set from an iterable expression in $O(N)$ time.

## Enumerate with Index
```python
for idx, item in enumerate(items, start=0):
    print(f"{idx}: {item}")
```
Iterates over elements while maintaining a running counter, supporting an optional `start` offset.

## Zip Multiple Iterables
```python
names = ["Alice", "Bob"]
scores = [85, 92]
roster = dict(zip(names, scores))
```
Pairs items from two or more iterables in lockstep, truncating at the shortest input sequence.

## Slicing Syntax
```python
rev = items[::-1]       # Reverse sequence
sub = items[1:5:2]      # Slice [start:stop:step]
head = items[:3]        # First three elements
```
Extracts a shallow copy of a sub-sequence from a list, tuple, or string in $O(K)$ time for slice length $K$.

## Unpacking and Splat
```python
first, *middle, last = numbers
combined = {**defaults, **overrides}
```
Unpacks sequences into target variables with extended wildcard splats and merges dictionaries.

## Tuples & Hashable State Keys
```python
# Creation and trailing comma for single-element tuple:
point = (r, c)
single = (42,) # (42) without trailing comma evaluates as an integer!

# Immutable & Hashable: usable as set elements and dict keys:
visited = set()
visited.add((r, c)) # Track 2D grid coordinates
memo[(i, rem_weight)] = best_val
```
Tuples are immutable sequences that, unlike lists, can be hashed to serve as coordinates in sets or multi-variable state keys in memoization dictionaries.

## Any and All Predicates
```python
has_valid = any(x > 0 for x in values)
all_valid = all(x > 0 for x in values)
```
Lazily short-circuits boolean evaluations over an iterable.

## Sort with Custom Key
```python
# Multi-attribute sort (ascending age, descending score):
sorted_users = sorted(users, key=lambda u: (u["age"], -u["score"]))
```
Performs a stable $O(N \log N)$ Timsort, customized using a projection key function.

## Walrus Operator (:=)
```python
if (n := len(items)) > 10:
    print(f"Batch too large: {n}")
```
Assigns values to variables within an expression, avoiding duplicate function calls or evaluations.

## Lambda Functions
```python
add = lambda x, y: x + y
evens = list(filter(lambda x: x % 2 == 0, nums))
```
Defines short, inline anonymous functions commonly used as callbacks and key extractors.

## Dictionary Missing Keys & Membership
```python
# 1. Membership test in O(1) time:
if "timeout" in config:
    val = config["timeout"]

# 2. Safe lookup with default (avoids KeyError):
val = config.get("timeout", 30)

# 3. Initialize default value if key is missing:
tags = config.setdefault("tags", [])
tags.append("active")
```
Handles absent keys cleanly via membership testing, fallback defaults, or in-place initialization.

## Exception & Error Handling
```python
try:
    val = mapping[key]
    parsed = int(val)
except KeyError:
    parsed = default_val
except (ValueError, TypeError) as err:
    print(f"Conversion failed: {err}")
    raise  # Re-raise exception if unrecoverable
else:
    print("Success: runs only when no exception was raised")
finally:
    print("Cleanup: always runs regardless of outcome")
```
Captures and manages runtime exceptions, differentiates error types, and ensures proper cleanup execution.

## ASCII & Character Conversions
```python
# Character to ASCII code point:
code = ord('c')               # 99
alphabet_idx = ord('c') - ord('a') # 2 (0-25 relative index)

# Code point back to character:
char = chr(ord('a') + alphabet_idx) # 'c'

# Convert character list back to string:
word = ''.join(['a', 'b', 'c']) # 'abc'
```
Translates characters to numerical ordinal values and back, avoiding unsupported direct character arithmetic.

## String Formatting (f-strings)
```python
# Leading zeros and integer padding:
padded = f"{num:02d}"     # 7 -> "07"
fixed_w = f"{num:5d}"     # 7 -> "    7"

# Floating point decimal rounding:
decimal = f"{ratio:.2f}"  # 3.14159 -> "3.14"

# Binary and Hexadecimal radix formatting:
binary_str = f"{val:08b}" # 5 -> "00000101"
hex_str = f"{val:x}"      # 255 -> "ff"
```
Interpolates numbers with fixed padding, specified decimal precision, and binary/hexadecimal representations.

## Shallow vs Deep Copy
```python
import copy

# Shallow copy (new outer container, shares nested references):
shallow = original.copy()  # or original[:]

# Deep copy (recursively duplicates nested lists and dictionaries):
deep = copy.deepcopy(original)
```
Duplicates structures safely, preventing unintentional shared mutations in 2D matrices and graphs.


