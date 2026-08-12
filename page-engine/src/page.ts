import type { PageNode } from './types'

export class Page {
  private readonly node: PageNode

  constructor(node: PageNode) {
    this.node = node
  }

  get id(): string {
    return this.node.id
  }

  get type(): string {
    return this.node.type
  }

  get fields(): Record<string, unknown> {
    return this.node.fields
  }

  children(): PageNode[] {
    return this.node.children
  }

  findById(id: string): PageNode | undefined {
    if (this.node.id === id) {
      return this.node
    }

    return this.findInChildren(this.node.children, id)
  }

  findByType(type: string): PageNode[] {
    const result: PageNode[] = []

    this.collectByType(this.node, type, result)

    return result
  }

  private findInChildren(
    children: PageNode[],
    id: string,
  ): PageNode | undefined {
    for (const child of children) {
      if (child.id === id) {
        return child
      }

      const found = this.findInChildren(child.children, id)

      if (found) {
        return found
      }
    }

    return undefined
  }

  private collectByType(
    node: PageNode,
    type: string,
    result: PageNode[],
  ): void {
    if (node.type === type) {
      result.push(node)
    }

    for (const child of node.children) {
      this.collectByType(child, type, result)
    }
  }

  toJSON(): PageNode {
    return structuredClone(this.node)
  }
}