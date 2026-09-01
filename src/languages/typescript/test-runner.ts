import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});
  const hasInputs = inputKeys.length > 0;
  const argVars = inputKeys.length === 1 ? ['arg1'] : inputKeys.map((_, i) => `arg${i + 1}`);
  const destructureArgs = hasInputs ? `${argVars.join(', ')}, expected, desc` : 'expected, desc';
  const callArgs = hasInputs ? argVars.map((v) => `${v} as any`).join(', ') : '';

  const testCaseRows = cases.map((c) => {
    const inputVals = inputKeys.map((k) => JSON.stringify(c.input[k]));
    const expVal = JSON.stringify(c.expected);
    const desc = JSON.stringify(c.description);
    return `  [${[...inputVals, expVal, desc].join(', ')}],`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `\${${argVars[0]}}` : argVars.map((v) => `\${${v}}`).join(', '))
    : '';

  return `// @ts-nocheck
if (typeof ${property} !== "function") {
  throw new Error("${property} function is not defined");
}

const testCases = [
${testCaseRows.join('\n')}
];

for (const [${destructureArgs}] of testCases) {
  const result = ${property}(${callArgs});
  Tests.equalCheck(\`${property}(${argFmt}) - \${desc}\`, expected, result);
}
`;
}
