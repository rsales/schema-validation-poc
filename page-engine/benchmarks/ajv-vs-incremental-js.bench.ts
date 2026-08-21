import Ajv2020 from 'ajv/dist/2020.js'

import {
  loadPage,
  loadSchema,
} from './fixtures'

import {
  validatePage,
} from '../src/validator'

import {
  affectedScope,
} from '../src/incremental'

import {
  validateIncremental,
} from '../src/incremental-validator'

import {
  buildJsonSchema,
} from '../ajv/schema'

import type {
  ComponentSchema,
  PageNode,
  PageChange,
} from '../src/types'

const ITERATIONS = 100_000

const PAGE_SIZES = [
  5,
  36,
  761,
  5_000,
  10_000,
]

type ChangeType =
  | 'field_changed'
  | 'node_added'
  | 'node_removed'
  | 'node_moved'

interface BenchmarkResult {
  elapsed: number
  throughput: number
}

interface ScenarioResult {
  nodes: number
  change: ChangeType
  ajv: BenchmarkResult
  tsFull: BenchmarkResult
  tsIncremental: BenchmarkResult
}

interface Scenario {
  page: PageNode
  change: PageChange
  affectedPaths: number[][]
}

/*
 * --------------------------------------------------
 * Benchmark helpers
 * --------------------------------------------------
 */

function measure(
  fn: () => void,
): number {
  const start =
    performance.now()

  fn()

  return performance.now() - start
}

function throughput(
  elapsed: number,
): number {
  return (
    ITERATIONS /
    (elapsed / 1000)
  )
}

function benchmark(
  fn: () => void,
): BenchmarkResult {
  const elapsed =
    measure(fn)

  return {
    elapsed,
    throughput:
      throughput(elapsed),
  }
}

/**
 * Counts all nodes in a page tree.
 */
function countNodes(
  node: PageNode,
): number {
  let count = 1

  for (const child of node.children) {
    count += countNodes(child)
  }

  return count
}

/**
 * Expands the base fixture until it reaches
 * approximately the requested number of nodes.
 *
 * This keeps the benchmark deterministic while
 * reusing the same component structure.
 */
function scalePage(
  page: PageNode,
  targetNodes: number,
): PageNode {
  const scaled =
    structuredClone(page)

  if (
    countNodes(scaled) >=
    targetNodes
  ) {
    return scaled
  }

  const template =
    structuredClone(
      scaled.children[0],
    )

  while (
    countNodes(scaled) <
    targetNodes
  ) {
    scaled.children.push(
      structuredClone(template),
    )
  }

  return scaled
}

/*
 * --------------------------------------------------
 * Tree helpers
 * --------------------------------------------------
 */

interface ParentCandidate {
  parent: PageNode
  path: number[]
}

/**
 * Finds a parent that can accept another child.
 *
 * The parent must already contain at least one child,
 * which gives us a valid template for node_added.
 */
function findAddCandidate(
  page: PageNode,
  schema: ComponentSchema,
): ParentCandidate | undefined {
  return findParent(
    page,
    [],
    (node) => {
      const component =
        schema.components[node.type]

      return (
        component !== undefined &&
        node.children.length <
          component.maxChildren &&
        node.children.length > 0
      )
    },
  )
}

/**
 * Finds a parent from which a child can be removed
 * without violating minChildren.
 */
function findRemoveCandidate(
  page: PageNode,
  schema: ComponentSchema,
): ParentCandidate | undefined {
  return findParent(
    page,
    [],
    (node) => {
      const component =
        schema.components[node.type]

      return (
        component !== undefined &&
        node.children.length >
          component.minChildren
      )
    },
  )
}

/**
 * Finds a parent with at least two children.
 *
 * We use this for a deterministic move operation:
 * move child 0 to the end of the same parent.
 */
function findMoveCandidate(
  page: PageNode,
): ParentCandidate | undefined {
  return findParent(
    page,
    [],
    (node) =>
      node.children.length >= 2,
  )
}

function findParent(
  node: PageNode,
  path: number[],
  predicate: (
    node: PageNode,
  ) => boolean,
): ParentCandidate | undefined {
  if (predicate(node)) {
    return {
      parent: node,
      path,
    }
  }

  for (
    let index = 0;
    index < node.children.length;
    index++
  ) {
    const result =
      findParent(
        node.children[index],
        [
          ...path,
          index,
        ],
        predicate,
      )

    if (result) {
      return result
    }
  }

  return undefined
}

/*
 * --------------------------------------------------
 * Scenario creation
 * --------------------------------------------------
 */

