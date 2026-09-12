---
language: python
badge: py
aliases: [py, python]
---

## Class Definition & Constructor (__init__)
```python
class Node:
    def __init__(self, val: int, next_node=None):
        self.val = val
        self.next = next_node

    def has_next(self) -> bool:
        return self.next is not None

head = Node(1, Node(2))
```
Defines classes with instance state initialization and instance methods bound to `self`.

## Inheritance & super()
```python
class Animal:
    def __init__(self, name: str):
        self.name = name

class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name) # Call parent constructor
        self.breed = breed
```
Inherits attributes and methods from base classes and delegates initialization using `super()`.

## Data Classes (@dataclass)
```python
from dataclasses import dataclass, field

@dataclass(order=True)
class Item:
    priority: int
    name: str = field(compare=False) # Excluded from comparisons

# Automatically generates __init__, __repr__, and comparison methods
item = Item(priority=1, name="task")
```
Synthesizes boilerplate constructor, string representation, and comparison methods for record types.

## Custom Comparison (__lt__, __eq__)
```python
class Point:
    def __init__(self, x: int, y: int):
        self.x, self.y = x, y

    def __lt__(self, other: "Point") -> bool:
        # Sort primarily by x, tie-break by y
        return (self.x, self.y) < (other.x, other.y)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Point) and (self.x, self.y) == (other.x, other.y)

# Usable directly in sorted(), min(), max(), and heapq
```
Overloads comparison operators so custom objects can be sorted or stored directly in `heapq` without crashes.

## Properties (@property & Setters)
```python
class Circle:
    def __init__(self, radius: float):
        self._radius = radius

    @property
    def radius(self) -> float:
        return self._radius

    @radius.setter
    def radius(self, value: float) -> None:
        if value < 0:
            raise ValueError("Radius cannot be negative")
        self._radius = value
```
Exposes getter and setter validation methods behind standard attribute access syntax.

## Class Methods & Static Methods
```python
class Date:
    def __init__(self, year: int, month: int, day: int):
        self.year, self.month, self.day = year, month, day

    @classmethod
    def from_iso(cls, iso_str: str) -> "Date":
        y, m, d = map(int, iso_str.split("-"))
        return cls(y, m, d) # Factory constructor

    @staticmethod
    def is_valid_month(m: int) -> bool:
        return 1 <= m <= 12
```
Defines alternative factory constructors with `@classmethod` and self-contained helper functions with `@staticmethod`.

## Sequence Emulation (__len__, __getitem__)
```python
class CustomDeck:
    def __init__(self, cards):
        self._cards = list(cards)

    def __len__(self) -> int:
        return len(self._cards)

    def __getitem__(self, idx: int):
        return self._cards[idx]

# Enables len(deck), deck[0], slicing, and 'for card in deck:'
```
Enables custom classes to support `len()`, bracket indexing `obj[i]`, slicing, and iteration protocols.

## Abstract Base Classes (ABC)
```python
from abc import ABC, abstractmethod

class BaseSolver(ABC):
    @abstractmethod
    def solve(self, data: list[int]) -> int:
        """Subclasses must implement this method"""
        pass
```
Enforces interface contracts, preventing instantiation if declared abstract methods are unimplemented.
