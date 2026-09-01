import type { FlatCanonicalTestCase, CanonicalData } from '../canonical';

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
  const argVars = inputKeys.length === 1 ? ['arg1'] : inputKeys.map((_, i) => `arg${i + 1}`);
  const destructureArgs = hasInputs ? `${argVars.join(', ')}, expected, desc` : 'expected, desc';

  const testCaseRows = cases.map((c) => {
    const inputVals = inputKeys.map((k) => JSON.stringify(c.input[k]));
    const expVal = JSON.stringify(c.expected);
    const desc = JSON.stringify(c.description);
    return `  [${[...inputVals, expVal, desc].join(', ')}],`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `\${${argVars[0]}}` : argVars.map((v) => `\${${v}}`).join(', '))
    : '';

  const cycleKey = inputKeys.find((k) => inputsMeta[k] === 'linked_list_cycle');
  const posKey = cycleKey
    ? (inputKeys.find((k) => k === 'pos' || k === `${cycleKey}_pos` || k === `${cycleKey}Pos`) ||
       (inputKeys.length === 2 ? inputKeys.find((k) => k !== cycleKey) : undefined))
    : undefined;
  const posIdx = posKey ? inputKeys.indexOf(posKey) : -1;

  const inputTransforms: string[] = [];
  const callArgVars: string[] = [];
  for (let i = 0; i < inputKeys.length; i++) {
    const key = inputKeys[i];
    const v = argVars[i];
    const type = inputsMeta[key];
    if (type === 'linked_list_cycle') {
      const posVar = posIdx !== -1 ? argVars[posIdx] : '-1';
      inputTransforms.push(`  const ${v}_in = makeCycle(${v}, ${posVar});`);
      callArgVars.push(`${v}_in as any`);
    } else if (key === posKey && cycleKey) {
      continue;
    } else if (type === 'tree') {
      inputTransforms.push(`  const ${v}_in = listToTree(${v});`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'tree_node') {
      inputTransforms.push(`  const ${v}_in = typeof ${v} === 'number' ? new TreeNode(${v}) : ${v};`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'linked_list') {
      inputTransforms.push(`  const ${v}_in = listToLinkedList(${v});`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'linked_list_array') {
      inputTransforms.push(`  const ${v}_in = ${v}.map(listToLinkedList);`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'graph') {
      inputTransforms.push(`  const ${v}_in = buildGraph(${v});`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'interval') {
      inputTransforms.push(`  const ${v}_in = new Interval(${v}[0], ${v}[1]);`);
      callArgVars.push(`${v}_in as any`);
    } else if (type === 'interval_array') {
      inputTransforms.push(`  const ${v}_in = ${v}.map((x: any) => new Interval(x[0], x[1]));`);
      callArgVars.push(`${v}_in as any`);
    } else {
      inputTransforms.push(`  const ${v}_in = ${v};`);
      callArgVars.push(`${v}_in as any`);
    }
  }

  const callArgs = callArgVars.join(', ');

  // In-place mutation
  if (mutation?.target) {
    const targetIdx = inputKeys.indexOf(mutation.target);
    const targetVar = targetIdx !== -1 ? `${argVars[targetIdx]}_in` : `${argVars[0]}_in`;
    const postTransform =
      returns === 'linked_list' ? `linkedListToList(${targetVar})` : targetVar;
    return `// @ts-nocheck
if (typeof ${property} !== "function") {
  throw new Error("${property} function is not defined");
}

const testCases = [
${testCaseRows.join('\n')}
];

for (const [${destructureArgs}] of testCases) {
${inputTransforms.join('\n')}
  ${property}(${callArgs});
  const result = ${postTransform};
  Tests.equalCheck(\`${property}(${argFmt}) - \${desc}\`, expected, result);
}
`;
  }

  let resTransform = 'result';
  if (returns === 'tree') resTransform = 'treeToList(result)';
  else if (returns === 'tree_node') resTransform = 'result?.val ?? null';
  else if (returns === 'linked_list') resTransform = 'linkedListToList(result)';
  else if (returns === 'graph') resTransform = 'graphToAdj(result)';

  let assertion = `Tests.equalCheck(\`${property}(${argFmt}) - \${desc}\`, expected, ${resTransform});`;
  if (comparison === 'unordered' || comparison === 'unordered_nested') {
    assertion = `Tests.unorderedEqualCheck(\`${property}(${argFmt}) - \${desc}\`, expected, ${resTransform});`;
  }

  return `// @ts-nocheck
if (typeof ${property} !== "function") {
  throw new Error("${property} function is not defined");
}

const testCases = [
${testCaseRows.join('\n')}
];

for (const [${destructureArgs}] of testCases) {
${inputTransforms.length > 0 ? inputTransforms.join('\n') + '\n' : ''}  const result = ${property}(${callArgs});
  ${assertion}
}
`;
}

function buildOperationsTestCode(cases: FlatCanonicalTestCase[]): string {
  const testCaseRows = cases.map((c) => {
    const ops = c.input.operations || [];
    const args = c.input.arguments || [];
    const exp = c.expected || [];
    const desc = JSON.stringify(c.description);
    return `  [${JSON.stringify(ops)}, ${JSON.stringify(args)}, ${JSON.stringify(exp)}, ${desc}],`;
  });

  return `// @ts-nocheck
const testCases = [
${testCaseRows.join('\n')}
];

for (const [operations, args, expected, desc] of testCases) {
  let obj: any = null;
  const res: any[] = [];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const arg = args[i];
    if (obj === null) {
      const Cls = (globalThis as any)[op] || (typeof eval !== 'undefined' ? eval(op) : null);
      if (!Cls) throw new Error(\`\${op} class is not defined\`);
      obj = new Cls(...arg);
      res.push(null);
    } else {
      const r = obj[op](...arg);
      res.push(r === undefined ? null : r);
    }
  }
  Tests.equalCheck(\`Operations - \${desc}\`, expected, res);
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
  const hasInputs = inputKeys.length > 0;
  const argVars = inputKeys.length === 1 ? ['arg1'] : inputKeys.map((_, i) => `arg${i + 1}`);
  const destructureArgs = hasInputs ? `${argVars.join(', ')}, expected, desc` : 'expected, desc';

  const testCaseRows = cases.map((c) => {
    const inputVals = inputKeys.map((k) => JSON.stringify(c.input[k]));
    const expVal = JSON.stringify(c.expected);
    const desc = JSON.stringify(c.description);
    return `  [${[...inputVals, expVal, desc].join(', ')}],`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `\${${argVars[0]}}` : argVars.map((v) => `\${${v}}`).join(', '))
    : '';

  const inputTransforms = inputKeys.map((key, i) => {
    const v = argVars[i];
    const type = inputsMeta[key];
    if (type === 'tree') return `  const ${v}_in = listToTree(${v});`;
    if (type === 'tree_node') return `  const ${v}_in = typeof ${v} === 'number' ? new TreeNode(${v}) : ${v};`;
    if (type === 'linked_list') return `  const ${v}_in = listToLinkedList(${v});`;
    return `  const ${v}_in = ${v};`;
  });

  const callArgs = inputKeys.map((_, i) => `${argVars[i]}_in as any`).join(', ');

  let resTransform = 'result';
  if (returns === 'tree') resTransform = 'treeToList(result)';
  else if (returns === 'linked_list') resTransform = 'linkedListToList(result)';

  const receiverSetup = receiver
    ? `const Cls = (globalThis as any)["${receiver}"] || (typeof eval !== 'undefined' ? eval("${receiver}") : null);\nconst inst = Cls ? new Cls() : null;`
    : `const inst = null;`;

  const callExpr = receiver
    ? `const result = inst ? inst.${outerFn}(inst.${innerFn}(${callArgs})) : ${outerFn}(${innerFn}(${callArgs}));`
    : `const result = ${outerFn}(${innerFn}(${callArgs}));`;

  return `// @ts-nocheck
const testCases = [
${testCaseRows.join('\n')}
];

${receiverSetup}

for (const [${destructureArgs}] of testCases) {
${inputTransforms.length > 0 ? inputTransforms.join('\n') + '\n' : ''}  ${callExpr}
  Tests.equalCheck(\`${outerFn}(${innerFn}(${argFmt})) - \${desc}\`, expected, ${resTransform});
}
`;
}