function createFieldChangedScenario(
  page: PageNode,
): Scenario {
  /*
   * Change the first child.
   *
   * The actual field value is intentionally not
   * important for this benchmark because the
   * mutation itself is outside the validation
   * measurement.
   */
  return {
    page,
    change: {
      type: 'field_changed',
      path: [0],
    },
    affectedPaths: affectedScope(
      page,
      {
        type: 'field_changed',
        path: [0],
      },
    ),
  }
}

function createNodeAddedScenario(
  page: PageNode,
  schema: ComponentSchema,
): Scenario {
  const candidate =
    findAddCandidate(
      page,
      schema,
    )

  if (!candidate) {
    throw new Error(
      'Could not find a valid parent for node_added benchmark.',
    )
  }

  const {
    parent,
    path: parentPath,
  } = candidate

  const child =
    structuredClone(
      parent.children[0],
    )

  const childIndex =
    parent.children.length

  parent.children.push(
    child,
  )

  const change: PageChange = {
    type: 'node_added',
    path: [
      ...parentPath,
      childIndex,
    ],
  }

  return {
    page,
    change,
    affectedPaths:
      affectedScope(
        page,
        change,
      ),
  }
}

function createNodeRemovedScenario(
  page: PageNode,
  schema: ComponentSchema,
): Scenario {
  const candidate =
    findRemoveCandidate(
      page,
      schema,
    )

  if (!candidate) {
    throw new Error(
      'Could not find a valid parent for node_removed benchmark.',
    )
  }

  const {
    parent,
    path: parentPath,
  } = candidate

  const removedIndex = 0

  parent.children.splice(
    removedIndex,
    1,
  )

  const change: PageChange = {
    type: 'node_removed',
    path: [
      ...parentPath,
      removedIndex,
    ],
  }

  return {
    page,
    change,
    affectedPaths:
      affectedScope(
        page,
        change,
      ),
  }
}

function createNodeMovedScenario(
  page: PageNode,
): Scenario {
  const candidate =
    findMoveCandidate(
      page,
    )

  if (!candidate) {
    throw new Error(
      'Could not find a parent with at least two children for node_moved benchmark.',
    )
  }

  const {
    parent,
    path: parentPath,
  } = candidate

  const from = [
    ...parentPath,
    0,
  ]

  const to = [
    ...parentPath,
    parent.children.length - 1,
  ]

  /*
   * Move the first child to the end.
   *
   * The mutation happens before the benchmark.
   */
  const [moved] =
    parent.children.splice(
      0,
      1,
    )

  parent.children.push(
    moved,
  )

  const change: PageChange = {
    type: 'node_moved',
    from,
    to,
  }

  return {
    page,
    change,
    affectedPaths:
      affectedScope(
        page,
        change,
      ),
  }
}

function createScenario(
  type: ChangeType,
  basePage: PageNode,
  schema: ComponentSchema,
): Scenario {
  const page =
    structuredClone(
      basePage,
    )

  switch (type) {
    case 'field_changed':
      return createFieldChangedScenario(
        page,
      )

    case 'node_added':
      return createNodeAddedScenario(
        page,
        schema,
      )

    case 'node_removed':
      return createNodeRemovedScenario(
        page,
        schema,
      )

    case 'node_moved':
      return createNodeMovedScenario(
        page,
      )
  }
}

/*
 * --------------------------------------------------
 * Formatting
 * --------------------------------------------------
 */

function formatMs(
  value: number,
): string {
  return `${value
    .toFixed(2)
    .padStart(10)} ms`
}

function formatThroughput(
  value: number,
): string {
  return value
    .toFixed(0)
    .padStart(12)
}

function formatSpeedup(
  full: number,
  incremental: number,
): string {
  return `${(
    full / incremental
  )
    .toFixed(2)
    .padStart(8)}x`
}

/*
 * --------------------------------------------------
 * Fixtures
 * --------------------------------------------------
 */

const baseSchema =
  loadSchema()

const basePage =
  loadPage()

/*
 * --------------------------------------------------
 * AJV
 * --------------------------------------------------
 */

const ajv =
  new Ajv2020({
    allErrors: true,
    strict: true,
  })

const jsonSchema =
  buildJsonSchema(
    baseSchema,
  )

const ajvValidate =
  ajv.compile(
    jsonSchema,
  )

/*
 * --------------------------------------------------
 * Benchmark
 * --------------------------------------------------
 */

const CHANGE_TYPES: ChangeType[] = [
  'field_changed',
  'node_added',
  'node_removed',
  'node_moved',
]

const results: ScenarioResult[] = []

