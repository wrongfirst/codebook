---
language: ocaml
badge: ml
aliases: [ocaml, ml]
---

## Pattern Matching & Match Expressions
```ocaml
match items with
| [] -> "empty"
| [x] -> Printf.sprintf "singleton: %d" x
| head :: tail -> Printf.sprintf "head: %d, rest: %d" head (List.length tail)
```
Destructures data structures and evaluates branches based on structural shape and values with compiler-checked exhaustiveness.

## Functions, Currying & Pipeline Operator
```ocaml
let add x y = x + y
let add5 = add 5 (* Partial application / currying *)

(* Pipeline operator (|>) passes output as last argument to next function: *)
let result =
  [1; 2; 3; 4]
  |> List.filter (fun x -> x mod 2 = 0)
  |> List.map (fun x -> x * 10)
  |> List.fold_left ( + ) 0
```
Composes functional transformations cleanly using automatic currying and reverse application `|>`.

## Recursion & Tail Recursion
```ocaml
(* Tail-recursive function with accumulator parameter: *)
let length list =
  let rec aux acc = function
    | [] -> acc
    | _ :: tail -> aux (acc + 1) tail
  in
  aux 0 list
```
Implements loops and list processing via tail-call optimized recursion to prevent call-stack overflows on large inputs.

## Option and Result Types
```ocaml
let safe_divide x y =
  if y = 0 then None else Some (x / y)

let res =
  match safe_divide 10 2 with
  | Some v -> v
  | None -> 0

(* Option.value with fallback default: *)
let fallback = Option.value ~default:0 (safe_divide 10 0)
```
Models the absence of values or error outcomes explicitly without runtime null pointer exceptions.

## Variant Types (Algebraic Data Types)
```ocaml
type shape =
  | Circle of float
  | Rectangle of float * float
  | Point

let area = function
  | Circle r -> Float.pi *. r *. r
  | Rectangle (w, h) -> w *. h
  | Point -> 0.0
```
Defines sum types capable of holding heterogeneous data variants, unwrapped via pattern matching.

## Records & Mutable Fields
```ocaml
type user = {
  id : int;
  name : string;
  mutable active : bool;
}

let u = { id = 1; name = "Alice"; active = true }
u.active <- false (* In-place field mutation *)
```
Defines named-field product records, supporting immutable field assignment or explicit `mutable` fields.

## Mutable References and Arrays
```ocaml
(* Single mutable reference cell: *)
let count = ref 0
count := !count + 1 (* Mutate with :=, dereference with ! *)

(* Mutable contiguous array: *)
let arr = Array.make 5 0
arr.(0) <- 42 (* Index lookup arr.(i) and mutation <- *)
```
Allocates explicit mutable cells with `ref` and fixed-size mutable sequences with standard `Array`.

## Tuples and Pattern Destructuring
```ocaml
let point = (10, 20, "origin")
let (x, y, label) = point

let swap (a, b) = (b, a)
```
Groups heterogeneous values into fixed-size composites with direct positional destructuring.

## Local Module Opens
```ocaml
(* Open module locally within an expression: *)
let open List in
let sorted = sort compare [3; 1; 2]

(* Compact local open syntax: *)
let sum = List.(fold_left ( + ) 0 [1; 2; 3])
```
Brings a module's functions and types into scope temporarily without polluting the enclosing namespace.

## String Concatenation & Printf Formatting
```ocaml
let name = "Caml"
let greeting = "Hello, " ^ name ^ "!"
let formatted = Printf.sprintf "ID: %04d, Rate: %.2f" 42 3.14159
```
Concatenates strings using `^` and produces strongly typed formatted strings with `Printf.sprintf`.
