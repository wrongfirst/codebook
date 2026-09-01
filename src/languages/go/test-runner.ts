import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function inferGoType(val: any): string {
  if (val === null || val === undefined) return 'interface{}';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float64';
  if (typeof val === 'string') return 'string';
  if (Array.isArray(val)) {
    const elemType = val.length > 0 ? inferGoType(val[0]) : 'interface{}';
    return `[]${elemType}`;
  }
  return 'interface{}';
}

function formatGoLiteral(val: any): string {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    const elemType = val.length > 0 ? inferGoType(val[0]) : 'interface{}';
    return `[]${elemType}{${val.map(formatGoLiteral).join(', ')}}`;
  }
  return JSON.stringify(val);
}

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const goFnName = toPascalCase(property);
  const inputKeys = Object.keys(cases[0].input || {});

  const structFields = [
    ...inputKeys.map((k) => `\t${k} ${inferGoType(cases[0].input[k])}`),
    `\texpected ${inferGoType(cases[0].expected)}`,
    `\tdesc string`
  ];

  const testCaseEntries = cases.map((c) => {
    const inputFields = inputKeys.map((k) => formatGoLiteral(c.input[k]));
    const expField = formatGoLiteral(c.expected);
    const descField = JSON.stringify(c.description);
    return `\t{${[...inputFields, expField, descField].join(', ')}},`;
  });

  const callArgs = inputKeys.map((k) => `tc.${k}`).join(', ');
  const fmtInputs = inputKeys.map(() => `%v`).join(', ');

  return `testCases := []struct {
${structFields.join('\n')}
}{
${testCaseEntries.join('\n')}
}

for _, tc := range testCases {
\tres := ${goFnName}(${callArgs})
\tTests.EqualCheck(fmt.Sprintf("${goFnName}(${fmtInputs}) - %s", ${callArgs}, tc.desc), tc.expected, res)
}
`;
}
