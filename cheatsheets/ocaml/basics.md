---
language: ocaml
badge: ml
aliases: [ocaml, ml]
---

## Expressions, Scoping & Semicolon Sequencing
```ocaml
(* `let ... in` binds a local identifier within an expression: *)
let area =
  let width = 10 in
  let height = 20 in
  width * height

(* Semicolon `;` sequences imperative expressions (evaluates left, returns right): *)
let () =
  print_endline "Step 1";
  print_endline "Step 2"

(* Group sequenced expressions with `begin ... end` or parentheses: *)
let result =
  begin
    print_string "Computing: ";
    40 + 2
  end
```
Treats variables and scopes as nested expressions returning values, sequencing side effects explicitly with semicolons and grouping blocks.

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

## Labeled and Optional Arguments
```ocaml
(* Labeled argument (~name) and optional argument (?prefix with default): *)
let greet ?(prefix = "Hello") ~name () =
  Printf.sprintf "%s, %s!" prefix name

(* Caller supplies labels explicitly; trailing () triggers evaluation: *)
let msg1 = greet ~name:"Alice" ()
let msg2 = greet ~prefix:"Hi" ~name:"Bob" ()
```
Enables self-documenting call sites and optional parameter defaults, using a trailing unit `()` to trigger evaluation when trailing optionals are omitted.

## Type Annotations & Parametric Polymorphism
```ocaml
(* Explicit type annotations on arguments and return type: *)
let square (x : int) : int = x * x

(* Parametric polymorphism with type variable 'a: *)
let identity (x : 'a) : 'a = x
let pair (first : 'a) (second : 'b) : 'a * 'b = (first, second)

(* Type alias: *)
type point = float * float
let origin : point = (0.0, 0.0)
```
Employs Hindley-Milner type inference by default while supporting explicit type annotations and universal type variables `'a`.

## Pattern Matching & Match Expressions
```ocaml
match items with
| [] -> "empty"
| [x] -> Printf.sprintf "singleton: %d" x
| head :: tail -> Printf.sprintf "head: %d, rest: %d" head (List.length tail)
```
Destructures data structures and evaluates branches based on structural shape and values with compiler-checked exhaustiveness.

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

(* Result type for operations that report error messages: *)
let parse_positive n =
  if n > 0 then Ok n else Error "Number must be positive"
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
incr count          (* Equivalent helper: increments ref cell by 1 *)

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

## Exception Handling (raise, try ... with)
```ocaml
exception Item_not_found of string

let find_item key map =
  match Hashtbl.find_opt map key with
  | Some v -> v
  | None -> raise (Item_not_found key)

let safe_lookup key map =
  try find_item key map with
  | Item_not_found k -> Printf.sprintf "Missing key: %s" k
  | Failure msg -> Printf.sprintf "General failure: %s" msg
```
Defines and raises custom or standard exceptions, catching them with pattern matching inside `try ... with` blocks.

## Modules & Signatures
```ocaml
(* Signature defines the public interface: *)
module type StackSig = sig
  type 'a t
  val empty : 'a t
  val push : 'a -> 'a t -> 'a t
  val pop : 'a t -> ('a * 'a t) option
end

(* Structure implements the interface: *)
module ListStack : StackSig = struct
  type 'a t = 'a list
  let empty = []
  let push x s = x :: s
  let pop = function [] -> None | x :: xs -> Some (x, xs)
end
```
Encapsulates implementation details and enforces abstraction barriers using ML structures and signature constraints.

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
