---
language: ocaml
badge: ml
aliases: [ocaml, ml, dsa]
---

## Binary Tree ADT & Traversals
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
Defines algebraic tree structures and evaluates recursive depths and traversal sequences with pattern matching.

## Functional Queue (Okasaki Two-List Queue)
```ocaml
type 'a queue = 'a list * 'a list (* (front_list, back_list) *)

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
Maintains an immutable purely functional FIFO queue with amortized $O(1)$ enqueue and dequeue operations.

## Binary Search on Sorted Array
```ocaml
let binary_search arr target =
  let rec loop left right =
    if left >= right then left
    else
      let mid = left + (right - left) / 2 in
      if arr.(mid) >= target then
        loop left mid       (* Answer is at or to left of mid *)
      else
        loop (mid + 1) right (* Answer is strictly to right *)
  in
  loop 0 (Array.length arr)
```
Performs tail-call optimized binary search over array ranges without stack exhaustion or integer overflow.

## Hash Table Memoization for DP
```ocaml
let fib_memo n =
  let memo = Hashtbl.create 16 in
  let rec dp i =
    if i <= 1 then i
    else
      match Hashtbl.find_opt memo i with
      | Some res -> res
      | None ->
          let res = dp (i - 1) + dp (i - 2) in
          Hashtbl.add memo i res;
          res
  in
  dp n
```
Caches recursive dynamic programming state transitions using a mutable hash table to reduce exponential calls to $O(N)$.

## Set and Map Functors (IntSet, IntMap)
```ocaml
module IntSet = Set.Make(Int)
module IntMap = Map.Make(Int)

let s = IntSet.(empty |> add 10 |> add 20)
let has_ten = IntSet.mem 10 s

let m = IntMap.(empty |> add 1 "apple" |> add 2 "banana")
let fruit = IntMap.find_opt 1 m (* returns Some "apple" *)
```
Instantiates purely functional balanced red-black trees with $O(\log N)$ lookups and insertions using OCaml functors.

## Tail-Recursive Reversal & Fold Trap
```ocaml
(* PITFALL: List.fold_right and (@) are NOT tail-recursive and crash on large lists! *)
(* ALWAYS prefer List.fold_left and tail-recursive accumulators: *)
let reverse list =
  let rec aux acc = function
    | [] -> acc
    | x :: xs -> aux (x :: acc) xs
  in
  aux [] list
```
Avoids call-stack overflow on large datasets by using tail recursion and prepending `x :: acc` instead of appending `@`.

## Graph Adjacency List & BFS
```ocaml
let bfs adj_tbl start_node target =
  let visited = Hashtbl.create 16 in
  Hashtbl.add visited start_node true;

  let q = Queue.create () in
  Queue.add (start_node, 0) q;

  let rec loop () =
    if Queue.is_empty q then None
    else
      let (u, dist) = Queue.take q in
      if u = target then Some dist
      else begin
        List.iter (fun v ->
          if not (Hashtbl.mem visited v) then begin
            Hashtbl.add visited v true;
            Queue.add (v, dist + 1) q
          end
        ) (Hashtbl.find_opt adj_tbl u |> Option.value ~default:[]);
        loop ()
      end
  in
  loop ()
```
Traverses unweighted graphs and computes shortest paths using OCaml's imperative standard `Queue` module.

## 2D Matrix Allocation & Directions
```ocaml
let rows = 5 in
let cols = 10 in
let visited = Array.make_matrix rows cols false in

let dirs = [(0, 1); (1, 0); (0, -1); (-1, 0)] in (* Right, Down, Left, Up *)

let in_bounds r c =
  r >= 0 && r < rows && c >= 0 && c < cols in

List.iter (fun (dr, dc) ->
  let nr = r + dr in
  let nc = c + dc in
  if in_bounds nr nc && not visited.(nr).(nc) then
    visited.(nr).(nc) <- true
) dirs
```
Allocates mutable 2D matrices cleanly with `Array.make_matrix` and explores coordinate neighborhoods.

## Bitwise Operators & Masking
```ocaml
(* Bitwise operators in OCaml use 'l' prefix: land, lor, lxor, lnot, lsl, lsr *)
let is_power_of_two x =
  x > 0 && (x land (x - 1) = 0)

let lowest_set_bit x =
  x land (-x)

(* Subset iteration: *)
let has_bit mask i =
  (mask land (1 lsl i)) <> 0
```
Utilizes OCaml's logical bitwise keywords (`land`, `lor`, `lxor`, `lsl`, `lsr`) for bitmask operations and state flags.
