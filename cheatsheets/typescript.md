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
Safely traverses nested properties without throwing errors, providing a fallback only when the target is `null` or `undefined` (unlike `||`, zero and empty strings are preserved).

## Array Transformations (map, filter, reduce)
```typescript
const activeUserNames = users
  .filter(u => u.isActive)
  .map(u => u.name);

const sum = numbers.reduce((acc, curr) => acc + curr, 0);
```
Functional sequence transformations that produce new immutable arrays or compute accumulated aggregate values.

## Type Guards and Narrowing
```typescript
function isUser(val: unknown): val is User {
  return typeof val === "object" && val !== null && "id" in val;
}

if (isUser(entity)) {
  console.log(entity.id);
}
```
Custom user-defined type predicates that inform the TypeScript compiler to narrow down union or `unknown` types within conditional branches.

## Utility Types (Partial, Pick, Omit)
```typescript
type UserDraft = Partial<User>;
type UserCredentials = Pick<User, "email" | "password">;
type UserPublic = Omit<User, "password" | "salt">;
```
Built-in type transforms that construct new types by modifying property optionality, including specific keys, or excluding sensitive keys.

## Object Destructuring and Renaming
```typescript
const { name: fullName, age = 18, ...rest } = person;
const merged = { ...defaults, ...overrides };
```
Extracts values from objects with alias assignment, default fallbacks, and rest gathering into new object references.

## Promise.all for Concurrent Async
```typescript
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
```
Executes multiple asynchronous promises concurrently in parallel, resolving when all fulfill or rejecting as soon as any promise fails.

## Generic Function Definition
```typescript
function firstOrFallback<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback;
}
```
Enables functions, classes, and interfaces to work with parameterized types while maintaining strict type safety across call sites.

## Readonly and Immutable Arrays
```typescript
const scores: readonly number[] = [10, 20, 30];
// scores.push(40); // Error: Property 'push' does not exist
```
Prevents accidental array mutations at compile time.