for (const changeType of CHANGE_TYPES) {
  console.log('')
  console.log(
    `Running ${changeType}...`,
  )

  for (const targetNodes of PAGE_SIZES) {
    const scaledPage =
      scalePage(
        basePage,
        targetNodes,
      )

    const scenario =
      createScenario(
        changeType,
        scaledPage,
        baseSchema,
      )

    const actualNodes =
      countNodes(
        scenario.page,
      )

    /*
     * ------------------------------------------------
     * Warm-up
     * ------------------------------------------------
     */

    for (
      let i = 0;
      i < 10_000;
      i++
    ) {
      ajvValidate(
        scenario.page,
      )

      validatePage(
        scenario.page,
        baseSchema,
      )

      validateIncremental(
        scenario.page,
        baseSchema,
        scenario.affectedPaths,
      )
    }

    /*
     * ------------------------------------------------
     * AJV Full
     * ------------------------------------------------
     */

    const ajvResult =
      benchmark(() => {
        for (
          let i = 0;
          i < ITERATIONS;
          i++
        ) {
          ajvValidate(
            scenario.page,
          )
        }
      })

    /*
     * ------------------------------------------------
     * TypeScript Full
     * ------------------------------------------------
     */

    const tsFullResult =
      benchmark(() => {
        for (
          let i = 0;
          i < ITERATIONS;
          i++
        ) {
          validatePage(
            scenario.page,
            baseSchema,
          )
        }
      })

    /*
     * ------------------------------------------------
     * TypeScript Incremental
     * ------------------------------------------------
     */

    const tsIncrementalResult =
      benchmark(() => {
        for (
          let i = 0;
          i < ITERATIONS;
          i++
        ) {
          validateIncremental(
            scenario.page,
            baseSchema,
            scenario.affectedPaths,
          )
        }
      })

    results.push({
      nodes: actualNodes,
      change: changeType,
      ajv: ajvResult,
      tsFull: tsFullResult,
      tsIncremental:
        tsIncrementalResult,
    })

    console.log(
      `✓ ${actualNodes} nodes`,
    )
  }
}

/*
 * --------------------------------------------------
 * Output
 * --------------------------------------------------
 */

for (const changeType of CHANGE_TYPES) {
  const scenarioResults =
    results.filter(
      (result) =>
        result.change ===
        changeType,
    )

  console.log('')

  console.log(
    `AJV vs TypeScript Incremental Validation — ${changeType}`,
  )

  console.log(
    '==============================================================',
  )

  console.log(
    `iterations: ${ITERATIONS}`,
  )

  console.log('')

  /*
   * ------------------------------------------------
   * Scaling
   * ------------------------------------------------
   */

  console.log(
    'Scaling Results',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  console.log(
    'Nodes       AJV Full      TS Full      TS Incremental    Full/Inc.',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  for (
    const result of scenarioResults
  ) {
    console.log(
      `${result.nodes
        .toString()
        .padStart(5)}  ` +
        `${formatMs(
          result.ajv.elapsed,
        )}  ` +
        `${formatMs(
          result.tsFull.elapsed,
        )}  ` +
        `${formatMs(
          result.tsIncremental
            .elapsed,
        )}       ` +
        formatSpeedup(
          result.tsFull.elapsed,
          result.tsIncremental
            .elapsed,
        ),
    )
  }

  console.log('')

  /*
   * ------------------------------------------------
   * Throughput
   * ------------------------------------------------
   */

  console.log(
    'Throughput',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  console.log(
    'Nodes       AJV/sec       TS Full/sec       TS Incremental/sec',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  for (
    const result of scenarioResults
  ) {
    console.log(
      `${result.nodes
        .toString()
        .padStart(5)}  ` +
        `${formatThroughput(
          result.ajv.throughput,
        )}  ` +
        `${formatThroughput(
          result.tsFull.throughput,
        )}          ` +
        `${formatThroughput(
          result.tsIncremental
            .throughput,
        )}`,
    )
  }

  console.log('')

  /*
   * ------------------------------------------------
   * Incremental vs AJV
   * ------------------------------------------------
   */

  console.log(
    'Incremental vs AJV',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  console.log(
    'Nodes       AJV → Incremental speedup',
  )

  console.log(
    '--------------------------------------------------------------------------',
  )

  for (
    const result of scenarioResults
  ) {
    console.log(
      `${result.nodes
        .toString()
        .padStart(5)}       ` +
        formatSpeedup(
          result.ajv.elapsed,
          result.tsIncremental
            .elapsed,
        ),
    )
  }

  console.log('')
}