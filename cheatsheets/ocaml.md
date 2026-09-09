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
| head :: tail -> Printf.sprintf "head: %d, rest count: %d" head (List.length tail)
```
Destructures data structures and evaluates branches based on structural shape and values with compiler-checked exhaustiveness.

## List Operations (map, filter, fold)
```ocaml
let doubled = List.map (fun x -> x * 2) [1; 2; 3]
let evens = List.filter (fun x -> x mod 2 = 0) [1; 2; 3; 4]
let sum = List.fold_left ( + ) 0 [1; 2; 3; 4]
```
Transforms immutable linked lists using higher-order functions from the standard library.

## Option and Result Types
```ocaml
let safe_divide x y =
  if y = 0 then None else Some (x / y)

let result =
  match safe_divide 10 2 with
  | Some v -> Option.value ~default:0 (Some (v * 2))
  | None -> 0
```
Encodes the absence of a value or failure states explicitly into types without runtime null pointer exceptions.

## Variant Types & Algebraic Data Types
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

## Recursion & Tail Recursion
```ocaml
let length list =
  let rec aux acc = function
    | [] -> acc
    | _ :: tail -> aux (acc + 1) tail
  in
  aux 0 list
```
Implements loops and list processing via tail-call optimized recursion using an accumulator parameter to prevent stack overflows.

## Pipeline Operator and Currying
```ocaml
let process_numbers nums =
  nums
  |> List.filter (fun x -> x > 0)
  |> List.map (fun x -> x * 10)
  |> List.fold_left ( + ) 0
```
Chains transformations cleanly using the reverse application pipeline operator `|>`, taking advantage of automatic function currying.

## Tuples and Pattern Destructuring
```ocaml
let point = (10, 20, "origin")
let (x, y, label) = point

let swap (a, b) = (b, a)
```
Groups fixed-size collections of heterogeneous values with positional destructuring.

## Mutable References and Arrays
```ocaml
let count = ref 0
count := !count + 1  (* mutate with := and dereference with ! *)

let arr = Array.make 5 0
arr.(0) <- 42        (* mutable index access and assignment *)
```
Provides explicit mutable cell references with `ref` and fixed-size mutable sequences with `Array`.

## String Concatenation & Printf Formatting
```ocaml
let name = "Caml"
let greeting = "Hello, " ^ name ^ "!"
let formatted = Printf.sprintf "ID: %04d, Rate: %.2f" 42 3.14159
```
Joins strings using the `^` operator and produces strongly typed formatted strings with `Printf.sprintf`.

## Local Module Opens
```ocaml
(* Open module locally within an expression *)
let open List in
let sorted = sort compare [3; 1; 2]

(* Compact local open syntax *)
let sum = List.(fold_left ( + ) 0 [1; 2; 3])
```
Brings a module's functions and types into scope temporarily for an expression without polluting the global namespace.
