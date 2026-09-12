---
language: ocaml
badge: ml
aliases: [ocaml, ml]
---

## Binary Search on Sorted Array [left, right)
```ocaml
let binary_search arr target =
  let rec loop left right =
    if left >= right then left
    else
      let mid = left + (right - left) / 2 in
      if arr.(mid) >= target then
        loop left mid        (* Solution in left half including mid *)
      else
        loop (mid + 1) right (* Solution strictly to right *)
  in
  loop 0 (Array.length arr)
```
Performs tail-call optimized binary search over array ranges without call-stack exhaustion or integer overflow.

## Two Pointers on Array
```ocaml
let two_sum sorted_arr target =
  let rec loop left right =
    if left >= right then None
    else
      let sum = sorted_arr.(left) + sorted_arr.(right) in
      if sum = target then Some (left, right)
      else if sum < target then loop (left + 1) right
      else loop left (right - 1)
  in
  loop 0 (Array.length sorted_arr - 1)
```
Traverses sequential structures with two coordinating indices in $O(N)$ time and $O(1)$ auxiliary space.

## Graph BFS & Shortest Path
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
Traverses unweighted graphs level-by-level to calculate shortest hop distances in $O(V + E)$ time.

## 2D Grid Directions & Boundary Traversal
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
Navigates orthogonal 2D matrix coordinates cleanly with delta direction tuples and boundary validation.

## Dynamic Programming Memoization (Hashtbl)
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
Caches recursive dynamic programming state transitions using a hash table to eliminate redundant subproblem calls.

## Tail-Recursive Reversal & Accumulator Idiom
```ocaml
(* Prepending (x :: acc) inside tail-recursive helper prevents call-stack overflow: *)
let reverse list =
  let rec aux acc = function
    | [] -> acc
    | x :: xs -> aux (x :: acc) xs
  in
  aux [] list
```
Avoids call-stack overflow on large datasets by using an accumulator and avoiding non-tail-recursive list append (`@`).
