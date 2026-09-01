import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function inferCppType(val: any): string {
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'double';
  if (typeof val === 'string') return 'std::string';
  if (Array.isArray(val)) {
    const elemType = val.length > 0 ? inferCppType(val[0]) : 'std::string';
    return `std::vector<${elemType}>`;
  }
  return 'std::string';
}

function formatCppLiteral(val: any): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `{${val.map(formatCppLiteral).join(', ')}}`;
  }
  return JSON.stringify(val);
}

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});

  const retType = inferCppType(cases[0].expected);
  const paramDecls = inputKeys.map((k) => `${inferCppType(cases[0].input[k])} ${k}`).join(', ');

  const structFields = [
    ...inputKeys.map((k) => `        ${inferCppType(cases[0].input[k])} ${k};`),
    `        ${retType} expected;`,
    `        std::string desc;`
  ];

  const testCaseEntries = cases.map((c) => {
    const inputs = inputKeys.map((k) => formatCppLiteral(c.input[k]));
    const exp = formatCppLiteral(c.expected);
    const desc = JSON.stringify(c.description);
    return `        {${[...inputs, exp, desc].join(', ')}},`;
  });

  const callArgs = inputKeys.map((k) => `tc.${k}`).join(', ');
  const strParams = inputKeys
    .map((k) => {
      const type = inferCppType(cases[0].input[k]);
      return type === 'std::string' ? `tc.${k}` : `std::to_string(tc.${k})`;
    })
    .join(' + ", " + ');

  return `#include <iostream>
#include <string>
#include <vector>

${retType} ${property}(${paramDecls});

int main() {
    struct TestCase {
${structFields.join('\n')}
    };

    std::vector<TestCase> testCases = {
${testCaseEntries.join('\n')}
    };

    for (const auto& tc : testCases) {
        auto res = ${property}(${callArgs});
        std::string msg = "${property}(" + ${strParams} + ") - " + tc.desc;
        Tests.equal_check(msg, tc.expected, res);
    }

    return 0;
}
`;
}
