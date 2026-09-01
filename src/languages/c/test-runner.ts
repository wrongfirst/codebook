import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

function inferCType(val: any, hint?: string): string {
  if (hint === 'tree') return 'int*';
  if (hint === 'tree_node') return 'int';
  if (hint === 'linked_list' || hint === 'linked_list_cycle') return 'int*';
  if (hint === 'linked_list_array') return 'int**';
  if (hint === 'graph') return 'int**';
  if (hint === 'interval') return 'Interval';
  if (hint === 'interval_array') return 'Interval*';

  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'double';
  if (typeof val === 'string') return 'const char*';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'int*';
    if (typeof val[0] === 'string') return 'const char**';
    if (Array.isArray(val[0])) return 'int**';
    return 'int*';
  }
  return 'const char*';
}

function formatCLiteral(val: any): string {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return 'NULL';
    if (Array.isArray(val[0])) {
      const rows = val.map((r: any) => `(int[]){${r.join(', ')}}`);
      return `(int*[]){${rows.join(', ')}}`;
    }
    return `(int[]){${val.join(', ')}}`;
  }
  return JSON.stringify(val);
}

function getCAssertion(expected: any, comparison = 'exact', resExpr = 'res'): string {
  if (comparison === 'unordered' || comparison === 'unordered_nested') {
    if (Array.isArray(expected) && expected.length > 0 && typeof expected[0] === 'string') {
      return `Tests.unordered_equal_check_str(msg, (char***)testCases[i].expected, NULL, numTests, (char***)${resExpr}, NULL, numTests);`;
    }
    return `Tests.unordered_equal_check(msg, (int**)testCases[i].expected, NULL, sizeof(testCases[i].expected)/sizeof(testCases[i].expected[0]), (int**)${resExpr}, NULL, sizeof(testCases[i].expected)/sizeof(testCases[i].expected[0]));`;
  }

  if (typeof expected === 'string') {
    return `Tests.equal_check_str(msg, testCases[i].expected, ${resExpr});`;
  }
  if (typeof expected === 'number') {
    return Number.isInteger(expected)
      ? `Tests.equal_check_int(msg, testCases[i].expected, ${resExpr});`
      : `Tests.equal_check_double(msg, testCases[i].expected, ${resExpr});`;
  }
  if (typeof expected === 'boolean') {
    return `Tests.bool_check(msg, ${resExpr} == testCases[i].expected);`;
  }
  if (Array.isArray(expected)) {
    if (expected.length > 0 && typeof expected[0] === 'number') {
      return `Tests.equal_check_int_arr(msg, testCases[i].expected, sizeof(testCases[i].expected)/sizeof(testCases[i].expected[0]), ${resExpr}, out_len);`;
    }
  }
  return `Tests.equal_check_str(msg, testCases[i].expected, ${resExpr});`;
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

  const retType = inferCType(cases[0].expected, returns === 'tree' ? 'tree' : undefined);

  const structFields = [
    ...inputKeys.map((k) => `        ${inferCType(cases[0].input[k], inputsMeta[k])} ${k};`),
    `        ${retType} expected;`,
    `        const char* desc;`
  ];

  const testCaseEntries = cases.map((c) => {
    const inputs = inputKeys.map((k) => formatCLiteral(c.input[k]));
    const exp = formatCLiteral(c.expected);
    const desc = JSON.stringify(c.description);
    return `        {${[...inputs, exp, desc].join(', ')}},`;
  });

  const cycleKey = inputKeys.find((k) => inputsMeta[k] === 'linked_list_cycle');
  const posKey = cycleKey
    ? (inputKeys.find((k) => k === 'pos' || k === `${cycleKey}_pos` || k === `${cycleKey}Pos`) ||
       (inputKeys.length === 2 ? inputKeys.find((k) => k !== cycleKey) : undefined))
    : undefined;

  const callArgExprs: string[] = [];
  for (const k of inputKeys) {
    if (k === posKey && cycleKey) continue;
    const type = inputsMeta[k];
    if (type === 'linked_list_cycle') {
      const pKey = posKey || 'pos';
      callArgExprs.push(`make_cycle(testCases[i].${k}, testCases[i].${k} ? sizeof(testCases[i].${k})/sizeof(int) : 0, testCases[i].${pKey})`);
    } else if (type === 'linked_list') {
      callArgExprs.push(`list_to_linked_list(testCases[i].${k}, testCases[i].${k} ? sizeof(testCases[i].${k})/sizeof(int) : 0)`);
    } else if (type === 'tree') {
      callArgExprs.push(`ints_to_tree(testCases[i].${k}, testCases[i].${k} ? sizeof(testCases[i].${k})/sizeof(int) : 0)`);
    } else if (type === 'graph') {
      callArgExprs.push(`build_graph(testCases[i].${k}, NULL, sizeof(testCases[i].${k})/sizeof(int*))`);
    } else {
      callArgExprs.push(`testCases[i].${k}`);
    }
  }

  const callArgs = callArgExprs.join(', ');

  const snprintfFmt = inputKeys
    .map((k) => (inferCType(cases[0].input[k], inputsMeta[k]) === 'const char*' ? '%s' : '%d'))
    .join(', ');
  const snprintfArgs = inputKeys.map((k) => `testCases[i].${k}`).join(', ');
  const msgFormat = hasInputs
    ? `snprintf(msg, sizeof(msg), "${property}(${snprintfFmt}) - %s", ${snprintfArgs}, testCases[i].desc);`
    : `snprintf(msg, sizeof(msg), "${property}() - %s", testCases[i].desc);`;

  let resTransform = 'res';
  let outLenDecl = '';
  if (returns === 'tree') {
    resTransform = 'tree_to_ints(res, &out_len)';
    outLenDecl = '        int out_len = 0;\n';
  } else if (returns === 'tree_node') {
    resTransform = 'res ? res->val : -1';
  } else if (returns === 'linked_list') {
    resTransform = 'linked_list_to_list(res, &out_len)';
    outLenDecl = '        int out_len = 0;\n';
  } else if (returns === 'graph') {
    resTransform = 'graph_to_adj(res, &out_row_size, &out_col_sizes)';
    outLenDecl = '        int out_row_size = 0;\n        int* out_col_sizes = NULL;\n';
  }

  const assertion = getCAssertion(cases[0].expected, comparison, resTransform);

  // In-place mutation
  if (mutation?.target) {
    const targetIdx = inputKeys.indexOf(mutation.target);
    const targetKey = targetIdx !== -1 ? inputKeys[targetIdx] : inputKeys[0];
    const postTransform =
      returns === 'linked_list' ? 'linked_list_to_list(targetVar, &out_len)' : 'targetVar';
    return `#include <stdio.h>
#include <stdbool.h>

void ${property}(${inferCType(cases[0].input[targetKey], inputsMeta[targetKey])});

int main() {
    struct TestCase {
${structFields.join('\n')}
    } testCases[] = {
${testCaseEntries.join('\n')}
    };

    int numTests = sizeof(testCases) / sizeof(testCases[0]);
    for (int i = 0; i < numTests; i++) {
        ${outLenDecl}        auto targetVar = testCases[i].${targetKey};
        ${property}(targetVar);
        char msg[128];
        ${msgFormat}
        ${getCAssertion(cases[0].expected, comparison, postTransform)}
    }

    return 0;
}
`;
  }

  return `#include <stdio.h>
#include <stdbool.h>

${retType} ${property}(${hasInputs ? inputKeys.map((k) => `${inferCType(cases[0].input[k], inputsMeta[k])} ${k}`).join(', ') : 'void'});

int main() {
    struct TestCase {
${structFields.join('\n')}
    } testCases[] = {
${testCaseEntries.join('\n')}
    };

    int numTests = sizeof(testCases) / sizeof(testCases[0]);
    for (int i = 0; i < numTests; i++) {
${outLenDecl}        ${retType} res = ${property}(${callArgs});
        char msg[128];
        ${msgFormat}
        ${assertion}
    }

    return 0;
}
`;
}
