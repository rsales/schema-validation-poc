import type {
  PageChange,
  PageNode,
} from './types'

export type NodePath = number[]

/**
 * Returns the validation scope affected by a page change.
 *
 * The scope contains the changed node and/or its ancestors,
 * depending on the type of change.
 */
export function affectedScope(
  page: PageNode,
  change: PageChange,
): NodePath[] {
  // `page` is intentionally kept in the API.
  // It will be used when the scope starts resolving
  // actual nodes from paths.
  void page

  switch (change.type) {
    case 'field_changed':
      return fieldChangedScope(
        change.path,
      )

    case 'node_added':
      return nodeAddedScope(
        change.path,
      )

    case 'node_removed':
      return nodeRemovedScope(
        change.path,
      )

    case 'node_moved':
      return nodeMovedScope(
        change.from,
        change.to,
      )
  }
}

function fieldChangedScope(
  path: number[],
): NodePath[] {
  return [
    [...path],
  ]
}

function nodeAddedScope(
  path: number[],
): NodePath[] {
  return ancestorsInclusive(path)
}

function nodeRemovedScope(
  path: number[],
): NodePath[] {
  return ancestors(path)
}

function nodeMovedScope(
  from: number[],
  to: number[],
): NodePath[] {
  return uniquePaths([
    ...ancestorsInclusive(from),
    ...ancestorsInclusive(to),
  ])
}

function ancestorsInclusive(
  path: number[],
): NodePath[] {
  const result: NodePath[] = []

  for (
    let length = path.length;
    length >= 0;
    length--
  ) {
    result.push(
      path.slice(0, length),
    )
  }

  return result
}

function ancestors(
  path: number[],
): NodePath[] {
  const result: NodePath[] = []

  for (
    let length = path.length - 1;
    length >= 0;
    length--
  ) {
    result.push(
      path.slice(0, length),
    )
  }

  return result
}

function uniquePaths(
  paths: NodePath[],
): NodePath[] {
  const seen = new Set<string>()
  const result: NodePath[] = []

  for (const path of paths) {
    const key = path.join('.')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(path)
  }

  return result
}

/**
 * Resolves a NodePath against a page tree.
 *
 * An empty path resolves to the page root.
 */
export function resolvePath(
  page: PageNode,
  path: NodePath,
): PageNode | undefined {
  let node: PageNode = page

  for (const index of path) {
    node = node.children[index]

    if (!node) {
      return undefined
    }
  }

  return node
}

/**
 * Resolves multiple NodePaths against a page tree.
 *
 * Invalid paths are ignored.
 */
export function resolvePaths(
  page: PageNode,
  paths: NodePath[],
): PageNode[] {
  const nodes: PageNode[] = []

  for (const path of paths) {
    const node = resolvePath(
      page,
      path,
    )

    if (node) {
      nodes.push(node)
    }
  }

  return nodes
}