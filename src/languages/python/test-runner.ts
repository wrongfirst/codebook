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

  const testCaseTuples = cases.map((c) => {
    const inputVals = inputKeys.map((k) => formatPyValue(c.input[k]));
    const expVal = formatPyValue(c.expected);
    const desc = escapePyString(c.description);
    return `    (${[...inputVals, expVal, desc].join(', ')}),`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `{${argVars[0]}}` : argVars.map((v) => `{${v}}`).join(', '))
    : '';

  const cycleKey = inputKeys.find((k) => inputsMeta[k] === 'linked_list_cycle');
  const posKey = cycleKey
    ? (inputKeys.find((k) => k === 'pos' || k === `${cycleKey}_pos` || k === `${cycleKey}Pos`) ||
       (inputKeys.length === 2 ? inputKeys.find((k) => k !== cycleKey) : undefined))
    : undefined;
  const posIdx = posKey ? inputKeys.indexOf(posKey) : -1;

  // Input transforms
  const inputTransforms: string[] = [];
  const callArgVars: string[] = [];
  for (let i = 0; i < inputKeys.length; i++) {
    const key = inputKeys[i];
    const v = argVars[i];
    const type = inputsMeta[key];
    if (type === 'linked_list_cycle') {
      const posVar = posIdx !== -1 ? argVars[posIdx] : '-1';
      inputTransforms.push(`${v}_in = make_cycle(${v}, ${posVar})`);
      callArgVars.push(`${v}_in`);
    } else if (key === posKey && cycleKey) {
      continue;
    } else if (type === 'tree') {
      inputTransforms.push(`${v}_in = list_to_tree(${v})`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'tree_node') {
      inputTransforms.push(`${v}_in = TreeNode(${v}) if isinstance(${v}, int) else ${v}`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'linked_list') {
      inputTransforms.push(`${v}_in = list_to_linked_list(${v})`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'linked_list_array') {
      inputTransforms.push(`${v}_in = [list_to_linked_list(x) for x in ${v}]`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'graph') {
      inputTransforms.push(`${v}_in = build_graph(${v})`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'interval') {
      inputTransforms.push(`${v}_in = Interval(${v}[0], ${v}[1]) if isinstance(${v}, (list, tuple)) else ${v}`);
      callArgVars.push(`${v}_in`);
    } else if (type === 'interval_array') {
      inputTransforms.push(`${v}_in = [Interval(x[0], x[1]) for x in ${v}]`);
      callArgVars.push(`${v}_in`);
    } else {
      inputTransforms.push(`${v}_in = ${v}`);
      callArgVars.push(`${v}_in`);
    }
  }

  const callArgs = callArgVars.join(', ');

  // In-place mutation
  if (mutation?.target) {
    const targetIdx = inputKeys.indexOf(mutation.target);
    const targetVar = targetIdx !== -1 ? `${argVars[targetIdx]}_in` : `${argVars[0]}_in`;
    const postTransform =
      returns === 'linked_list' ? `linked_list_to_list(${targetVar})` : targetVar;
    return `import copy

if '${property}' not in globals():
    raise Exception("${property} function is not defined")

test_cases = [
${testCaseTuples.join('\n')}
]

for ${destructureArgs} in test_cases:
${inputTransforms.map((t) => '    ' + t).join('\n')}
    ${property}(${callArgs})
    res = ${postTransform}
    Tests.equal_check(f"${property}(${argFmt}) - {desc}", expected, res)
`;
  }

  // Result transformation
  let resTransform = 'res';
  if (returns === 'tree') {
    resTransform = 'tree_to_list(res)';
  } else if (returns === 'tree_node') {
    resTransform = 'res.val if res else None';
  } else if (returns === 'linked_list') {
    resTransform = 'linked_list_to_list(res)';
  } else if (returns === 'graph') {
    resTransform = 'graph_to_adj(res)';
  }

  // Assertion check
  let assertion = `Tests.equal_check(f"${property}(${argFmt}) - {desc}", expected, ${resTransform})`;
  if (comparison === 'unordered') {
    assertion = `Tests.equal_check(f"${property}(${argFmt}) - {desc}", sorted(expected), sorted(${resTransform}))`;
  } else if (comparison === 'unordered_nested') {
    assertion = `Tests.unordered_equal_check(f"${property}(${argFmt}) - {desc}", expected, ${resTransform})`;
  }

  return `if '${property}' not in globals():
    raise Exception("${property} function is not defined")

test_cases = [
${testCaseTuples.join('\n')}
]

for ${destructureArgs} in test_cases:
${inputTransforms.length > 0 ? inputTransforms.map((t) => '    ' + t).join('\n') + '\n' : ''}    res = ${property}(${callArgs})
    ${assertion}
`;
}

function buildOperationsTestCode(cases: FlatCanonicalTestCase[]): string {
  const caseRows = cases.map((c) => {
    const ops = c.input.operations || [];
    const args = c.input.arguments || [];
    const exp = c.expected || [];
    const desc = escapePyString(c.description);
    return `    (${formatPyValue(ops)}, ${formatPyValue(args)}, ${formatPyValue(exp)}, ${desc}),`;
  });

  return `test_cases = [
${caseRows.join('\n')}
]

for operations, arguments, expected, desc in test_cases:
    obj = None
    res = []
    for op, arg in zip(operations, arguments):
        if obj is None:
            cls = globals().get(op)
            if not cls:
                raise Exception(f"{op} class is not defined")
            obj = cls(*arg)
            res.append(None)
        else:
            method = getattr(obj, op)
            r = method(*arg)
            res.append(r)
    Tests.equal_check(f"Operations - {desc}", expected, res)
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

  const testCaseTuples = cases.map((c) => {
    const inputVals = inputKeys.map((k) => formatPyValue(c.input[k]));
    const expVal = formatPyValue(c.expected);
    const desc = escapePyString(c.description);
    return `    (${[...inputVals, expVal, desc].join(', ')}),`;
  });

  const argFmt = hasInputs
    ? (inputKeys.length === 1 ? `{${argVars[0]}}` : argVars.map((v) => `{${v}}`).join(', '))
    : '';

  const inputTransforms = inputKeys.map((key, i) => {
    const v = argVars[i];
    const type = inputsMeta[key];
    if (type === 'tree') return `${v}_in = list_to_tree(${v})`;
    if (type === 'tree_node') return `${v}_in = TreeNode(${v}) if isinstance(${v}, int) else ${v}`;
    if (type === 'linked_list') return `${v}_in = list_to_linked_list(${v})`;
    return `${v}_in = ${v}`;
  });

  const callArgs = inputKeys.map((_, i) => `${argVars[i]}_in`).join(', ');

  let resTransform = 'res';
  if (returns === 'tree') {
    resTransform = 'tree_to_list(res)';
  } else if (returns === 'linked_list') {
    resTransform = 'linked_list_to_list(res)';
  }

  const receiverCheck = receiver
    ? `cls = globals().get("${receiver}")\ninst = cls() if cls else None`
    : `inst = None`;

  const invocation = receiver
    ? `if inst:
        encoded = getattr(inst, "${innerFn}")(${callArgs})
        res = getattr(inst, "${outerFn}")(encoded)
    else:
        res = ${outerFn}(${innerFn}(${callArgs}))`
    : `res = ${outerFn}(${innerFn}(${callArgs}))`;

  return `test_cases = [
${testCaseTuples.join('\n')}
]

${receiverCheck}

for ${destructureArgs} in test_cases:
${inputTransforms.length > 0 ? inputTransforms.map((t) => '    ' + t).join('\n') + '\n' : ''}    ${invocation}
    Tests.equal_check(f"${outerFn}(${innerFn}(${argFmt})) - {desc}", expected, ${resTransform})
`;
}
