---
language: typescript
badge: ts
aliases: [ts, typescript, js, javascript]
---

## Interface vs Type Alias
```typescript
// Interface (open for declaration merging, ideal for OOP contracts):
interface User {
  id: number;
  name: string;
}

// Type Alias (flexible unions, primitives, tuples):
type ID = string | number;
type Point = { x: number; y: number };
```
Defines object schemas and type shapes, choosing interfaces for extensible public APIs and type aliases for unions/tuples.

## Utility Types (Partial, Pick, Omit, Record)
```typescript
type UserDraft = Partial<User>;                     // All properties optional
type UserCredentials = Pick<User, "id">;            // Subset of properties
type UserWithoutId = Omit<User, "id">;              // Exclude specific properties
type PageConfig = Record<string, boolean>;          // Key-value dictionary type
type ReadonlyUser = Readonly<User>;                 // Immutable properties
```
Built-in type transforms that produce new types by manipulating property optionality and selection.

## Classes & Parameter Properties
```typescript
class Account {
  // Concise constructor auto-declaring and assigning fields:
  constructor(
    public readonly id: string,
    private balance: number = 0
  ) {}

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.balance += amount;
  }

  get currentBalance(): number {
    return this.balance;
  }
}
```
Defines classes with constructor parameter shorthand, access modifiers (`public`, `private`, `protected`), and getters/setters.

## Inheritance & Abstract Classes
```typescript
abstract class Shape {
  abstract area(): number; // Must be implemented by subclasses

  describe(): void {
    console.log(`Area is ${this.area()}`);
  }
}

class Circle extends Shape {
  constructor(private radius: number) {
    super();
  }

  override area(): number {
    return Math.PI * this.radius ** 2;
  }
}
```
Enforces abstract base class contracts with constructor delegation via `super()` and method `override` verification.

## Discriminated Unions & Exhaustive Checks
```typescript
type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: string[] }
  | { type: "FETCH_ERROR"; error: Error };

function reducer(action: Action): void {
  switch (action.type) {
    case "FETCH_START":   break;
    case "FETCH_SUCCESS": console.log(action.payload); break;
    case "FETCH_ERROR":   console.error(action.error); break;
    default: {
      const _exhaustiveCheck: never = action; // Compile-time check
      return _exhaustiveCheck;
    }
  }
}
```
Models distinct state variants with common discriminator tags and verifies exhaustive pattern coverage at compile time.

## Enums vs 'as const' Objects
```typescript
// Standard numeric/string enum:
enum Status {
  Pending = "PENDING",
  Active = "ACTIVE"
}

// Idiomatic modern 'as const' object (zero runtime bundle overhead):
const Direction = {
  Up: "UP",
  Down: "DOWN",
} as const;

type DirectionType = typeof Direction[keyof typeof Direction]; // "UP" | "DOWN"
```
Compares TypeScript enums with tree-shakeable `as const` literal dictionary types.
