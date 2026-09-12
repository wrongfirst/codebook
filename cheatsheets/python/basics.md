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

# Also works in comprehensions:
indexed = {word: i for i, word in enumerate(words)}
```
Iterates over elements while maintaining a running counter, supporting an optional `start` offset. Using `enumerate` in comprehensions avoids a manual counter variable.

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

# Pythonic swap (no temp variable needed):
a, b = b, a
```
Unpacks sequences into target variables with extended wildcard splats and merges dictionaries. The tuple-swap idiom relies on Python evaluating the right-hand side fully before assignment.

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
# Lambdas are appropriate as inline callbacks and key extractors:
sorted_users = sorted(users, key=lambda u: u["age"])

# Prefer comprehensions over filter(lambda ...):
evens = [x for x in nums if x % 2 == 0]   # idiomatic

# filter() is fine with a named predicate:
evens = list(filter(is_even, nums))
```
Lambda expressions create anonymous single-expression functions. Use lambdas for inline use as sort keys or callbacks where the expression is short and self-evident.

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
# Character to code point (ord) and back (chr):
code = ord('c')                      # 99
alphabet_idx = ord('c') - ord('a')   # 2  (0-based offset from 'a')
char = chr(ord('a') + alphabet_idx)  # 'c'

# Convert a list of characters back to a string:
word = ''.join(['a', 'b', 'c'])      # 'abc'
```
`ord()` and `chr()` are Python's idiomatic way to work with character arithmetic. Unlike C's `char + 1`, Python has no implicit character type — `ord`/`chr` make the intent explicit and portable.

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

## *args and **kwargs
```python
def log(message: str, *args, **kwargs):
    # *args: captures extra positional arguments as a tuple
    print(message.format(*args))
    # **kwargs: captures extra keyword arguments as a dict
    for key, val in kwargs.items():
        print(f"  {key}={val}")

log("Values: {} {}", 1, 2, level="INFO", source="main")

# Unpack a list/dict when calling a function:
nums = [1, 2, 3]
print(*nums)                      # 1 2 3
result = add(**{"x": 1, "y": 2})
```
`*args` captures variadic positional arguments as a tuple; `**kwargs` captures variadic keyword arguments as a dict. The splat operators also unpack iterables/dicts at call sites.

## Type Hints
```python
from typing import Optional, Union

def greet(name: str, times: int = 1) -> str:
    return ("Hello, " + name + "! ") * times

# Optional[X] means the value can be X or None:
def find(items: list[int], target: int) -> Optional[int]:
    for i, v in enumerate(items):
        if v == target:
            return i
    return None

# Python 3.10+ union shorthand (int | float instead of Union[int, float]):
def stringify(val: int | float) -> str:
    return str(val)
```
Type hints annotate function signatures and variables for static analysis (mypy, Pyright) and IDE support. They are **not enforced at runtime** — use `isinstance()` for runtime validation.

## Ternary / Conditional Expression
```python
# value_if_true if condition else value_if_false
status = "even" if x % 2 == 0 else "odd"
label  = "empty" if not items else f"{len(items)} items"

# Works inline in comprehensions:
clipped = [x if x > 0 else 0 for x in values]
```
Single-expression conditional evaluation. Prefer this form for short, readable conditions; use a full `if/else` block when the logic is complex.

## String Methods
```python
s = "  Hello, World!  "

s.strip()                        # 'Hello, World!'  — strip whitespace
s.lower()                        # '  hello, world!  '
s.replace("World", "Python")     # '  Hello, Python!  '

# Split and join:
parts  = "a,b,c".split(",")      # ['a', 'b', 'c']
joined = ",".join(parts)         # 'a,b,c'

# Prefix / suffix checks:
"file.py".startswith("file")     # True
"file.py".endswith(".py")        # True

# Character class tests:
"123".isdigit()                  # True
"abc".isalpha()                  # True
```
Built-in string methods return new strings (strings are immutable). `.join()` is the idiomatic way to concatenate many strings — far more efficient than repeated `+` in a loop.
