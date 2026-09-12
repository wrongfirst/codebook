---
language: ocaml
badge: ml
aliases: [ocaml, ml]
---

## Bitwise Operators & Masking
```ocaml
(* OCaml bitwise operators use 'l' prefixed keywords: *)
(* land (AND), lor (OR), lxor (XOR), lnot (NOT), lsl (shift left), lsr (shift right) *)

let is_power_of_two x =
  x > 0 && (x land (x - 1) = 0)

let lowest_set_bit x =
  x land (-x)

let has_bit mask i =
  (mask land (1 lsl i)) <> 0
```
Utilizes OCaml's logical bitwise keywords for bit testing, flag masking, and power-of-two checks.

## Math: GCD, LCM & Modular Exponentiation
```ocaml
let rec gcd a b =
  if b = 0 then a else gcd b (a mod b)

let lcm a b =
  (a / gcd a b) * b

(* Fast modular exponentiation (base^exp mod m): *)
let rec mod_pow base exp m =
  if exp = 0 then 1
  else if exp mod 2 = 1 then
    (base * mod_pow base (exp - 1) m) mod m
  else
    let half = mod_pow base (exp / 2) m in
    (half * half) mod m
```
Computes standard number-theoretic algorithms in logarithmic time via Euclidean reduction and binary exponentiation.

## Array and List Sorting (sort)
```ocaml
(* In-place array sort (O(N log N)): *)
let arr = [| 5; 2; 8; 1 |]
Array.sort compare arr (* Ascending *)
Array.sort (fun a b -> compare b a) arr (* Descending *)

(* Immutable list sort (returns new sorted list): *)
let sorted_list = List.sort compare [5; 2; 8; 1]
```
Sorts arrays in-place or produces new sorted lists using standard or custom comparison functions.
