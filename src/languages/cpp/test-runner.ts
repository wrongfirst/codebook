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

export function buildTestCode(cases: FlatCanonicalTestCase[], meta: CanonicalData): string {
  if (!cases.length) return '';

  const mode = meta?.mode || (cases[0].property === 'operations' ? 'operations' : 'function');

  if (mode === 'operations') {
    return buildOperationsTestCode(cases);
  }

  if (mode === 'compose' || meta?.compose) {
    return buildComposeTestCode(cases, meta);
  }

  const comparison = meta?.comparison || cases[0]?.comparison || 'exact';
  const returns = meta?.returns || cases[0]?.returns || 'standard';
  const inputsMeta = meta?.inputs || cases[0]?.inputs || {};
  const mutation = meta?.mutation || cases[0]?.mutation;

  const property = cases[0].property;
  const inputKeys = Object.keys(cases[0].input || {});
  const hasInputs = inputKeys.length > 0;

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
      callArgExprs.push(`make_cycle(tc.${k}, tc.${pKey})`);
    } else if (type === 'tree') {
      callArgExprs.push(`list_to_tree(tc.${k})`);
    } else if (type === 'tree_node') {
      callArgExprs.push(`new TreeNode(tc.${k})`);
    } else if (type === 'linked_list') {
      callArgExprs.push(`list_to_linked_list(tc.${k})`);
    } else if (type === 'linked_list_array') {
      callArgExprs.push(
        `[&]() { std::vector<ListNode*> v; for (const auto& l : tc.${k}) v.push_back(list_to_linked_list(l)); return v; }()`
      );
    } else if (type === 'graph') {
      callArgExprs.push(`build_graph(tc.${k})`);
    } else {
      callArgExprs.push(`tc.${k}`);
    }
  }

  const callArgs = callArgExprs.join(', ');
  const strParams = inputKeys
    .map((k) => {
      const type = inferCppType(cases[0].input[k]);
      return type === 'std::string' ? `tc.${k}` : `std::to_string(tc.${k})`;
    })
    .join(' + ", " + ');

  const msgExpr = hasInputs
    ? `"${property}(" + ${strParams} + ") - " + tc.desc`
    : `"${property}() - " + tc.desc`;

  // In-place mutation
  if (mutation?.target) {
    const targetIdx = inputKeys.indexOf(mutation.target);
    const targetKey = targetIdx !== -1 ? inputKeys[targetIdx] : inputKeys[0];
    const postTransform = returns === 'linked_list' ? `linked_list_to_list(targetVar)` : `targetVar`;
    return `#include <iostream>
#include <string>
#include <vector>

void ${property}(${paramDecls});

int main() {
    struct TestCase {
${structFields.join('\n')}
    };

    std::vector<TestCase> testCases = {
${testCaseEntries.join('\n')}
    };

    for (const auto& tc : testCases) {
        auto targetVar = tc.${targetKey};
        ${property}(targetVar);
        std::string msg = ${msgExpr};
        Tests.equal_check(msg, tc.expected, ${postTransform});
    }

    return 0;
}
`;
  }

  let resTransform = 'res';
  if (returns === 'tree') resTransform = 'tree_to_list(res)';
  else if (returns === 'tree_node') resTransform = 'res ? res->val : -1';
  else if (returns === 'linked_list') resTransform = 'linked_list_to_list(res)';
  else if (returns === 'graph') resTransform = 'graph_to_adj(res)';

  let assertion = `Tests.equal_check(msg, tc.expected, ${resTransform});`;
  if (comparison === 'unordered' || comparison === 'unordered_nested') {
    assertion = `Tests.unordered_equal_check(msg, tc.expected, ${resTransform});`;
  }

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
        std::string msg = ${msgExpr};
        ${assertion}
    }

    return 0;
}
`;
}

function buildOperationsTestCode(cases: FlatCanonicalTestCase[]): string {
  const caseBlocks = cases.map((c) => {
    const ops: string[] = c.input.operations || [];
    const args: any[][] = c.input.arguments || [];
    const exp: any[] = c.expected || [];

    const steps: string[] = [];
    steps.push(`        // ${c.description}`);
    const ctorArgs = (args[0] || []).map(formatCppLiteral).join(', ');
    const clsName = ops[0];
    steps.push(`        ${clsName} obj(${ctorArgs});`);

    for (let i = 1; i < ops.length; i++) {
      const op = ops[i];
      const methodArgs = (args[i] || []).map(formatCppLiteral).join(', ');
      const expectedVal = exp[i];

      if (expectedVal === null || expectedVal === undefined) {
        steps.push(`        obj.${op}(${methodArgs});`);
      } else {
        const expLit = formatCppLiteral(expectedVal);
        const msg = JSON.stringify(`${op}(${methodArgs}) - ${c.description}`);
        steps.push(
          `        Tests.equal_check(${msg}, ${expLit}, obj.${op}(${methodArgs}));`
        );
      }
    }

    return `    {\n${steps.join('\n')}\n    }`;
  });

  return `#include <iostream>
#include <string>
#include <vector>

int main() {
${caseBlocks.join('\n\n')}
    return 0;
}
`;
}

function buildComposeTestCode(cases: FlatCanonicalTestCase[], meta: CanonicalData): string {
  const compose = meta.compose || ['decode', 'encode'];
  const outerFn = compose[0];
  const innerFn = compose[1];
  const receiver = meta.receiver;
  const returns = meta.returns || 'standard';
  const inputsMeta = meta.inputs || {};

  const inputKeys = Object.keys(cases[0].input || {});

  const retType = inferCppType(cases[0].expected);
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

  const callArgExprs = inputKeys.map((k) => {
    const type = inputsMeta[k];
    if (type === 'tree') return `list_to_tree(tc.${k})`;
    if (type === 'linked_list') return `list_to_linked_list(tc.${k})`;
    return `tc.${k}`;
  });
  const callArgs = callArgExprs.join(', ');

  let resTransform = 'res';
  if (returns === 'tree') resTransform = 'tree_to_list(res)';
  else if (returns === 'linked_list') resTransform = 'linked_list_to_list(res)';

  const strParams = inputKeys
    .map((k) => {
      const type = inferCppType(cases[0].input[k]);
      return type === 'std::string' ? `tc.${k}` : `std::to_string(tc.${k})`;
    })
    .join(' + ", " + ');

  const msgExpr = `"${outerFn}(" + "${innerFn}(" + ${strParams} + ")) - " + tc.desc`;

  const instSetup = receiver
    ? `        ${receiver} inst;\n        auto res = inst.${outerFn}(inst.${innerFn}(${callArgs}));`
    : `        auto res = ${outerFn}(${innerFn}(${callArgs}));`;

  return `#include <iostream>
#include <string>
#include <vector>

int main() {
    struct TestCase {
${structFields.join('\n')}
    };

    std::vector<TestCase> testCases = {
${testCaseEntries.join('\n')}
    };

    for (const auto& tc : testCases) {
${instSetup}
        std::string msg = ${msgExpr};
        Tests.equal_check(msg, tc.expected, ${resTransform});
    }

    return 0;
}
`;
}
