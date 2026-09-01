/**
 * Root JSON structure of a canonical-data.json file
 */
export interface CanonicalData {
  exercise: string;
  comments?: string[];
  cases: CanonicalCase[];
}

/**
 * A canonical case item is either a leaf test case or a group containing nested cases.
 */
export type CanonicalCase = CanonicalTestCase | CanonicalCaseGroup;

/**
 * A group of test cases with a descriptive grouping label.
 */
export interface CanonicalCaseGroup {
  description: string;
  cases: CanonicalCase[];
}

/**
 * Leaf test case representing a single test invocation.
 */
export interface CanonicalTestCase {
  uuid?: string;
  description: string;
  property: string;
  input: Record<string, any>;
  expected: any;
  comments?: string[];
}

/**
 * Flattened test case preserving optional parent group description context.
 */
export interface FlatCanonicalTestCase extends CanonicalTestCase {
  groupDescription?: string;
}

/**
 * Type guard to distinguish leaf CanonicalTestCase from CanonicalCaseGroup.
 */
export function isTestCase(c: CanonicalCase): c is CanonicalTestCase {
  return 'property' in c && 'input' in c;
}

/**
 * Recursively flattens nested case groups into a flat array of test cases.
 */
export function flattenCases(
  cases: CanonicalCase[],
  groupDesc?: string
): FlatCanonicalTestCase[] {
  const result: FlatCanonicalTestCase[] = [];

  for (const c of cases) {
    if (isTestCase(c)) {
      result.push({
        ...c,
        ...(groupDesc ? { groupDescription: groupDesc } : {})
      });
    } else if (Array.isArray(c.cases)) {
      const nestedGroup = groupDesc
        ? `${groupDesc} - ${c.description}`
        : c.description;
      result.push(...flattenCases(c.cases, nestedGroup));
    }
  }

  return result;
}
