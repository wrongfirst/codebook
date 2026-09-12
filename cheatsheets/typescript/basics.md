---
language: typescript
badge: ts
aliases: [ts, typescript, js, javascript]
---

## Optional Chaining & Nullish Coalescing
```typescript
const timeout = config?.network?.timeout ?? 5000;
const userName = user?.profile?.getName?.() ?? "Anonymous";
```
Safely accesses deeply nested properties without runtime exceptions, falling back to a default value only when `null` or `undefined` (preserving `0` and `""`).

## Object & Array Destructuring
```typescript
// Object destructuring with renaming and default:
const { name: fullName, age = 18, ...restProps } = person;

// Array destructuring with rest elements:
const [first, second, ...remaining] = items;

// Object and array spread merging:
const merged = { ...defaults, ...overrides };
const cloned = [...items, newItem];
```
Extracts properties and elements cleanly into distinct variables and performs non-destructive shallow merges.

## Array Transformations (map, filter, reduce)
```typescript
const activeNames = users
  .filter(u => u.isActive)
  .map(u => u.name);

const sum = numbers.reduce((acc, curr) => acc + curr, 0);
const hasNegative = numbers.some(x => x < 0);
const allPositive = numbers.every(x => x > 0);
```
Functional sequence methods operating over arrays to filter, transform, aggregate, or test boolean conditions.

## Type Guards & Narrowing
```typescript
function isUser(val: unknown): val is User {
  return typeof val === "object" && val !== null && "id" in val;
}

if (typeof input === "string") {
  input.toUpperCase(); // TypeScript knows input is string
} else if (isUser(input)) {
  console.log(input.id); // Narrowed to User
}
```
Informs the TypeScript compiler to narrow down broad `unknown` or union types within conditional blocks.

## Generic Functions
```typescript
function firstOrFallback<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback;
}

const num = firstOrFallback([10, 20], 0);    // inferred T = number
const str = firstOrFallback([], "default");  // inferred T = string
```
Parametric polymorphism enabling functions and classes to operate over arbitrary types while retaining type integrity.

## ASCII & Character Conversions
```typescript
// Character to 0-25 alphabet index:
const charCode = "c".charCodeAt(0);          // 99
const alphabetIdx = "c".charCodeAt(0) - 97;  // 2 ('a' is 97)

// Alphabet index back to character:
const char = String.fromCharCode(97 + alphabetIdx); // 'c'

// Join array of characters into string:
const str = ["a", "b", "c"].join(""); // "abc"
```
Translates characters to UTF-16 code units and back, and joins token sequences into strings.

## Shallow vs Deep Copy
```typescript
// Shallow copy (nested objects/arrays still share references):
const shallowArr = [...originalArr];
const shallowObj = { ...originalObj };

// Deep copy (modern built-in algorithm recursively copying nested state):
const deepClone = structuredClone(complexState);
```
Duplicates JavaScript objects and arrays safely, leveraging modern `structuredClone` for deep nested state replication.

## Exception & Error Handling
```typescript
try {
  const data = JSON.parse(rawText);
  process(data);
} catch (err: unknown) {
  if (err instanceof SyntaxError) {
    console.error("Invalid JSON format:", err.message);
  } else {
    throw err; // Re-throw unhandled errors
  }
} finally {
  cleanup(); // Always executes
}
```
Catches runtime exceptions with type-safe `unknown` error discrimination and guaranteed cleanup execution.

## Promise.all for Concurrent Async
```typescript
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
```
Executes multiple independent asynchronous operations in parallel, resolving once all settle or rejecting on the first failure.
