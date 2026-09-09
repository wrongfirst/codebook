---
language: python
badge: py
aliases: [py, python]
---

## List Comprehension
```python
squares = [x**2 for x in range(10) if x % 2 == 0]
```
Creates a new list by applying an expression to each element in an iterable that satisfies an optional condition.

## Dictionary Comprehension
```python
index_map = {item: idx for idx, item in enumerate(items)}
```
Constructs a new dictionary by transforming keys and values from an iterable.

## Enumerate with Index
```python
for idx, item in enumerate(items, start=0):
    print(f"{idx}: {item}")
```
Iterates over an iterable while automatically tracking the 0-indexed or custom-offset position of each element.

## Zip Multiple Iterables
```python
names = ["Alice", "Bob"]
scores = [85, 92]
roster = dict(zip(names, scores))
```
Pairs corresponding elements from two or more iterables in parallel, terminating at the shortest sequence.

## Slicing Syntax
```python
rev = items[::-1]       # Reverse sequence
sub = items[1:5:2]      # Slice [start:stop:step]
head = items[:3]        # First three elements
```
Extracts a sub-sequence from a list, tuple, or string with `[start:stop:step]`.

## Dictionary Default Value (get)
```python
val = config.get("timeout", 30)
```
Retrieves a value for a given key, returning a specified fallback default without raising a `KeyError` if the key does not exist.

## Unpacking and Extended Splat
```python
first, *middle, last = numbers
combined = {**defaults, **custom_overrides}
```
Unpacks sequences into individual variables and merges dictionary key-value mappings.

## Any and All Predicates
```python
has_valid = any(x > 0 for x in values)
all_valid = all(x > 0 for x in values)
```
Evaluates boolean conditions lazily across an iterable. `any` returns `True` if at least one item satisfies the condition; `all` requires every item to satisfy it.

## Sort with Custom Key
```python
sorted_users = sorted(users, key=lambda u: u["age"], reverse=True)
```
Sorts an iterable in-place or returns a new sorted list based on a custom extraction key function.

## Walrus Operator (:=)
```python
if (n := len(items)) > 10:
    print(f"Batch too large: {n}")
```
Assigns values to variables within an expression, avoiding redundant computations and function calls.
