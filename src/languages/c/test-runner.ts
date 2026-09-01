import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function inferCType(val: any): string {
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'double';
  if (typeof val === 'string') return 'const char*';
  return 'const char*';
}

function formatCLiteral(val: any): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  return JSON.stringify(val);
}

function getCAssertion(expected: any): string {
  if (typeof expected === 'string') return 'Tests.equal_check_str(msg, testCases[i].expected, res);';
  if (typeof expected === 'number') {
    return Number.isInteger(expected)
      ? 'Tests.equal_check_int(msg, testCases[i].expected, res);'
      : 'Tests.equal_check_double(msg, testCases[i].expected, res);';
  }
  if (typeof expected === 'boolean') return 'Tests.bool_check(msg, res == testCases[i].expected);';
  return 'Tests.equal_check_str(msg, testCases[i].expected, res);';
}

export function buildTestCode(cases: FlatCanonicalTestCase[], _meta: CanonicalData): string {
  if (!cases.length) return '';

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});

  const retType = inferCType(cases[0].expected);
  const paramDecls = inputKeys.map((k) => `${inferCType(cases[0].input[k])} ${k}`).join(', ');

  const structFields = [
    ...inputKeys.map((k) => `        ${inferCType(cases[0].input[k])} ${k};`),
    `        ${retType} expected;`,
    `        const char* desc;`
  ];

  const testCaseEntries = cases.map((c) => {
    const inputs = inputKeys.map((k) => formatCLiteral(c.input[k]));
    const exp = formatCLiteral(c.expected);
    const desc = JSON.stringify(c.description);
    return `        {${[...inputs, exp, desc].join(', ')}},`;
  });

  const callArgs = inputKeys.map((k) => `testCases[i].${k}`).join(', ');
  const snprintfFmt = inputKeys
    .map((k) => (inferCType(cases[0].input[k]) === 'const char*' ? '%s' : '%d'))
    .join(', ');
  const snprintfArgs = inputKeys.map((k) => `testCases[i].${k}`).join(', ');
  const assertion = getCAssertion(cases[0].expected);

  return `#include <stdio.h>
#include <stdbool.h>

${retType} ${property}(${paramDecls});

#ifndef _CODEBOOK_HARNESS_C_
typedef struct {
    void (*bool_check)(const char* msg, bool b);
    void (*equal_check_int)(const char* msg, int exp, int act);
    void (*equal_check_long)(const char* msg, long long exp, long long act);
    void (*equal_check_double)(const char* msg, double exp, double act);
    void (*equal_check_str)(const char* msg, const char* exp, const char* act);
    void (*equal_check_int_arr)(const char* msg, const int* exp, int exp_len, const int* act, int act_len);
} _HarnessTests;
extern const _HarnessTests Tests;
#endif

int main() {
    struct TestCase {
${structFields.join('\n')}
    } testCases[] = {
${testCaseEntries.join('\n')}
    };

    int numTests = sizeof(testCases) / sizeof(testCases[0]);
    for (int i = 0; i < numTests; i++) {
        ${retType} res = ${property}(${callArgs});
        char msg[128];
        snprintf(msg, sizeof(msg), "${property}(${snprintfFmt}) - %s", ${snprintfArgs}, testCases[i].desc);
        ${assertion}
    }

    return 0;
}
`;
}
