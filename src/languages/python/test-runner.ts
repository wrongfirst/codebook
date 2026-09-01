import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function escapePyString(str: string): string {
  return JSON.stringify(str);
}

function formatPyValue(val: any): string {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'True' : 'False';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return escapePyString(val);
  if (Array.isArray(val)) {
    return `[${val.map(formatPyValue).join(', ')}]`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).map(
      ([k, v]) => `${escapePyString(k)}: ${formatPyValue(v)}`
    );
    return `{${entries.join(', ')}}`;
  }
  return String(val);
}

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});
  const hasInputs = inputKeys.length > 0;
  const argVars = inputKeys.length === 1 ? ['arg1'] : inputKeys.map((_, i) => `arg${i + 1}`);
  const destructureArgs = hasInputs ? `${argVars.join(', ')}, expected, desc` : 'expected, desc';
  const callArgs = hasInputs ? argVars.join(', ') : '';

  const testCaseTuples = cases.map((c) => {
    const inputVals = inputKeys.map((k) => formatPyValue(c.input[k]));
    const expVal = formatPyValue(c.expected);
    const desc = escapePyString(c.description);
    return `    (${[...inputVals, expVal, desc].join(', ')}),`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `{${argVars[0]}}` : argVars.map((v) => `{${v}}`).join(', '))
    : '';

  return `if '${property}' not in globals():
    raise Exception("${property} function is not defined")

test_cases = [
${testCaseTuples.join('\n')}
]

for ${destructureArgs} in test_cases:
    res = ${property}(${callArgs})
    Tests.equal_check(f"${property}(${argFmt}) - {desc}", expected, res)
`;
}
