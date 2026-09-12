---
language: ocaml
badge: ml
aliases: [ocaml, ml]
---

## Immutable List Operations (map, filter, fold)
```ocaml
let list = [1; 2; 3; 4]

let doubled = List.map (fun x -> x * 2) list
let evens = List.filter (fun x -> x mod 2 = 0) list
let sum = List.fold_left ( + ) 0 list (* Always prefer fold_left over non-tail-recursive fold_right *)
```
Transforms singly-linked immutable lists using higher-order functions from the standard library.

## Functional Queue (Okasaki Two-List Queue)
```ocaml
type 'a queue = 'a list * 'a list (* (front, back) *)

let empty = ([], [])

let enqueue x (front, back) = (front, x :: back)

let dequeue = function
  | ([], []) -> None
  | (x :: front, back) -> Some (x, (front, back))
  | ([], back) ->
      (match List.rev back with
       | x :: front -> Some (x, (front, []))
       | [] -> None)
```
Maintains an immutable purely functional FIFO queue with amortized $O(1)$ operations via two linked lists.

## Imperative Queue & Stack
```ocaml
(* Imperative FIFO queue: *)
let q = Queue.create ()
Queue.add 42 q     (* Push back *)
let front = Queue.take q (* Pop front (O(1)) *)

(* Imperative LIFO stack: *)
let st = Stack.create ()
Stack.push 10 st
let top = Stack.pop st
```
Standard mutable queue and stack collections optimized for imperative BFS and depth-first traversals.

## Set and Map Functors (IntSet, IntMap)
```ocaml
module IntSet = Set.Make(Int)
module IntMap = Map.Make(Int)

let s = IntSet.(empty |> add 10 |> add 20)
let has_ten = IntSet.mem 10 s

let m = IntMap.(empty |> add 1 "apple" |> add 2 "banana")
let fruit = IntMap.find_opt 1 m (* Some "apple" *)
```
Generates purely functional balanced red-black trees with $O(\log N)$ lookups and insertions using OCaml functors.

## Mutable Hash Table (Hashtbl)
```ocaml
let table = Hashtbl.create 16

Hashtbl.add table "apple" 5
Hashtbl.replace table "apple" 10 (* Overwrites existing key *)

let val_opt = Hashtbl.find_opt table "apple" (* Some 10 *)
let exists = Hashtbl.mem table "apple"
Hashtbl.remove table "apple"
```
Average $O(1)$ mutable associative hash table supporting lookups, replacements, and presence testing.

## 2D Matrix Allocation
```ocaml
let rows = 4
let cols = 5

(* Allocates rows x cols matrix filled with initial value: *)
let matrix = Array.make_matrix rows cols 0

matrix.(0).(1) <- 42
let val_at = matrix.(0).(1)
```
Allocates a mutable 2D contiguous array safely with specified dimensions and initial values.

## Binary Tree ADT
```ocaml
type 'a tree =
  | Leaf
  | Node of 'a tree * 'a * 'a tree

let rec max_depth = function
  | Leaf -> 0
  | Node (l, _, r) -> 1 + max (max_depth l) (max_depth r)

let rec inorder = function
  | Leaf -> []
  | Node (l, v, r) -> inorder l @ (v :: inorder r)
```
Defines algebraic tree structures and evaluates recursive depths and in-order / pre-order traversals.
