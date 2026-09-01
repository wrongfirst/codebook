import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function formatOcamlLiteral(val: any): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map(formatOcamlLiteral).join('; ')}]`;
  }
  return JSON.stringify(val);
}

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});
  const hasInputs = inputKeys.length > 0;
  const argNames = hasInputs
    ? (inputKeys.length === 1 ? 'input_val' : inputKeys.map((_, i) => `arg${i + 1}`).join(', '))
    : '()';
  const callArgs = hasInputs
    ? (inputKeys.length === 1 ? 'input_val' : inputKeys.map((_, i) => `arg${i + 1}`).join(' '))
    : '()';

  const testCaseEntries = cases.map((c) => {
    const inputs = inputKeys.map((k) => formatOcamlLiteral(c.input[k]));
    const exp = formatOcamlLiteral(c.expected);
    const desc = JSON.stringify(c.description);
    return `    (${[...inputs, exp, desc].join(', ')});`;
  });

  const isStringExpected = typeof cases[0].expected === 'string';
  const assertion = isStringExpected
    ? 'Tests.string_check (fun s -> "\\"" ^ s ^ "\\"") msg expected res'
    : 'Tests.equal_check msg expected res';

  const strInputs = hasInputs
    ? (inputKeys.length === 1
        ? (typeof cases[0].input[inputKeys[0]] === 'number' ? 'string_of_int input_val' : 'input_val')
        : inputKeys.map((_, i) => `string_of_int arg${i + 1}`).join(' ^ " " ^ '))
    : '""';

  const msgExpr = hasInputs
    ? `"${property} " ^ ${strInputs} ^ " - " ^ desc`
    : `"${property}() - " ^ desc`;

  const iterPattern = hasInputs ? `(${argNames}, expected, desc)` : `(expected, desc)`;

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
