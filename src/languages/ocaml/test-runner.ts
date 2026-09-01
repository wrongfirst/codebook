import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function formatOcamlLiteral(val: any, hint?: string): string {
  if (hint === 'tree' && Array.isArray(val)) {
    const elts = val.map((x) => (x === null || x === undefined ? 'None' : `Some ${x}`));
    return `[${elts.join('; ')}]`;
  }
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map((x) => formatOcamlLiteral(x)).join('; ')}]`;
  }
  return JSON.stringify(val);
}

export function buildTestCode(cases: FlatCanonicalTestCase[], meta: CanonicalData): string {
  if (!cases.length) return '';

  const comparison = meta?.comparison || cases[0]?.comparison || 'exact';
  const returns = meta?.returns || cases[0]?.returns || 'standard';
  const inputsMeta = meta?.inputs || cases[0]?.inputs || {};
  const mutation = meta?.mutation || cases[0]?.mutation;

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});
  const hasInputs = inputKeys.length > 0;

  const cycleKey = inputKeys.find((k) => inputsMeta[k] === 'linked_list_cycle');
  const posKey = cycleKey
    ? (inputKeys.find((k) => k === 'pos' || k === `${cycleKey}_pos` || k === `${cycleKey}Pos`) ||
       (inputKeys.length === 2 ? inputKeys.find((k) => k !== cycleKey) : undefined))
    : undefined;

  const argNames = hasInputs
    ? inputKeys.map((_, i) => `arg${i + 1}`).join(', ')
    : '()';

  const testCaseEntries = cases.map((c) => {
    const inputs = inputKeys.map((k) => formatOcamlLiteral(c.input[k], inputsMeta[k]));
    const exp = formatOcamlLiteral(c.expected, returns === 'tree' ? 'tree' : undefined);
    const desc = JSON.stringify(c.description);
    return `    (${[...inputs, exp, desc].join(', ')});`;
  });

  const callArgExprs: string[] = [];
  for (let i = 0; i < inputKeys.length; i++) {
    const k = inputKeys[i];
    const v = `arg${i + 1}`;
    if (k === posKey && cycleKey) continue;
    const type = inputsMeta[k];
    if (type === 'linked_list_cycle') {
      const posIdx = posKey ? inputKeys.indexOf(posKey) : -1;
      const posVar = posIdx !== -1 ? `arg${posIdx + 1}` : '(-1)';
      callArgExprs.push(`(make_cycle ${v} ${posVar})`);
    } else if (type === 'tree') {
      callArgExprs.push(`(list_to_tree ${v})`);
    } else if (type === 'tree_node') {
      callArgExprs.push(`(create_tree_node ${v})`);
    } else if (type === 'linked_list') {
      callArgExprs.push(`(list_to_linked_list ${v})`);
    } else if (type === 'graph') {
      callArgExprs.push(`(build_graph ${v})`);
    } else {
      callArgExprs.push(v);
    }
  }

  const callArgs = callArgExprs.length > 0 ? callArgExprs.join(' ') : '()';

  let resTransform = 'res';
  if (returns === 'tree') resTransform = 'tree_to_list res';
  else if (returns === 'tree_node') resTransform = '(match res with None -> -1 | Some n -> n.val_)';
  else if (returns === 'linked_list') resTransform = 'linked_list_to_list res';
  else if (returns === 'graph') resTransform = 'graph_to_adj res';

  let assertion = 'Tests.equal_check msg expected res';
  if (comparison === 'unordered' || comparison === 'unordered_nested') {
    assertion = `Tests.unordered_equal_check msg expected ${resTransform}`;
  } else if (typeof cases[0].expected === 'string') {
    assertion = `Tests.string_check (fun s -> "\\"" ^ s ^ "\\"") msg expected ${resTransform}`;
  } else {
    assertion = `Tests.equal_check msg expected ${resTransform}`;
  }

  const strInputs = hasInputs
    ? (inputKeys.length === 1
        ? (typeof cases[0].input[inputKeys[0]] === 'number' ? 'string_of_int arg1' : 'arg1')
        : inputKeys.map((_, i) => `string_of_int arg${i + 1}`).join(' ^ " " ^ '))
    : '""';

  const msgExpr = hasInputs
    ? `"${property} " ^ ${strInputs} ^ " - " ^ desc`
    : `"${property}() - " ^ desc`;

  const iterPattern = hasInputs ? `(${argNames}, expected, desc)` : `(expected, desc)`;

  // In-place mutation
  if (mutation?.target) {
    const targetIdx = inputKeys.indexOf(mutation.target);
    const targetVar = targetIdx !== -1 ? `arg${targetIdx + 1}` : 'arg1';
    const isLinkedList = inputsMeta[mutation.target] === 'linked_list';
    const postTransform = isLinkedList ? `linked_list_to_list ${targetVar}` : targetVar;
    return `let () =
  let test_cases = [
${testCaseEntries.join('\n')}
  ] in
  List.iter (fun ${iterPattern} ->
    let ${targetVar}_in = ${isLinkedList ? `list_to_linked_list ${targetVar}` : targetVar} in
    ${property} ${targetVar}_in;
    let res = ${postTransform} in
    let msg = ${msgExpr} in
    ${assertion}
  ) test_cases
`;
  }

  return `let () =
  let test_cases = [
${testCaseEntries.join('\n')}
  ] in
  List.iter (fun ${iterPattern} ->
    let res = ${property} ${callArgs} in
    let msg = ${msgExpr} in
    ${assertion}
  ) test_cases
`;
}
