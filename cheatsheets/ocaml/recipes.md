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

## Math: GCD, LCM & Fast Modular Exponentiation
```ocaml
let rec gcd a b =
  if b = 0 then a else gcd b (a mod b)

let lcm a b =
  (a / gcd a b) * b

(* Tail-recursive binary exponentiation (base^exp mod m): *)
let mod_pow base exp m =
  let rec aux b e acc =
    if e = 0 then acc
    else if e mod 2 = 1 then
      aux ((b * b) mod m) (e / 2) ((acc * b) mod m)
    else
      aux ((b * b) mod m) (e / 2) acc
  in
  aux (base mod m) exp 1
(* Note: OCaml int is 63-bit on 64-bit systems. Use Int64 or Zarith if intermediate products risk overflow. *)
```
Computes standard number-theoretic algorithms in logarithmic time via tail-recursive Euclidean reduction and binary exponentiation.

## Array and List Sorting with Custom Comparators
```ocaml
(* In-place array sort (O(N log N)): *)
let arr = [| 5; 2; 8; 1 |]
Array.sort compare arr (* Ascending *)
Array.sort (fun a b -> compare b a) arr (* Descending *)

(* Immutable list sort with multi-key comparator (length first, then alphabetical): *)
let words = ["banana"; "pie"; "apple"; "fig"]
let sorted_words =
  List.sort (fun a b ->
    match compare (String.length a) (String.length b) with
    | 0 -> String.compare a b
    | c -> c
  ) words
```
Sorts mutable arrays in-place or produces new sorted lists using standard or multi-key comparison functions.

## Fast Input Parsing with Scanf
```ocaml
(* Read space-delimited values directly from standard input: *)
let n = Scanf.scanf " %d" Fun.id
let (name, score) = Scanf.scanf " %s %d" (fun s d -> (s, d))

(* Read N integers into a newly initialized array: *)
let arr = Array.init n (fun _ -> Scanf.scanf " %d" Fun.id)
```
Reads structured tokens and primitive values from standard input without loading entire lines into memory.

## Safe Conversions & Character Utilities
```ocaml
(* Safe conversions returning option to prevent runtime exceptions: *)
let i_opt = int_of_string_opt "123"      (* Some 123 *)
let f_opt = float_of_string_opt "3.14"   (* Some 3.14 *)
let bad   = int_of_string_opt "abc"      (* None *)

(* ASCII code and digit extraction: *)
let ascii_code = Char.code 'A'                 (* 65 *)
let char_val   = Char.chr 65                   (* 'A' *)
let digit_val  = Char.code '7' - Char.code '0' (* 7 *)
```
Parses strings safely into numeric primitives and performs bidirectional character-to-ASCII conversions.
